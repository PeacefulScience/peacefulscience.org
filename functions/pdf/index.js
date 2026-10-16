require("dotenv").config();
const { builder } = require("@netlify/functions");
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const axios = require("axios");
const urljoin = require("url-join");
const util = require("util");
var os = require("os");
var fs = require("fs");
var random = require("random-string-generator");

const Prince = require("prince");

const baseurl = "https://peacefulscience.org/";
const pdfBucket = process.env.PDF_S3_BUCKET || "";
const pdfRegion = process.env.PDF_S3_REGION || "us-east-1";
// Default custom CDN hostname; override via Doppler PDF_CDN_BASE if needed.
const pdfCdnBase = (
  process.env.PDF_CDN_BASE || "https://cdn.peacefulscience.org"
).replace(/\/$/, "");
// Prefer PDF-specific creds so we do not override Netlify's own AWS_* runtime env.
const pdfAccessKey =
  process.env.PDF_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "";
const pdfSecretKey =
  process.env.PDF_AWS_SECRET_ACCESS_KEY ||
  process.env.AWS_SECRET_ACCESS_KEY ||
  "";
const s3 =
  pdfBucket && pdfAccessKey && pdfSecretKey
    ? new S3Client({
        region: pdfRegion,
        credentials: {
          accessKeyId: pdfAccessKey,
          secretAccessKey: pdfSecretKey,
        },
      })
    : null;

async function renderPdf(url) {
  let tfile = os.tmpdir() + "/" + random() + ".output.pdf";
  let p = Prince();

  if (process.env.PRINCE) {
    p.config.binary = process.env.PRINCE;
  } else {
    p.config.binary = "/usr/local/bin/prince";
  }

  await p.inputs(url).output(tfile).execute();
  const buffer = fs.readFileSync(tfile, null);
  fs.unlinkSync(tfile);
  return buffer;
}

async function headPdfFromS3(key) {
  if (!s3 || !pdfBucket) return null;
  try {
    const out = await s3.send(
      new HeadObjectCommand({ Bucket: pdfBucket, Key: key })
    );
    return out;
  } catch (error) {
    if (error && (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404)) {
      return null;
    }
    throw error;
  }
}

async function savePdfToS3({ key, buffer, princeEtag, cacheControl }) {
  if (!s3 || !pdfBucket) {
    console.warn("PDF_S3_BUCKET unset; skipping S3 upload");
    return;
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: pdfBucket,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
      CacheControl:
        cacheControl ||
        "public, max-age=2592000, stale-while-revalidate=31536000",
      Metadata: {
        "prince-etag": princeEtag || "",
      },
    })
  );
  console.info(
    `s3 put s3://${pdfBucket}/${key} prince-etag=${princeEtag} bytes=${buffer.length}`
  );
}

function cdnUrl(s3Key, princeEtag) {
  if (!pdfCdnBase) return null;
  const v = encodeURIComponent(princeEtag || "0");
  return `${pdfCdnBase}/${s3Key}?v=${v}`;
}

function redirectToCdn({ s3Key, princeEtag, name, canurl, path }) {
  const location = cdnUrl(s3Key, princeEtag);
  if (!location) return null;
  return {
    statusCode: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      "Content-Disposition": `filename="${name}"`,
      Link: `<${canurl}>; rel="alternate"; type="text/html", <${
        "https://peacefulscience.org/" + path
      }>; rel="canonical"`,
      Etag: `"${princeEtag}"`,
      "x-pdf-s3-key": s3Key,
      "x-pdf-cdn": location,
    },
  };
}

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, "g"), replace);
}

async function handler(event, context) {
  let route = event.path.toLowerCase();
  route = route.endsWith("/") ? route.slice(0, -1) : route;

  if (!route.endsWith(".pdf"))
    return { statusCode: 301, headers: { location: `${route}.pdf` } };

  route = route.slice(0, -4);
  route = route.split("/");

  let path = route.slice(route.indexOf("pdf") + 1);
  let url = urljoin(baseurl, "_prince", path.join("/"));
  let canurl = urljoin(baseurl, path.join("/"));
  let title = path.slice(-1)[0];
  let section = path[0];
  let name = `${title}.pdf`;
  let s3Key = `pdf/${path.join("/")}.pdf`;
  let req_etags = [];

  if (!["articles", "about", "prints"].includes(section)) {
    return { statusCode: 404 };
  }

  let headers = event.headers;

  if ("if-none-match" in headers) {
    req_etags = headers["if-none-match"];
    req_etags = req_etags.split(",");
    req_etags = req_etags.map((s) => replaceAll(s, '"', "").trim());
  }

  try {
    const res = await axios.head(url, { headers });
    const res_etag = replaceAll(res.headers["etag"] || "", '"', "");

    for (const req_etag of req_etags) {
      if (req_etag.includes(res_etag)) {
        const out = {
          statusCode: 304,
          headers: {
            etag: `"${req_etag}"`,
            "cache-control": res.headers["cache-control"],
            age: res.headers["age"],
            "x-nf-request-id": res.headers["x-nf-request-id"],
          },
        };
        console.info(`${out.statusCode}:\t${url}`);
        return out;
      }
    }

    // Serve from CloudFront when S3 already has a PDF matching the Prince HTML etag.
    try {
      const head = await headPdfFromS3(s3Key);
      const stored = head && head.Metadata && head.Metadata["prince-etag"];
      if (stored && stored === res_etag) {
        const out = redirectToCdn({
          s3Key,
          princeEtag: res_etag,
          name,
          canurl,
          path: event.path.toLowerCase(),
        });
        if (out) {
          console.info(`${out.statusCode}:\t${url}\tcdn-hit\t${s3Key}`);
          return out;
        }
      }
    } catch (error) {
      console.error(`s3 head failed for ${s3Key}: ${util.inspect(error)}`);
    }

    let buffer;
    try {
      buffer = await renderPdf(url);
    } catch (error) {
      const out = { statusCode: 500, body: util.inspect(error) };
      console.info(`${out.statusCode}:\t${url}\tprince-failed`);
      return out;
    }

    try {
      await savePdfToS3({
        key: s3Key,
        buffer,
        princeEtag: res_etag,
        cacheControl: res.headers["cache-control"],
      });
    } catch (error) {
      console.error(`s3 put failed for ${s3Key}: ${util.inspect(error)}`);
    }

    const redirected = redirectToCdn({
      s3Key,
      princeEtag: res_etag,
      name,
      canurl,
      path: event.path.toLowerCase(),
    });
    if (redirected) {
      console.info(
        `${redirected.statusCode}:\t${url}\tbytes=${buffer.length}\tcdn-miss\t${s3Key}`
      );
      return redirected;
    }

    // Fallback when PDF_CDN_BASE is unset: return the body (may hit Lambda size limits).
    const out = {
      statusCode: 200,
      isBase64Encoded: true,
      body: buffer.toString("base64"),
      headers: {
        "Content-Disposition": `filename="${name}"`,
        "Cache-Control": res.headers["cache-control"],
        "content-type": "application/pdf",
        Link: `<${canurl}>; rel="alternate"; type="text/html", <${
          "https://peacefulscience.org/" + event.path.toLowerCase()
        }>; rel="canonical"`,
        Etag: res.headers["etag"],
        age: res.headers["age"],
        "x-nf-request-id": res.headers["x-nf-request-id"],
        "x-pdf-s3-key": s3Key,
      },
    };
    console.info(
      `${out.statusCode}:\t${url}\tbytes=${buffer.length}\ts3=${s3Key}\tno-cdn`
    );
    return out;
  } catch (error) {
    const status = error.response && error.response.status;
    const out = { statusCode: status || 500 };
    console.info(`${out.statusCode}:\t${url}\t${JSON.stringify(event.headers)}`);
    return out;
  }
}

exports.handler = builder(handler);

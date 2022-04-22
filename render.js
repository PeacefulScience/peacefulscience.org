const { parseHTML } = require("linkedom");
const vm = require("vm");
const fs = require("fs").promises;
const fg = require("fast-glob");
const pathmod = require("path");

const classes = new Set();

const { mathjax } = require("mathjax-full/js/mathjax.js");
const { TeX } = require("mathjax-full/js/input/tex.js");
const { SVG } = require("mathjax-full/js/output/svg.js");
// const {CHTML} = require('mathjax-full/js/output/chtml.js');
const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor.js");
const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html.js");
const { AllPackages } = require("mathjax-full/js/input/tex/AllPackages.js");
require("mathjax-full/js/util/entities/all.js");

const aliases = {};
const paths = new Set();

function postprocess(params) {
  const document = params.dom.document;
  var toplevel = document.querySelectorAll(".article-text > *");

  if (toplevel !== null) {
    for (var child of toplevel) {
      if (child.classList.contains("editor-note")) {
        continue;
      }

      if (child.tagName === "P") {
        child.classList.add("dropcap");
        break;
      }
      if (child.tagName === "H2") {
        break;
      }
      if (child.classList.contains("article-question")) {
        break;
      }
    }
  }

  var footnotes = document.querySelector(".footnotes");

  if (footnotes !== null && footnotes.querySelector("h2") === null) {
    footnotes.classList.add("hidden");

    for (var tl of toplevel) {
      var refs = tl.querySelectorAll(".footnote-ref");

      var ol = document.createElement("ol");
      for (var ref of refs) {
        var hash = ref.href.split("#")[1];
        var div = document.createElement("aside");
        var n = hash.split(":")[1];
        var fn = document.getElementById(hash);

        if (fn) {
          var cfn = fn;
          if (ol.getAttribute("start") == null) {
            ol.setAttribute("start", n);
          }
          ol.appendChild(cfn);
          div.classList.add("sidenote");
          div.appendChild(ol);
          cfn.querySelector(".footnote-backref").classList.add("hidden");
          tl.parentElement.insertBefore(div, tl);
        }
      }
    }
  }
  var ss = document.querySelectorAll("sup[id] + sup[id]");

  for (var s of ss)
    if (s.previousSibling.nodeType == 3)
      //Node.TEXT_NODE
      s.parentElement.insertBefore(document.createElement("span"), s);

  return params;
}

function parsedom(json) {
  const data = JSON.parse(json);
  const dom = parseHTML("<div class='article-text'>" + data.html + "</div>");
  dom.context = vm.createContext({
    window: dom,
    document: dom.document,
    navigator: dom.navigator,
  });
  return { data, dom };
}

async function dom2html(params) {
  params.data.html =
    params.dom.document.querySelector(".article-text").innerHTML;
  return params;
}

async function parse_aliases(params) {
  var alias = params.data.aliases ? params.data.aliases : [];
  alias = alias.map((x) => x.replace(/\/^/, ""));
  paths.add(params.data.path);

  for (var a of alias) {
    if (a in aliases) {
      throw Error("Alias double assigned.");
    }
    aliases[a] = params.data.path;
  }
  return params;
}

async function write_aliases() {
  var promises = [];
  for (var k in aliases) {
    if (paths.has(k)) {
      console.error("Skipping alias at: ", k);
      continue;
    }

    promises.push(
      (async (k) => {
        const body = JSON.stringify({ type: "redirect", redirect: aliases[k] });
        const output_path = `json${k}.json`;
        const output_dir = pathmod.dirname(output_path);
        await fs.mkdir(output_dir, { recursive: true });
        await fs.writeFile(output_path, body);
      })(k)
    );
  }

  return Promise.all(promises);
}

async function runscripts(dom) {
  for (const elem of dom.document.querySelectorAll("script[render]"))
    vm.runInContext(elem.innerHTML, dom.context);
  return dom;
}

async function remove(params) {
  const { dom } = params;
  for (const elem of dom.document.querySelectorAll("[remove]")) elem.remove();
  return params;
}

const adaptor = liteAdaptor({ fontSize: 16 });
RegisterHTMLHandler(adaptor);

function render_mathjax(params) {
  const tex = new TeX({
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"],
    ],
    packages: AllPackages,
  });
  const svg = new SVG({
    fontCache: "local",
    exFactor: 0.5,
    mtextInheritFont: false,
  });

  //  const chtml = new CHTML({
  //  scale: 1 / 1.131,
  //  });

  const mj = mathjax.document(html, { InputJax: tex, OutputJax: svg });

  mj.render();
  html = adaptor.doctype(mj.document) + "\n";
  html += adaptor.outerHTML(adaptor.root(mj.document));
  return html;
}

const imgsize = fs.readFile("data/imgsize.json")
   .then(JSON.parse) 

async function headerimgsize(params) {

  const src =  params.data?.headerimage?.src
  if (!src) return params

  const info = await imgsize.then(x => x[src])
  if (!info) return params

  params.data.headerimage = {...info, ...params.data.headerimage}

  return params
}

async function render(path) {
  var output_path = path
    .replace(/\/index.json$/, ".json")
    .replace(/^public/, "json");

  var output_dir = pathmod.dirname(output_path);

  return fs
    .readFile(path)
    .then(parsedom)
    .then(headerimgsize)
    .then(postprocess)
    .then(parse_aliases)
    .then(remove)
    .then(dom2html)
    .then(async (x) => {
      await fs.mkdir(output_dir, { recursive: true });
      await fs.writeFile(output_path, JSON.stringify(x.data));
    });
}

async function renderall(glob) {
  const tasks = [];
  const stream = fg.stream(glob);
  const pLimit = (await import("p-limit")).default;

  var limit = pLimit(50);

  for await (const path of stream)
    tasks.push(
      limit(() =>
        render(path).catch((e) => {
          console.error(e);
          throw e;
        })
      )
    );
  return Promise.all(tasks);
}

let globs = process.argv.slice(2);

globs = globs.length ? globs : "public/**/index.json";

console.log("RENDERIlNG: ", globs);

renderall(globs)
  .then(write_aliases);

require("dotenv").config()
const { builder } = require("@netlify/functions");
const axios = require('axios');

const YEAR = 60 * 60 * 24 * 365;

async function handler(event, context) {
    console.info(event.path);

    let amzn_id = event.path.replace(/^.*?bookcover\//, "");
    let headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'}

    let url = `http://images.amazon.com/images/P/${amzn_id}.LZZZZZZZ.jpg`
    console.log(url);

    let imageBase64 = await axios
      .get(url, { responseType: 'arraybuffer', headers })
      .then((response) => Buffer.from(response.data, 'binary').toString('base64'))

  return {
    statusCode: 200,
    body: imageBase64,
    isBase64Encoded: true,
    ttl: YEAR,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": `public, max-age=${YEAR}, s-maxage=${YEAR}, immutable`
    }
  }
}

exports.handler = builder(handler);

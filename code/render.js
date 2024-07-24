const { parseHTML } = require("linkedom");
const vm = require('vm');
const fs = require('fs').promises;
const fg = require('fast-glob');
const classes = new Set();

const {mathjax} = require('mathjax-full/js/mathjax.js');
const {TeX} = require('mathjax-full/js/input/tex.js');
const {SVG} = require('mathjax-full/js/output/svg.js');
// const {CHTML} = require('mathjax-full/js/output/chtml.js');
const {liteAdaptor} = require('mathjax-full/js/adaptors/liteAdaptor.js');
const {RegisterHTMLHandler} = require('mathjax-full/js/handlers/html.js');
const {AllPackages} = require('mathjax-full/js/input/tex/AllPackages.js');
require('mathjax-full/js/util/entities/all.js');

function parsedom(html) {
    const dom = parseHTML(html);
    dom.context = vm.createContext({
      'window': dom, 
      "document": dom.document, 
      "navigator": dom.navigator,
    });
    return dom;
}

async function dom2html(dom) {
  return dom.document.toString();
}

async function getclasses(dom) {
 for (const elem of dom.document.querySelectorAll("*"))
   elem.classList.forEach(c => classes.add(c));
 return dom;
}

async function runscripts(dom) {
 for (const elem of dom.document.querySelectorAll("script[render]")) 
   vm.runInContext(elem.innerHTML, dom.context);
 return dom;
}

async function remove(dom) {
 for (const elem of dom.document.querySelectorAll("[remove]")) 
   elem.remove();
 return dom;
}

const adaptor = liteAdaptor({fontSize: 16});
RegisterHTMLHandler(adaptor);


function render_mathjax(html) {
  const tex = new TeX({
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    packages: AllPackages
  });
  const svg = new SVG({
    fontCache: "local",
    exFactor: 0.5,
     mtextInheritFont: false,
 });
  
//  const chtml = new CHTML({
//  scale: 1 / 1.131,
//  });

  const mj = mathjax.document(html, {InputJax: tex, OutputJax: svg});
  
  mj.render();
  html = adaptor.doctype(mj.document) + "\n" ;
  html += adaptor.outerHTML(adaptor.root(mj.document));
  return html;
}


async function render(path) {
 
 return fs.readFile(path,  {encoding: 'utf8'})
   .then(parsedom)
   .then((dom) => {
     has_mathjax = dom.document.querySelector("[mathjax]");
     
     if(has_mathjax) console.log("mathjax", path);
     
     return Promise.resolve(dom)  
      .then(runscripts)
      .then(remove)
      .then(getclasses)
      .then(dom2html)
      .then(has_mathjax && render_mathjax) 
   })
   .then(fs.writeFile.bind(null, path));
}

async function renderall(glob) {
  const tasks = [];
  const stream = fg.stream(glob);
  const pLimit = (await import('p-limit')).default;

  var limit = pLimit(50);
  
  for await (const path of stream) 
    tasks.push(
      limit(() => render(path)
        .catch(e => {console.error(e); throw e;})
      )
    )
  return Promise.all(tasks);
};

let globs = process.argv.slice(2);

globs = globs.length ? globs : 'public/**/*.html';

console.log("RENDERING: ", globs)

renderall(globs)
.then(r => fs.writeFile("layouts/classes.html", [...classes].join('\n')))

---

cascade:
  reverse: false
  design:
    style: horizontal
    layout: "col-12"
  jsonld:
    "@type": CreativeWorkSeries
    "@id": = permalink
    headline: = title
    description: = description
    about: = about
    hasPart: = pages
    publisher: 
      "@id": = id /jsonld/peacefulscience
    sameas: = sameas    
    mainEntityOfPage: 
      "@type": WebPage
      "@id": = permalink webpage
      url: = permalink
---
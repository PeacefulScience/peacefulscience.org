---
title: Series
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
      "@id": https://peacefulscience.org/#organization
      name: Peaceful Science
    sameAs: = sameas 
    mainEntityOfPage: 
      "@type": WebPage
      "@id": = permalink webpage
      url: = permalink
---
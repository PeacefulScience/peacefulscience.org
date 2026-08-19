---
title: Peaceful Science
sitemap:
  changefreq: hourly
description: "Building trust between scientists and the public, asking the question: what does it mean to be human?"
  
jsonld:
  "@type": WebSite
  "@id": = permalink webpage
  image: = headerimage
  name: Peaceful Science
  url: https://peacefulscience.org/
  publisher: = copy /jsonld/peacefulscience 
  potentialAction:
    "@type": SearchAction
    target: https://peacefulscience.org/search/?PeacefulScience[query]={search_term}
    query-input: required name=search_term
    
headerimage:
  src: /img/design/logo-black-square.png 

cascade:
  rss: false
  defaultimg: /img/design/logo-black-square.png
  jsonld:
    "@type": WebPage
    "@id": = permalink webpage
    description: = description
    author: = authors     
    datePublished: = date
    dateModified: = lastmod
    image: = headerimage
    isPartOf: = series
    publisher: = copy /jsonld/peacefulscience
    sameAs: = sameas
    about: = about
---
---
title: Articles
cascade:
  rss: true
  outputs:
  - HTML
  - print
  jsonld:
    "@type": Article
    "@id": = permalink 
    headline: = title   
    name: = title
    description: = description
    author: = authors     
    datePublished: = publishdate
    dateCreated: = date
    dateModified: = lastmod
    image: = headerimage
    mentions: = mentions
    publisher: = copy /jsonld/peacefulscience
    sameAs: = sameas
    identifier: = identifier
    isBasedOn: = basedon
    about: = about
    isPartOf: = series
    isAccessibleForFree: true
    mainEntityOfPage: 
      "@type": WebPage
      "@id": = permalink webpage
      url: = permalink
---

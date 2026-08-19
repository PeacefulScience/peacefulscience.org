ifneq (,$(wildcard ./.env))
    include .env
    export
endif

.PHONY: crossref pdf doi info imginfo pdfinfo news topics topic-pages

all: imginfo pdfinfo production

topics:
	node code/topics/generate.js

topic-pages:
	node code/topics/pages.js

algolia: 
	hugo -e index
	npm run algolia

links:
	bash code/links.bsh

info: imginfo pdfinfo

imginfo: static/img
	python code/imgsize.py > data/imgsize.json

pdfinfo: static/pdf
	python code/pdfinfo.py > data/pdfinfo.json

crossref-check:
	xmllint  --schema  crossref/schemas/crossref5.3.1.xsd  public/.xref/*.xml --nowarning --noout

crossref: crossref-check crossref-nocheck

crossref-nocheck:
	curl -s -F 'operation=doMDUpload' -F 'fname=@public/.xref/conf.xml' -F 'login_id=${CROSSREF_ID}' -F 'login_passwd=${CROSSREF_PASS}' https://doi.crossref.org/servlet/deposit | grep SUCCESS
	curl -s -F 'operation=doMDUpload' -F 'fname=@public/.xref/posted.xml' -F 'login_id=${CROSSREF_ID}' -F 'login_passwd=${CROSSREF_PASS}' https://doi.crossref.org/servlet/deposit | grep SUCCESS
	curl -s -F 'operation=doMDUpload' -F 'fname=@public/.xref/book.xml' -F 'login_id=${CROSSREF_ID}' -F 'login_passwd=${CROSSREF_PASS}' https://doi.crossref.org/servlet/deposit | grep SUCCESS

princehack: prince-14.2-aws-lambda.zip
	unzip -q -o prince-14.2-aws-lambda.zip

prince-14.2-aws-lambda.zip:
	wget -q https://www.princexml.com/download/prince-14.2-aws-lambda.zip

ifeq ($(PRINCE),./prince)
production: princehack
else
production:
endif
	bash -e code/production	

princeclean:
	rm -rf `zipinfo -1  prince-14.2-aws-lambda.zip`

hugo-watch:
	node code/topics/pages.js
	hugo -w 

tailwind-watch:
	npm run tailwind
	fswatch  -0 -o -r layouts sources/tailwind.css | xargs -0 -n1 -I{} npm run tailwind

dev:
	echo built
	sleep 100000

dev1: hugo-watch tailwind-watch 


# if INPUT env is defined, new options available.
ifneq ($(INPUT),)
pdf:
	code/pdf ${INPUT}

doi: 
	python code/doi.py ${INPUT}

news: 
	python -m code.newsletter  ${INPUT}
	open newsletter.html
endif
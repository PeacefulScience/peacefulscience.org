const { gotScraping } = require('got-scraping');
const util = require("util");

exports.handler =  async function(event, context) {


  return await gotScraping
    .get(`{{ event.queryStringParameters.url }}`)
    .then(function ({body}) {    
     return {    
      statusCode: 200,
      body: body,
     }         
        
    }, function (error) {
      return {
        statusCode: 500,
        body: util.inspect(error)
      }
    }) 
}
const test = require('./handler.js')
test.searchLdap(null, null, function(idontknow, response) {
	console.log("HarnessResponse")
	console.log(response)
})
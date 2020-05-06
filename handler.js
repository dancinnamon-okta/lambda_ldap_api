'use strict';

module.exports.searchLdap = (event, context, callback) => {
	var ldap = require('ldapjs')
	var response = {
		statusCode: 500,
		body: 'Unknown error.'
	}
	var bodyData = {
		message: undefined,
		users: undefined,
		userCount: 0
	}

	var ldapHost = event.headers['ldapHost']
	var bindDN = event.headers['bindDN']
	var bindPW = event.headers['bindPW']
	var searchBase = event.headers['searchBase']
	var returnAttributes = event.headers['userAttributes']
	
	//Validate we have all of our context that we need to connect to the LDAP server.
	if(ldapHost == undefined || 
	bindDN == undefined || 
	bindPW == undefined || 
	searchBase == undefined || 
	event.queryStringParameters == undefined) {
		response.statusCode = 400
		bodyData.message = 'Bad request. Not all required configuration attributes are properly configured. Please check your gateway configuration.'
		response.body = JSON.stringify(bodyData)
		callback(null, response)	 //Exit	status 400
	}
	
	var client = ldap.createClient({
		url: ('ldap://' + ldapHost + '/' + bindDN)
	})
	var users = []
	
	//Validate we have a filter.
	if(event.queryStringParameters.q == undefined) {
		response.statusCode = 400
		bodyData.message = 'Bad request.  Please include an ldap filter in the "q" querystring variable.'
		response.body = JSON.stringify(bodyData)
		
		callback(null, response) //Exit status 400
	}
	client.bind(bindDN, bindPW, function(err) {
		if(err != undefined) {
			console.log(err)
			response.statusCode = 500
			bodyData.message = 'An error occured binding to the LDAP server:' + err
			response.body = JSON.stringify(bodyData)
		
			client.unbind(function(err) {
				console.log(err)
			})
			callback(null, response) //Exit status 500
		}
		
		var userAttributes = ['dn', 'samaccountname', 'userprincipalname']
		if(returnAttributes != undefined && returnAttributes.split(',').length > 0 ) {
			userAttributes = returnAttributes.split(',')
		}
		var opts = {
			scope: 'sub',
			filter: event.queryStringParameters.q,
			paged: true,
			attributes: userAttributes
		}
		
		client.search(searchBase, opts, function(err, res) {
			res.on('searchEntry', function(entry) {
				var usr = {}
				usr['name'] = entry.objectName
				for (var i=0; i < entry.attributes.length; i++) {
					usr[entry.attributes[i].type] = entry.attributes[i].vals
				}
				
				users.push(usr)
			})
			
			res.on('end', function(result) {
				response.statusCode = 200
				bodyData.users = users
				bodyData.userCount = users.length
				bodyData.message = 'Search Successful!'
				response.body = JSON.stringify(bodyData)
				
				client.unbind(function(err) {
					console.log(err)
				})
				callback(null, response) //Exit status 200
			})
			
			res.on('error', function(err) {
				console.log(err)
				response.statusCode = 500
				bodyData.message = 'An error occured searching for LDAP users:' + err
				response.body = JSON.stringify(bodyData)

				client.unbind(function(err) {
					console.log(err)
				})
				callback(null, response) //Exit status 500
			})
		})
	});
};
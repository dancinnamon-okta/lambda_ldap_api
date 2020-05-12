'use strict';

module.exports.searchLdap = (event, context, callback) => {
	var ldap = require('ldapjs')
	var assert = require('assert')
	
	var ldapHost = event.headers['ldapHost']
	var bindDN = event.headers['bindDN']
	var bindPW = event.headers['bindPW']
	var searchBase = event.headers['searchBase']
	var returnAttributes = event.headers['userAttributes']

	assert(ldapHost, '[400] Bad request. Missing required header ldapHost. Please check your gateway configuration.')
	assert(bindDN, '[400] Bad request. Missing required header bindDN. Please check your gateway configuration.')
	assert(bindPW, '[400] Bad request. Missing required header bindPW. Please check your gateway configuration.')
	assert(searchBase, '[400] Bad request. Missing required header searchBase. Please check your gateway configuration.')
	assert(returnAttributes, '[400] Bad request. Missing required header returnAttributes. Please check your gateway configuration.')
	assert(event.queryStringParameters.q, '[400] Bad request. Please include an ldap filter in the "q" querystring variable.')
	
	var client = ldap.createClient({
		url: ('ldap://' + ldapHost + '/' + bindDN)
	})
	
	var users = []

	client.bind(bindDN, bindPW, function(err) {
		console.log(err)
		assert.ifError(err, '[500] An error occured binding to the LDAP server:' + err)
		
		var userAttributes = ['dn', 'samaccountname', 'userprincipalname']
		if(returnAttributes && returnAttributes.split(',').length > 0 ) {
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
				const response = {
					statusCode: 200,
					body: JSON.stringify({
						users: users,
						userCount: users.length,
						message: 'Search Successful!'
					})
				}
				
				client.unbind(function(err) {
					console.log(err)
				})
				callback(null, response) //Exit status 200
			})
			
			res.on('error', function(err) {
				console.log(err)
				var message = '[500] An error occured searching for LDAP users:' + err
				client.unbind(function(err) {
					console.log(err)
				})
				callback(new Error(message)) //Exit status 500
			})
		})
	});	
};
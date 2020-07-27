'use strict';

const LdapClient = require('promised-ldap')
const assert = require('assert')
const aws = require('aws-sdk')
const util = require('util')
const servmgr = new aws.SSM({httpOptions:{connectTimeout: 3000}})

module.exports.searchLdap = async function(event) {
	try {
		assert(process.env.LDAP_HOST, 'Missing required configuration parameter ldapHost.')
		assert(process.env.BIND_DN, 'Missing required configuration parameter bindDN.')
		assert(process.env.BIND_PW_PARAM_NAME, 'Missing required configuration parameter bindPWParameterName.')
		assert(process.env.SEARCH_BASE, 'Missing required configuration parameter searchBase.')
		assert(process.env.RETURN_ATTRIBUTES, 'Missing required configuration parameter returnAttributes.')
		assert(event.queryStringParameters.q, 'Bad request. Please include an ldap filter in the "q" querystring variable.')
	} catch (e) {
		console.log(e)
		const response = {
			statusCode: 400,
			body: e.message
		}
		return response
	}
	
	var ldapHost = process.env.LDAP_HOST
	var bindDN = process.env.BIND_DN
	var bindPWParameterName = process.env.BIND_PW_PARAM_NAME
	var searchBase = process.env.SEARCH_BASE
	var returnAttributes = process.env.RETURN_ATTRIBUTES
	
	const promise = new Promise(function(resolve, reject) {
		//Get our password from the parameter store.
		getLDAPPWFromStore(servmgr, bindPWParameterName)
		.then((passwordData) => {
			var users = []
			var client = new LdapClient({
				url: ('ldap://' + ldapHost + '/' + bindDN),
				connectTimeout: 3000
			})
		
			console.log("Binding to " + ldapHost + "using bind DN: " + bindDN)
			client.bind(bindDN, passwordData.Parameter.Value)
			.then((result) => {
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
				client.search(searchBase, opts)
				.then((searchResults) => {
					for (var ent=0; ent<searchResults.entries.length; ent++) {
						var usr = {}
						var entry = searchResults.entries[ent]
						usr['name'] = entry.objectName
						for (var i=0; i < entry.attributes.length; i++) {
							usr[entry.attributes[i].type] = entry.attributes[i].vals
						}
						users.push(usr)
					}
					
					const response = {
						statusCode: 200,
						body: JSON.stringify({
							users: users,
							userCount: users.length,
							message: 'Search Successful!'
						})
					}
					resolve(response)
				})
				.catch((err) => {
					console.log("Failed to search to LDAP.")
					console.log(err)
					const response = {
						statusCode: 500,
						body: "Failed to search LDAP: " + err.message
					}
					resolve(response)
				})
			})
			.catch((err) => {
				console.log("Failed to bind to LDAP.")
				console.log(err)
				const response = {
					statusCode: 500,
					body: "Failed to bind  to LDAP: " + err.message
				}
				resolve(response)
			})
		})
		.catch((err) => {
			console.log("Failed to retrieve password from AWS SSM.")
			console.log(err)
			const response = {
				statusCode: 500,
				body: "Failed to retrieve password from AWS SSM: " + err.message
			}
			resolve(response)
		})
	})
	return promise
};

//This method will be used to get our LDAP password from the AWS SSM parameter store.
function getLDAPPWFromStore(srvManager, paramName){
	var storeParam = {
		Name: paramName,
		WithDecryption: true
	}
	return new Promise(function(resolve, reject){
		srvManager.getParameter(storeParam, function(err, data){
			if(err){
				reject(console.log('Error getting LDAP Password: ' + err, err.stack));
			} else {
				console.log('Successfully retrieved LDAP Password!')
				resolve(data);
			}
		});
	});
}
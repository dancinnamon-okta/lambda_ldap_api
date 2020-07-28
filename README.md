# lambda_ldap_api
A serverless package that will securely host up an internal LDAP repository for reference use in Okta Workflows

## Intended Use Case
Running queries against an AWS hosted LDAP repository for reference use in Okta workflows. For example when calculating a unique username, existing entries can be determined at runtime.

## What's included
- A lambda function for executing LDAP searches against the LDAP repository.

- A simple API gateway for hosting the lambda function, secured via OAuth2 tokens.

- Proper security roles for retrieving the encrypted LDAP password from AWS parameter store.

## Pre-requisites
- An AWS account

- An LDAP server running on the AWS account

- A SecureString parameter in the AWS SSM parameter store called ldap_pw containing the password to be used to login to the LDAP directory (https://docs.aws.amazon.com/systems-manager/latest/userguide/param-create-console.html)

- A security group that allows TCP 389 and 636 to the LDAP server

- VPC endpoints that represent access to the AWS SSM parameter store within your subnet (https://aws.amazon.com/premiumsupport/knowledge-center/lambda-vpc-parameter-store/)
  - Note: these endpoints must be assigned a security group that allow inbound HTTPS access (inbound to the endpoint- that is).
  
## Quick Start

0. Clone the repo.

```bash
git clone https://github.com/dancinnamon-okta/lambda_ldap_api.git
cd lambda_ldap_api
```

1. Copy serverless.yml.example to serverless.yml
```bash=
$ cp serverless.yml.example serverless.yml
```

2. Update serverless.yml with the proper values for your deployment:
- issuerUrl: This is the issuer of the OAuth2 server you're using to secure the endpoint.
- Audience: This is the audience of the OAuth2 tokens we're expecting to be issued. In Okta this is part of the authorization server.
- LDAP_HOST: Hostname or IP address of the LDAP server.
- SEARCH_BASE: Base OU of the LDAP directory to limit our search to.
- RETURN_ATTRIBUTES: What attributes to return in our search results.
- BIND_DN: What service account (in DN format) to login to the directory as.
- ldap password parameter ARN: Provide the ARN of the ldap password parameter in the AWS SSM parameter store.
- Security Group ID(s): Provide the ID of a security group that has access to the LDAP server over port 389/636.
- Subnet ID: Provide the ID of the subnet that the LDAP server is in.

3.  Install serverless via npm

```bash=
$ npm install -g serverless
```

## Deploy

> NOTE: Serverless Framework cli needs to be [setup](https://www.serverless.com/framework/docs/).

In order to deploy the you endpoint simply run

```bash

serverless deploy
```

The expected result should be similar to:

```bash
Serverless: Packaging service...
Serverless: Uploading CloudFormation file to S3...
Serverless: Uploading service .zip file to S3 (758 B)...
Serverless: Updating Stack...
Serverless: Checking Stack update progress...
..........
Serverless: Stack update finished...
```

## Okta Setup
If you need an Okta tenant, [Sign up here](https://developer.okta.com/).

1. Create an OIDC application in Okta that Workflows will use as a client.
  - Application Type = web

  - Set the redirect URI = https://oauth.workflows.oktapreview.com/oauth/httpfunctions/cb

  - Set allow authorization code and refresh tokens

  - Ensure the application is assigned to the administrator configuring your workflow.

2. Create an authorization server, and create the ldap.read scope on that authorization server.
 ** Note - the "audience" parameter you use must be the same as the "Audience" used in the serverless.yml file you updated in step 2.

## Okta Workflows Setup
TODO: provide flopack

1. Create an HTTP connection, using the OAuth2 protocol for security.

2. In the applicable workflow, update the HTTP card to use the new connection.


## Usage
When the API deploys, you'll receive an HTTP API endpoint available at /searchLdap that will serve up the LDAP directory in a readonly fashion.
You simply need to invoke this endpoint with an HTTP GET request, with your LDAP search criteria in the "q" querystring variable.

Example:
https://api/searchLdap?q=(samaccountname=demo*) to pull back all objects with a samaccountname starting with "demo".

Example response:
```json
{
  "users": [
    {
      "name": "CN=Dan Cinnamon,OU=zimt people,DC=zimt,DC=us",
      "sn": [
        "Cinnamon"
      ],
      "givenName": [
        "Dan"
      ],
      "sAMAccountName": [
        "DanCinnamon"
      ],
      "userPrincipalName": [
        "dan.cinnamon@zimt.us"
      ]
    }
  ],
  "userCount": 1,
  "message": "Search Successful!"
}
```

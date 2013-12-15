# Socialcontrol

## About
Socialcontrol tracks Twitter users (members), grouped by any defined group. Think about politicians/parties, soccer players/teams, olympic athletes/national teams, etc.
Tweets are aggregated in real-time via the Twitter Streaming API and persisted to a MongoDB datastore.
[Socialitica](http://socialitica.info) is a working example of Socialcontrol.

## Quick Setup

	$ NODE_ENV=production forever start -w server.js
	$ NODE_ENV=production forever start -w aggregator.js
	$ sudo forever start -w router.js  // sudo required because it uses port 80

## Setup
There are two pieces for the Socialcontrol application: the aggregator and the web application.
The recommended method to keep these apps running is to use a long-running Node.js process manager like [Forever](https://github.com/nodejitsu/forever). 
	
	$ [sudo] npm install forever -g

There are two configurations: Development and Production. To specify the environment, use the `NODE_ENV` parameter when starting each process. For example: 
	
	$ NODE_ENV=production forever start -w server.js

If `NODE_ENV` is not specified the default Development configuration is used. 

### Aggregator
The aggregator opens a single connection to the [Twitter Streaming API](https://dev.twitter.com/docs/streaming-apis) and saves tweets from all members in the database.
The streaming API will frequently close the connection because of inactivity or other network disruption. 
The aggregator can can handle these circumstances, but requires a Node.js process manager like Forever to recover from fatal errors. 

To ensure we are saving tweets from **all** members, the aggregator restarts the stream at regular intervals (configured in config.js)
to check for any new members added.

	$ forever start -w aggregator.js 

### Web Application
The web application uses [Express](http://expressjs.com) to manage HTTP requests. Both the UI and RESTful API are powered with Express. 
Like the aggregator, the web application should be run using Forever. 

	$ forever start -w server.js

Once the web app is running, you can navigate to the tweet browser or the administrative pages. The admin section, and associated RESTful APIs, require authentication. 
In the case of the APIs, Basic Authentication is used with the encoded credentials passed in the header. 

	http://localhost:8081/
	http://localhost:8081/admin

To host more than one application on the server we will want to proxy incoming requests on port 80 to the application identified in the path of the request. We use [http-proxy](https://github.com/nodejitsu/node-http-proxy) to accomplish this.

	$ sudo forever start -w router.js

You can now load the site on port 80, and add additional applications with different paths in the future (/foo, /myapp, etc).

	http://localhost/
	http://localhost/admin


## RESTful API 
Most functionality for the site is exposed via a RESTful interface. 
Administrative API endpoints are protected with Basic Authentication. 
In the header of each HTTP request, pass the credentials like this:

	"Authorization" : "Basic <Encoded Username:Password>"

Here are examples that demonstrate each endpoint. 

### Get Tweets for all members
HTTP Method: `GET`  
`http://<root>/api/tweets`  
`http://<root>/api/tweets?count=20`  
`http://<root>/api/tweets?start=5&count=20`  
`http://<root>/api/tweets?page=0&count=20`  
**page** is turned into **start** by multiplying page + count. 

### Get Tweets for a single member
HTTP Method: `GET`  
`http://<root>/api/tweets/member/<screen_name>`  
`http://<root>/api/tweets/member/<screen_name>?count=20`  
`http://<root>/api/tweets/member/<screen_name>?start=5&count=20`  

### Get Tweets for a group
HTTP Method: `GET`  
`http://<root>/api/tweets/group/<shortCode>`
`http://<root>/api/tweets/group/<shortCode>?count=20`
`http://<root>/api/tweets/group/<shortCode>?start=5&count=20`

### Delete a single tweet
HTTP Method: `DELETE`  
`http://<root>/api/tweets/<id>`  
**Note:** We are using Twitter's `id_str` property as a unique ID, not `id`. 

### Get Entities  
Find groups and members that match a query.
HTTP Method: `GET`  
`http://<root>/api/entities?q=<query>`  

	{
		"isSuccessful": true,
		"message": "Search results for query on t.",
		"data": {
			"groups": [
				{
					"name": "Test Group #1",
					"shortCode": "0EySGv"
				},
				{
					"name": "Test Group #2",
					"shortCode": "ySgTlC"
				}
			],
			"members": [
				{
					"name": "The New York Times",
					"screen_name": "nytimes"
				},
				{
					"name": "The Guardian",
					"screen_name": "guardian"
				},
				{
					"name": "The Atlantic",
					"screen_name": "TheAtlantic"
				}
			]
		}
	}


### Get Group Template
Retrieve an empty group object to populate with group details for the Create and Update transactions.
HTTP Method: `GET`  
`http://<root>/api/group/template/`
	
	{
		name : '', 
		url : '',
		twitter : '',
		members : [],
	}

### Create Group
Create a new group.
HTTP Method: `POST`  
`http://<root>/api/group/`
	
	{
		name : 'Group Name',
		url : 'http://url/for/group',
		twitter : 'groupHandle',
		members : [ 'screen_name1', 'screen_name2' ]
	}

### Update Group
Update an existing group.
HTTP Method: `PUT`  
`http://<root>/api/group/<shortCode>`
	
	{
		shortCode : 'aBc123',
		name : 'Group Name',
		url : 'http://url/for/group',
		twitter : 'group_screen_name',
		members : [ 'screen_name1', 'screen_name2' ]
	}

### Retrieve a Group
Retrieve a specific group, identified by shortCode. If no shortCode provided, an array of all groups will be returned.
HTTP Method: `GET`  
`http://<root>/api/group/<shortCode>`
	
	{
		shortCode : 'aBc123',
		name : 'Group Name,
		url : 'http://url/for/group',
		twitter : 'group_screen_name',
		members : [],
		dateCreated : 'DATE EXAMPLE HERE',
		dateUpdated : 'DATE EXAMPLE HERE'
	}

### Delete a Group
Delete an existing group.
HTTP Method: `DELETE`  
`http://<root>/api/group/<shortCode>`
	
### Add Member(s) to Group
Add one or more members to an existing group.
HTTP Method: `POST`  
`http://<root>/api/group/<shortCode>/members`

	{ "members": ["screen_name1", "screen_name2"] }

### Remove Member from Group
Remove one member of a group, identified by their Twitter screen_name.
HTTP Method: `DELETE`  
`http://<root>/api/group/<shortCode>/members/<screen_name>`


## Dependencies

Most dependencies are included in the `lib` folder. Some are just easier to integrate if installed on the machine hosting the application. Dependencies which must be installed are listed below. 

### [Forever](https://github.com/nodejitsu/forever)
	$ [sudo] npm install forever -g

### [MongoDB](https://github.com/mongodb/node-mongodb-native)
	$ npm install mongodb
	
### [Express](http://expressjs.com)
	$ npm install express

	
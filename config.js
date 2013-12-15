/*!
 * Socialcontrol
 *
 * Copyright 2013 Enrico Berti and other contributors
 * Released under the MIT license
 * http://opensource.org/licenses/MIT
 *
 */
exports.config = function () {
  var config = {};
  // Determine which environment we're in
  var environment = (process.env.NODE_ENV) ? process.env.NODE_ENV.toLowerCase() : null;
  switch (environment) {
    case 'production':
    case 'prod':
      config = prodConfig;
      break;
    case 'development':
    case 'dev':
    default:
      config = devConfig;
      break;
  }

  // Add non-environment-specific settings
  config.partials = {
    default: {
      title: 'Socialcontrol'
      // ,head : './views/admin/head.hbs'
      , body: './views/default.hbs', script: './views/partial_defaultScript.hbs'
    },
    adminLogin: {
      title: 'Login'
      // ,head : './views/admin/head.hbs'
      , body: './views/admin/login.hbs'
      // ,script : './views/admin/adminScript.hbs'
    },
    adminGroups: {
      title: 'Groups'
      // ,head : './views/admin/head.hbs'
      , body: './views/admin/group.hbs', script: './views/admin/partial_adminScript.hbs'
    },
    adminMembers: {
      title: 'Members'
      // ,head : './views/admin/head.hbs'
      , body: './views/admin/members.hbs', script: './views/admin/partial_adminScript.hbs'
    }
  }

  return config;
}

var devConfig = {
  port: 8081,  // The port the express app will listen on
  twitter: {
    consumerKey: 'XXXXXX',  // OAuth consumer key for app, granted by Twitter
    consumerSecret: 'XXXXXX',  // OAuth consumer secret for app, granted by Twitter
    userToken: 'XXXXXX',  // OAuth token, granted by Twitter, for a specific user
    userTokenSecret: 'XXXXXX',  // OAuth token secret, granted by Twitter, for a specific user

    rootUrl: 'api.twitter.com',
    requestPath: '/oauth/request_token',
    authorizePath: '/oauth/authenticate?oauth_token={0}',
    tokenPath: '/oauth/access_token'
  },
  dbs: {
    socialcontrol: {
      dbHost: '127.0.0.1',
      dbPort: 12345,
      dbName: 'DBNAME',
      dbUsername: 'DBUSER',
      dbPassword: 'DBPASSWORD'
    }
  },
  cacheDuration: 900000,  // Duration to keep requests to db, Twitter, others cached (in ms)
  includeRelated: false,  // Retweets  of a user's tweets and replies to a user are included in the streaming API. This should probably just be kept false
  shortCodeLength: 6,  // Length of short code generated anywhere we need a unique id (group)
  adminUsername: 'admin',
  adminPassword: 'password',
  aggregatorRestartInterval: 1800000  // 30 minutes. Interval to restart the aggregator (in ms). This is done to ensure we're streaming from the latest list of members
}

var prodConfig = {
  port: 8081,  // The port the express app will listen on
  twitter: {
    consumerKey: 'XXXXXX',  // OAuth consumer key for app, granted by Twitter
    consumerSecret: 'XXXXXX',  // OAuth consumer secret for app, granted by Twitter
    userToken: 'XXXXXX',  // OAuth token, granted by Twitter, for a specific user
    userTokenSecret: 'XXXXXX',  // OAuth token secret, granted by Twitter, for a specific user

    rootUrl: 'api.twitter.com',
    requestPath: '/oauth/request_token',
    authorizePath: '/oauth/authenticate?oauth_token={0}',
    tokenPath: '/oauth/access_token'
  },
  dbs: {
    socialcontrol: {
      dbHost: '127.0.0.1',
      dbPort: 27017,
      dbName: 'DBNAME'
      //dbUsername: 'xxx',
      //dbPassword: 'yyy'
    }
  },
  cacheDuration: 900000,  // Duration to keep requests to db, Twitter, others cached (in ms)
  includeRelated: false,  // Retweets  of a user's tweets and replies to a user are included in the streaming API. This should probably just be kept false
  shortCodeLength: 6,  // Length of short code generated anywhere we need a unique id (group)
  adminUsername: 'admin',
  adminPassword: 'password',
  aggregatorRestartInterval: 1800000  // 30 minutes. Interval to restart the aggregator (in ms). This is done to ensure we're streaming from the latest list of members
}
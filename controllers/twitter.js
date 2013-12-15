/*!
 * Socialcontrol
 *
 * Copyright 2013 Enrico Berti and other contributors
 * Released under the MIT license
 * http://opensource.org/licenses/MIT
 *
 */

// https://dev.twitter.com/docs/rate-limiting/1.1
// *** https://dev.twitter.com/docs/api/1.1/post/statuses/filter
// https://dev.twitter.com/docs/streaming-apis/streams/public#Connections  // ONLY ONE CONNECTION TO PUBLIC API

var https = require('https');
var OAuth = require('../lib/node-oauth/oauth').OAuth;
var async = require('../lib/async');
var cache = require('../lib/node-cache');
var moment = require('../lib/moment');
var dataStore = require('./datastore');
var group = require('./group');
var c = require('../config').config();  // App configuration

/*** BEGIN STREAM FUNCTIONS ***/

// Constructor
function Stream() {
  this.observers = [];  // Array of observer functions to notify when a new tweet is available
  this.request = null;  // The HTTP request object, used to abort the stream later
  me = this;  // Help control scope.
}

// Function to add a new subscriber
Stream.prototype.subscribe = function (fn) {
  this.observers.push(fn);
};

// Function to remove a subscriber
Stream.prototype.unsubscribe = function (fn) {
  if (fn) {
    for (var ii = 0; ii < this.observers.length; ii++) {
      if (this.observers[ii] == fn) {
        this.observers.splice(ii, 1);
        break;
      }
    }
  } else {  // Remove all
    this.observers.length = 0;
  }
};

// Function to start a new Twitter stream
/*
 searchTerm: A keyword to track
 screen_names: Array of Twitter userIDs to filter on
 callback: Function invoked when the stream stops. callback(err)
 */
Stream.prototype.start = function (searchTerm, screen_names, callback) {
  var options = {
    headers: {},
    host: 'stream.twitter.com',
    path: '/1.1/statuses/filter.json',
    agent: false
  };

  if (searchTerm && searchTerm.length > 0) {
    options.path += '?track=' + encodeURIComponent(searchTerm);
    options.path += '&';
  } else {
    options.path += '?';
  }

  // build up delimited list of userIDs to track
  if (screen_names && screen_names.length > 0) {
    var followParam = '';
    screen_names.forEach(function (item, index, array) {
      followParam += item;
      if (index < (array.length - 1)) followParam += ',';
    });
    options.path += 'follow=' + followParam;
  } else {
    callback('Not enough usernames to filter on.');
  }
  options.path += '&filter_level=none';
  options.path += '&stall_warnings=true';
  options.method = 'POST';

  // Set the OAuth header for the HTTP request
  options.headers.Authorization = buildTwitterAuthHeader(options);

  // Start up the stream
  this.request = https.request(options, function (response) {
    response.on("data", function (chunk) {
      try {
        var tweet = JSON.parse(chunk);  // Each chunk is an individual tweet
        if (tweet.user) {  // Check this is a tweet, not another object from the firehose
          tweet = cleanupTweet(tweet, [searchTerm]);

          if (c.includeRelated || (!c.includeRelated && !tweet.retweeted_status && !tweet.in_reply_to_user_id)) { // Are we capturing replies and retweets?
            // Notify all observers of the new tweet
            for (var ii = 0; ii < me.observers.length; ii++) {
              me.observers[ii](tweet);
            }
          }
        } else if (tweet.warning) {  // stall warning. // https://dev.twitter.com/docs/streaming-apis/parameters#stall_warnings
          // TODO: do something with this?
          console.log(tweet.warning.message);
        } else {
          /* other statuses come from the Twitter API
          */
          console.log(JSON.stringify(tweet));
        }
      } catch (ex) {
        console.log('ERROR: ' + ex);
        callback(ex);
      }
    });

    // Handler once the request is complete
    response.on('end', function () {
      callback(null);
    });
  });
  this.request.end();  // Start the request
};

Stream.prototype.stop = function (callback) {
  // End (destroy) the https request
  try {
    this.request.destroy();
    callback(null);
  } catch (ex) {
    callback(ex);
  }
};

module.exports.Stream = Stream;

/*** END STREAM FUNCTIONS ***/


// Retrieve user object(s) for an array of screen_names
// https://dev.twitter.com/docs/api/1.1/get/users/lookup
exports.lookupUsers = function (names, callback) {
  // names is supposed to be an array: ['user1','user2']. Sanity check:
  names = [].concat(names);

  // Build up a collection of requests to Twitter
  var nameMaxCount = 100;  // the max number we want to send to Twitter at one time. 100 is the max
  var arRequests = [];
  var requestCount = Math.ceil(names.length / nameMaxCount);
  for (var ii = 0; ii < requestCount; ii++) {
    // The max count we can send to Twitter on each request
    arRequests.push(
      function (callback) {
        var queryNames = names.splice(0, nameMaxCount);
        buildUserRequest(queryNames, callback);
      }
    );
  }

  // Fire off each request, in series, building up list of users
  var users = [];
  async.series(arRequests, function (err, results) {
    if (err) {
      callback(err);
    } else {
      // Build up the response
      for (var ii = 0; ii < results.length; ii++) {
        if (results[ii]) {  // TODO: need better error handling.
          users = users.concat(results[ii]);
        }
      }
      callback(null, users);
    }
  });
};

exports.getTweets = function (screen_names, options, callback) {
  // Determine if the group detail should be included for each tweet.user
  if (options.includeGroup) {
    // Retrieve ALL members and their group info
    group.getMembers(null, false, function (err, members) {
      if (err) {
        callback(err);
      } else {
        // We have all members, now get the tweets
        dataStore.getTweets(screen_names, options.start, options.count, function (err, tweets) {
          // Populate group information for each user's tweet
          tweets.forEach(function (item, index, array) {
            var member = group.findMemberByScreenName(members, item.user.screen_name);
            if (member) {
              item.user.group = member.group;
              item.user.groupShortCode = member.groupShortCode;
            }
          });

          callback(null, tweets);
        });
      }
    });
  } else {
    dataStore.getTweets(screen_names, options.start, options.count, callback);
  }
};

exports.deleteTweet = function (ids, callback) {
  dataStore.deleteTweet(ids, callback);
};

// Build a request to the Twitter API for user object(s)
function buildUserRequest(names, callback) {
  var options = {
    host: c.twitter.rootUrl,
    path: '/1.1/users/lookup.json',
    headers: {},
    method: 'POST'
  };

  var nameParam = '';
  names.forEach(function (item, index, array) {
    nameParam += item;
    if (index < (array.length - 1)) nameParam += ',';
  });
  options.path += '?screen_name=' + nameParam;
  options.path += '&include_entities=false';

  options.headers.Authorization = buildTwitterAuthHeader(options);

  var url = options.host + options.path;

  // Check to see if we already have this result in cache
  // Using node-cache: https://github.com/ptarjan/node-cache
  var users = cache.get(url);  // Using the URL path as a key, check if cached response already exists
  if (users) {
    callback(null, users);
  } else {
    var json = '';  // String to build up API response
    var request = https.request(options,function (res) {
      // Handler for each chunk of data in the response from the API
      res.on('data', function (chunk) {
        json += chunk;  // Append this chunk
      });

      // Handler once the request to the API is complete
      res.on('end', function () {
        var data = JSON.parse(json);  // Turn the string into an object

        if (!data.errors) {
          cache.put(url, data, c.cacheDuration);  // Put this response in cache in case we need it later
          callback(null, data);
        }
        else {
          callback(data.errors[0], null);
        }
      });

    }).on('error', function (err) {
        console.log("Encountered error: " + err.message);
        callback(err.message);
      });
    request.end();  // Start the request
  }
}


// *** HELPER FUNCTIONS ***

// Function to refine the tweet object
function cleanupTweet(tweet, keywords) {

  var tweetDate = moment(tweet.created_at);
  tweet.created_display_short = tweetDate.format('MMM D HH:mm');
  tweet.created_display_long = tweetDate.format('MMM Do YYYY, HH:mm');
  tweet.created_display_time = tweetDate.format('HH:mm:ss');

  tweet.html = tweet.text;

  if (tweet.html) {  // some tweets are without text
    // Identify keywords
    for (var ii = 0; ii < keywords.length; ii++) {
      var regex = new RegExp('(' + keywords[ii] + ')', 'gi');
      tweet.html = tweet.html.replace(regex, '<span class="keyword">$1</span>');
    }

    // Clean up URLs
    if (tweet.entities && tweet.entities.urls && tweet.entities.urls.length > 0) {
      for (var ii = 0; ii < tweet.entities.urls.length; ii++) {
        tweet.html = tweet.html.replace(tweet.entities.urls[ii].url, '<a href="' + tweet.entities.urls[ii].expanded_url + '" target="_blank">' + tweet.entities.urls[ii].display_url + '</a>');
      }
    }

    // Clean up Media URLs
    if (tweet.entities && tweet.entities.media && tweet.entities.media.length > 0) {
      for (var ii = 0; ii < tweet.entities.media.length; ii++) {
        tweet.html = tweet.html.replace(tweet.entities.media[ii].url, '<a href="' + tweet.entities.media[ii].expanded_url + '" target="_blank">' + tweet.entities.media[ii].display_url + '</a>');
      }
    }

    // Clean up hashtags
    if (tweet.entities && tweet.entities.hashtags && tweet.entities.hashtags.length > 0) {
      for (var jj = 0; jj < tweet.entities.hashtags.length; jj++) {
        var regEx = new RegExp('#' + tweet.entities.hashtags[jj].text, "ig");  // Using regex to ensure find/replace is case-insensitive
        tweet.html = tweet.html.replace(regEx, '<a href="http://twitter.com/search?src=hash&q=%23' + tweet.entities.hashtags[jj].text + '" target="_blank">#' + tweet.entities.hashtags[jj].text + '</a>');
      }
    }

    // Clean up @mentions
    if (tweet.entities && tweet.entities.user_mentions && tweet.entities.user_mentions.length > 0) {
      for (var jj = 0; jj < tweet.entities.user_mentions.length; jj++) {
        var regEx = new RegExp('@' + tweet.entities.user_mentions[jj].screen_name, "ig");  // Using regex to ensure find/replace is case-insensitive
        tweet.html = tweet.html.replace(regEx, '<a href="http://twitter.com/' + tweet.entities.user_mentions[jj].screen_name + '" target="_blank" data-placement="top" data-toggle="tooltip" data-original-title="' + tweet.entities.user_mentions[jj].name + '">@' + tweet.entities.user_mentions[jj].screen_name + '</a>');
      }
    }
  }

  return tweet;
}


// Build up the OAuth header for an HTTP request to Twitter
function buildTwitterAuthHeader(options) {
  var oa = new OAuth(
    'http://' + c.twitter.rootUrl + c.twitter.requestPath,
    'http://' + c.twitter.rootUrl + c.twitter.tokenPath,
    c.twitter.consumerKey,
    c.twitter.consumerSecret,
    '1.0A',
    null,
    'HMAC-SHA1'
  );

  var authHeader = oa.authHeader('https://' + options.host + options.path, c.twitter.userToken, c.twitter.userTokenSecret, options.method);

  return authHeader;
}

// *** END HELPER FUNCTIONS ***
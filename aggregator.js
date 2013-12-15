/*!
 * Socialcontrol
 *
 * Copyright 2013 Enrico Berti and other contributors
 * Released under the MIT license
 * http://opensource.org/licenses/MIT
 *
 */
var twitter = require('./controllers/twitter');
var group = require('./controllers/group');
var dataStore = require('./controllers/datastore');
var c = require('./config').config();  // App configuration

var newStream = null;

// Handles setup for streaming/aggregating activities
function init() {
  // Create a new Twitter stream object
  newStream = new twitter.Stream();

  // Subscribe (observe) the stream. Function to handle each tweet
  newStream.subscribe(function (tweet) {
    console.log('[' + tweet.created_display_short + '] @' + tweet.user.screen_name + ': ' + tweet.text);
    dataStore.saveTweet(tweet);
  });
}

// Handles the actions needed to shutdown a stream
// We end the stream at regular intervals to check for new Twitter accounts which may have been added and need to be followed
function end() {
  if (newStream) {
    console.log('SHUTTING DOWN STREAM after inverval of ' + (c.aggregatorRestartInterval / 60000) + ' minutes to check for new Twitter users to follow.');
    newStream.stop(function (err) {
      if (err) {
        console.log(err);
        process.exit();
      } else {
        newStream.unsubscribe();
      }
    });
  }
}

// Retrieves the users to follow and starts up the Twitter stream
function aggregate() {
  // First, retrieve all the screen_names from all groups
  // Since we only care about screen_names, "getBio" is false
  group.getMembers(null, false, function (err, members) {
    console.log('\n\nSTARTING AGGREGATOR... following ' + members.length + ' users.');
    console.log('This process will restart in ' + (c.aggregatorRestartInterval / 60000) + ' minutes to check for new Twitter users to follow.');

    // Grab just the screen_names
    var screen_names = [];
    members.forEach(function (item, index, array) {
      screen_names.push(item.screen_name);
    });

    // Turn the list of screen_names into a list of user_ids
    twitter.lookupUsers(screen_names, function (err, users) {
      if (err) {
        console.log(err);
      } else {
        // Iterate through the list of users, building up a list of user_ids
        var userIDs = [];
        users.forEach(function (item, index, array) {
          userIDs.push(item.id);
        });

        // Fire up the stream
        newStream.start(null, userIDs, function (err) {
          if (!err) {
            console.log('Twitter stream has closed/ended.');
          } else {
            console.log('ERROR: ', err);
            process.exit();  // Most likely a fatal error, kill the process
          }
        });

      }
    });
  });
}

/*** START the Aggregator ***/
init();
aggregate();


// At regular intervals, reset the aggregator
setInterval(function () {
  end();
  init();
  aggregate();
}, c.aggregatorRestartInterval);

/*!
 * Socialcontrol
 *
 * Copyright 2013 Enrico Berti and other contributors
 * Released under the MIT license
 * http://opensource.org/licenses/MIT
 *
 */
var mongo = require('mongodb'),  // Init MongoDB library
  Db = mongo.Db;
var ObjectID = require('mongodb').ObjectID;
var c = require('../config').config();  // App configuration


/********** START TWITTER FUNCTIONS **********/

// Save a tweet
// No callback function (for now), this is purely fire-and-forget
exports.saveTweet = function (tweet) {
  Db.connect(buildMongoURL(), function (err, db) {
    if (!err) {
      db.collection('tweets', {safe: false}, function (err, collection) {
        collection.insert(tweet, {safe: false}, function (err, result) {
          if (err) {
            console.log('Encountered error saving tweet.');
          }
          db.close();
        });
      });
    } else {
      console.log(err);
      callback(err, null);
    }
  });
};

// Retrieve tweets for a list of screen_names/members
exports.getTweets = function (screen_names, start, count, callback) {
  // screen_names is supposed to be an array: ['user1','user2']. Sanity check:
  if (screen_names)
    screen_names = [].concat(screen_names);
  else
    screen_names = [];

  start = (!start) ? 0 : start;
  count = (!count) ? 5 : count;

  // Construct the query
  /*
   var query = { $or: [ {'user.screen_name' : {$in: screen_names}},
   {'retweeted_status.user.screen_name' : {$in: screen_names}}  // Re-tweeted status only included because the dataset for development required us to populate DB with retweets.
   ]
   };
   */
  var query = {};
  if (screen_names.length > 0)
    query = { 'user.screen_name': {$in: screen_names}};

  // Limit the fields we return (don't need everything)
  var projection = {
    '_id': 0,
    'id_str': 1,
    'user': 1,
    'user.screen_name': 1,
    'user.name': 1,
    'user.location': 1,
    'user.url': 1,
    'user.description': 1,
    'user.profile_image_url_https': 1,
    'text': 1,
    'html': 1,
    'created_display_short': 1,
    'created_display_long': 1,
    'created_at': 1
  };

  // Set options for the result-set
  var options = {
    'skip': start,
    'limit': count,
    'sort': { 'id': -1, 'user.screen_name': 1 }  // Sorting by 'id' *should* have same effect as sorting by date
  }

  // Query the tweets
  Db.connect(buildMongoURL(), function (err, db) {
    if (!err) {
      db.collection('tweets', {safe: false}, function (err, collection) {
        collection.find(query, projection, options).toArray(function (err, result) {
          db.close(function () {
            callback(err, result)
          });
        });
      });
    } else {
      console.log(err);
      callback(err, null);
    }
  });
};

// Delete a single tweet
exports.deleteTweet = function (ids, callback) {
  // ids is supposed to be an array: [123456, 789123456]. Sanity check:
  ids = [].concat(ids);

  Db.connect(buildMongoURL(), function (err, db) {
    if (!err) {
      db.collection('tweets', {safe: false}, function (err, collection) {

        // Create a query looking for this group
        var query = { 'id_str': {$in: ids} };

        collection.remove(query, function (err, result) {
          db.close(function () {
            callback(err, result)
          });
        });
      });
    } else {
      console.log(err);
      callback(err, null);
    }
  });
};

/********** END TWITTER FUNCTIONS **********/


/********** START GROUP FUNCTIONS **********/

// Save a group. This function will handle both create and update
exports.saveGroup = function (shortCode, group, callback) {
  group.dateUpdated = new Date();

  Db.connect(buildMongoURL(), function (err, db) {
    if (!err) {
      db.collection('groups', {safe: false}, function (err, collection) {

        // Mongo does not like updates to the _id. Remove it from this transaction if it exists
        delete group._id;

        // Create a query looking for this group
        var query = {'shortCode': shortCode};
        collection.findAndModify(query, [
          ['name', 'asc']
        ], { $set: group}, {safe: true, upsert: true, new: true}, function (err, result) {
          db.close(function () {
            callback(err, result)
          });
        });
      });
    } else {
      console.log(err);
      callback(err, null);
    }
  });
};

// Retrieve a single group or all groups.
exports.getGroup = function (shortCode, callback) {
  Db.connect(buildMongoURL(), function (err, db) {
    if (!err) {
      db.collection('groups', {safe: false}, function (err, collection) {

        // Create a query looking for this group
        var query = (shortCode && shortCode.length > 0) ? { 'shortCode': shortCode } : {};

        // Set options for the result-set
        var options = {
          'sort': { 'name': 1 }
        }

        collection.find(query, null, options).toArray(function (err, result) {
          db.close(function () {
            callback(err, result)
          });
        });
      });
    } else {
      console.log(err);
      callback(err, null);
    }
  });
};

// Delete a single group
exports.deleteGroup = function (shortCode, callback) {
  Db.connect(buildMongoURL(), function (err, db) {
    if (!err) {
      db.collection('groups', {safe: false}, function (err, collection) {

        // Create a query looking for this group
        var query = { 'shortCode': shortCode };

        collection.remove(query, function (err, result) {
          db.close(function () {
            callback(err, result)
          });
        });
      });
    } else {
      console.log(err);
      callback(err, null);
    }
  });
};

// Add members to a group
exports.addMembers = function (shortCode, members, callback) {
  if (!shortCode || shortCode.length == 0) {
    callback('You must specify a group to add a member.');
  } else {
    Db.connect(buildMongoURL(), function (err, db) {
      if (!err) {
        db.collection('groups', {safe: false}, function (err, collection) {

          // Create a query looking for this group
          var query = { 'shortCode': shortCode };

          collection.findAndModify(query, [
            ['name', 'asc']
          ], { $push: { members: { $each: members } } }, {safe: true, new: true}, function (err, result) {
            db.close(function () {
              callback(err, result)
            });
          });
        });
      } else {
        console.log(err);
        callback(err, null);
      }
    });
  }
};

// Remove a member from a group
exports.removeMember = function (shortCode, screen_name, callback) {
  if (!shortCode || shortCode.length == 0) {
    callback('You must specify a group from which to remove a member.');
  } else {
    Db.connect(buildMongoURL(), function (err, db) {
      if (!err) {
        db.collection('groups', {safe: false}, function (err, collection) {

          // Create a query looking for this group
          var query = { 'shortCode': shortCode };

          collection.findAndModify(query, [
            ['name', 'asc']
          ], { $pull: { 'members': { 'screen_name': screen_name } } }, {safe: true, new: true}, function (err, result) {
            db.close(function () {
              callback(err, result)
            });
          });
        });
      } else {
        console.log(err);
        callback(err, null);
      }
    });
  }
};

/********** END GROUP FUNCTIONS **********/


/********** HELPER FUNCTIONS **********/

// Build the connection string to the MongoDB instance for this application
function buildMongoURL() {
  var config = c.dbs.socialcontrol;
  if (config.dbUsername && config.dbPassword) {
    return 'mongodb://' + config.dbUsername + ':' + config.dbPassword + '@' + config.dbHost + ':' + config.dbPort + '/' + config.dbName + '?auto_reconnect=true&safe=true';
  } else {
    return 'mongodb://' + config.dbHost + ':' + config.dbPort + '/' + config.dbName + '?auto_reconnect=true&safe=true';
  }
}

/********** END HELPER FUNCTIONS **********/


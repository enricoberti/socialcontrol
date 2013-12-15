/*!
 * Socialcontrol
 *
 * Copyright 2013 Enrico Berti and other contributors
 * Released under the MIT license
 * http://opensource.org/licenses/MIT
 *
 */
var c = require('../config').config();  // App configuration
var dataStore = require('./datastore');
var twitter = require('./twitter');

// Retrieve one or all groups
exports.getGroup = function (shortCode, callback) {
  dataStore.getGroup(shortCode, function (err, groups) {
    if (err) {
      callback(err);
    } else {
      // Add the member count, used in mustache template
      groups.forEach(function (item, index, array) {
        item.memberCount = item.members.length;

      });

      callback(null, groups);
    }
  });
};

// Save a single group
exports.saveGroup = function (shortCode, group, callback) {
  // Verify all required pieces are present
  if (!shortCode || shortCode.lenth == 0) {
    callback('A short code must be provided to save a group.');
  } else if (!group) {
    callback('No group object provided to save.');
  } else {
    // jQuery can't POST and empty array. Make sure we save the members array
    if (!group.members) group.members = [];

    // Save the group
    dataStore.saveGroup(shortCode, group, callback);
  }
};

// Remove a single group
exports.deleteGroup = function (shortCode, callback) {
  // Verify all required pieces are present
  if (!shortCode || shortCode.length == 0) {
    callback('A short code must be provided to remove a group.');
  } else {
    // Remove the group
    dataStore.deleteGroup(shortCode, callback);
  }
};

// Add new member(s) to a group
exports.addMembers = function (shortCode, members, callback) {
  if (!shortCode || shortCode.length == 0) {
    callback('Did not specify a group to add member(s) to.');
  } else if (!members || members.length == 0) {
    callback('Did not provide member(s) to add.');
  } else {
    dataStore.addMembers(shortCode, members, function (err, data) {
      if (err) {
        callback(err);
      } else {
        callback(null, data);
      }
    });
  }
};

// Retrieve array of members for a group
// If no group is provided, all members/users are returned.
// getBio: true/false to retrieve member details from Twitter. // Since we only store the screen_name, we should use Twitter for additional details (name, etc) in most cases. 
exports.getMembers = function (shortCode, getBio, callback) {
  // Retrieve the group/groups
  dataStore.getGroup(shortCode, function (err, groups) {
    if (err) {
      callback(err);
    } else {
      // Build up a list of members across all retrieved groups
      var members = [];
      groups.forEach(function (item, index, array) {
        for (var ii = 0; ii < item.members.length; ii++) {
          members.push({
            screen_name: item.members[ii].screen_name,
            name: item.members[ii].name,
            group: item.name,
            groupShortCode: item.shortCode
          });
        }
      });

      // Determine if we should retrieve the user's bio/details from Twitter
      if (getBio) {
        // Build up a list of screen_names
        var screen_names = [];
        members.forEach(function (item, index, array) {
          screen_names.push(item.screen_name);
        });

        // Retrieve user objects for these screen_names
        twitter.lookupUsers(screen_names, function (err, users) {
          if (err) {
            callback(err);
          } else {
            // Match up these user's with their group information
            users.forEach(function (item, index, array) {
              var userGroup = findMemberByScreenName(members, item.screen_name);
              if (userGroup) {
                item.group = userGroup.group;
                item.groupShortCode = userGroup.groupShortCode;
              }
            });

            users.sort(sort_by('name', false, function (a) {
              return a.toUpperCase()
            }));

            callback(null, users);
          }
        });
      } else {  // !getBio
        members.sort(sort_by('screen_name', false, function (a) {
          return a.toUpperCase()
        }));
        callback(null, members);
      }
    }
  });
};

// Remove a single member
exports.removeMember = function (shortCode, member, callback) {
  // Verify all required pieces are present
  if (!shortCode || shortCode.length == 0) {
    callback('A short code must be provided to remove a member.');
  } else if (!member || member.length == 0) {
    callback('A member to remove must be supplied.');
  } else {
    // Remove the member
    dataStore.removeMember(shortCode, member, callback);
  }
};


exports.findMemberByScreenName = function (members, screen_name) {
  return findMemberByScreenName(members, screen_name);
};

// From a list of member objects, find one for a given screen_name
findMemberByScreenName = function (members, screen_name) {
  var member;
  for (var ii = 0; ii < members.length; ii++) {
    if (members[ii].screen_name.toLowerCase() == screen_name.toLowerCase()) {
      member = members[ii];
      break;
    }
  }

  return member;
}


// Sort an array of objects by a particular field
// http://stackoverflow.com/questions/979256/how-to-sort-an-array-of-javascript-objects
function sort_by(field, reverse, primer) {

  var key = function (x) {
    return primer ? primer(x[field]) : x[field]
  };

  return function (a, b) {
    var A = key(a), B = key(b);
    return (A < B ? -1 : (A > B ? 1 : 0)) * [1, -1][+!!reverse];
  }
}
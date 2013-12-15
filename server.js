/*!
 * Socialcontrol
 *
 * Copyright 2013 Enrico Berti and other contributors
 * Released under the MIT license
 * http://opensource.org/licenses/MIT
 *
 */
var Handlebars = require('./js/handlebars.min.js');
var fs = require('fs');  // File system access
var express = require('express');  // Express framework
var cache = require('./lib/node-cache');
var async = require('./lib/async');
var c = require('./config').config();  // App configuration
var group = require('./controllers/group');
var twitter = require('./controllers/twitter');
var models = require('./models/models');

/* Initialize Dependencies */
var app = express();
app.use(express.cookieParser());
app.use(express.session({secret: 'wKeWy9xO7KZChL0KQSeglq8Bo9fLi2fJjLjSaEvkFLd6C5WIXQI89wxJW14uACA'}));
app.use(express.bodyParser());

// Define paths for serving up static content. 
app.use('/css', express.static(__dirname + '/css'));
app.use('/js', express.static(__dirname + '/js'));
app.use('/img', express.static(__dirname + '/img'));
app.use('/font', express.static(__dirname + '/font'));

require('./controllers/templating').init();


/********** BEGIN UI HANDLERS **********/

// Handler to GET the default page
app.get('/', function (req, res) {
  var options = {
    count: 40,
    start: 0,
    includeGroup: true
  };

  twitter.getTweets(null, options, function (err, data) {
    var templateData = {
      title: c.partials.default.title,
      tweets: data
    };

    // Load the "master" template
    var mainTemplate = fs.readFileSync(__dirname + '/views/template.handlebars', 'utf8');
    mainTemplate = Handlebars.compile(mainTemplate.toString());

    loadPartials('default');

    // Merge them.
    var output = mainTemplate(templateData);
    res.end(output);
  });
});

// Handler to GET the main admin page, which will redirect to the group admin page
app.get('/admin', function (req, res) {
  // Default to the group page.
  if (req.session.referer) {
    res.redirect(req.session.referer);
  } else {
    res.redirect('/admin/group');
  }
});

// Handler to GET the login page
app.get('/admin/login', function (req, res) {
  var templateData = {
    title: c.partials.adminLogin.title
  };
  if (req.session.error && req.session.error.length > 0) {
    templateData.error = req.session.error;
  }

  // Load the "master" template
  var mainTemplate = fs.readFileSync(__dirname + '/views/admin/template.handlebars', 'utf8');
  mainTemplate = Handlebars.compile(mainTemplate.toString());

  loadPartials('adminLogin');

  // Merge them
  var output = mainTemplate(templateData);
  res.end(output);
});

// Handler to POST credentials for login. On success, the user is redirected to their original target
app.post('/admin/login', function (req, res) {
  authenticate(req.body.username, req.body.password, function (err) {
    if (!err) {
      req.session.auth = encodeCredentials(req.body.username, req.body.password);

      // Ensure there is a page to redirect to
      if (req.session.referer) {
        res.redirect(req.session.referer);
      } else {
        req.session.error = 'Authentication succeeded, but unknown page to redirect. Defaulting to group page.';
        res.redirect('/admin/group');
      }
    } else {
      if (err.length > 0) req.session.error = err;
      res.redirect('/admin/login');
    }
  });
});

// Handler to GET the group admin page
app.get('/admin/group', verifyUIAuth, function (req, res) {
  group.getGroup(req.query.shortcode, function (err, data) {
    var templateData = {
      title: c.partials.adminGroups.title,
      groups: data
    };

    // Load the "master" template
    var mainTemplate = fs.readFileSync(__dirname + '/views/admin/template.handlebars', 'utf8');
    mainTemplate = Handlebars.compile(mainTemplate.toString());

    loadPartials('adminGroups');

    // Merge them.
    var output = mainTemplate(templateData);
    res.end(output);
  });
});

// Handler to GET the members admin page
app.get('/admin/members', verifyUIAuth, function (req, res) {

  var templateData = {
    title: c.partials.adminMembers.title
  };

  // Retrieve all members
  group.getMembers(null, false, function (err, members) {
    templateData.members = members;

    group.getGroup(null, function (err, groups) {
      templateData.groups = groups;

      // Load the "master" template
      var mainTemplate = fs.readFileSync(__dirname + '/views/admin/template.handlebars', 'utf8');
      mainTemplate = Handlebars.compile(mainTemplate.toString());

      loadPartials('adminMembers');

      // Merge them.
      var output = mainTemplate(templateData);
      res.end(output);

    });
  });

});

/********** END UI HANDLERS **********/


/********** BEGIN RESTful API HANDLERS **********/

// Handler to return the client-side handlebars templates
app.get('/api/templates', function (req, res) {
  fs.readFile(__dirname + '/views/clientTemplates.hbs', 'utf8', function (err, msTemplate) {
    if (err) {
      console.log('Encountered error reading template.');
      res.end('Encountered error reading template. ' + JSON.stringify(err));
    } else {
      res.contentType('text/html');
      res.end(msTemplate);
    }
  });
});

// Handler to GET/search for members and groups
// Used by autocomplete
app.get('/api/entities', function (req, res) {
  var response = models.wrapper();

  var query = req.query.q;

  response.message = 'Search results for query on ' + query + '.';

  // Check to see if we already have this result in cache
  var allEntities = cache.get('all-entities');
  if (!allEntities) {  // Nothing found in cache
    // Retrieve groups and members
    // https://github.com/caolan/async#parallel
    async.parallel({
        groups: function (callback) {
          group.getGroup(null, callback);
        },
        members: function (callback) {
          group.getMembers(null, false, callback);
        }
      },
      function (err, results) {
        if (err) {
          response.isSuccessful = false;
          response.message = err;
          res.json(response);
        } else {
          cache.put('all-entities', results, c.cacheDuration);  // Put this response in cache in case we need it later
          response.data = findEntityMatches(results, query);
          res.json(response);
        }
      });
  } else {  // the "all entities" object found in cache
    response.data = findEntityMatches(allEntities, query);
    res.json(response);
  }
});

// Finds groups and members that match a query
function findEntityMatches(allEntities, query) {
  var matches = {
    groups: [],
    members: []
  };

  if (query && query.length > 0) query = query.toLowerCase();

  // Find Group Matches
  allEntities.groups.forEach(function (item, array, index) {
    if (item.name.toLowerCase().startsWith(query) || !query || query.length == 0) {
      matches.groups.push({ 'name': item.name, 'shortCode': item.shortCode, 'memberCount': item.memberCount });
    }
  });

  // Find Member Matches
  allEntities.members.forEach(function (item, array, index) {
    if (item.name.toLowerCase().startsWith(query) || item.screen_name.toLowerCase().startsWith(query) || !query || query.length == 0) {
      matches.members.push({ 'name': item.name, 'screen_name': item.screen_name, 'groupName': item.group, 'groupShortCode': item.groupShortCode });
    }
  });


  return matches;
}


// Handler to GET tweets for all members
app.get('/api/tweets', function (req, res) {
  getTweets(null, req, res);
});

// Handler to GET tweets for a single member
app.get('/api/tweets/member/:member', function (req, res) {
  getTweets(req.params.member, req, res);
});

// Handler to GET tweets for a group
app.get('/api/tweets/group/:shortCode', function (req, res) {
  // First, get all members for this short code
  group.getMembers(req.params.shortCode, false, function (err, members) {
    if (err) {
      var response = models.wrapper();
      response.message = 'Encountered error: ' + err + '.';
      response.isSuccessful = false;
      res.json(500, response);
    } else {
      // Create an array of JUST screen_names/members
      var screen_names = [];
      members.forEach(function (item, index, array) {
        screen_names.push(item.screen_name);
      });

      // Second, get tweets for these users
      getTweets(screen_names, req, res);
    }
  });
});

// Shared function to retrieve tweets
/* 
 The "accepts" header parameter is important on this request
 If accepts includes "html" the response will be be the HTML rendering of tweets
 Otherwise, we return json
 */
function getTweets(screen_names, req, res) {
  var response = models.wrapper();

  // Pull together the query options
  var options = {};
  options.count = (req.query.count) ? req.query.count : 10;
  if (req.query.page) {
    options.start = req.query.page * options.count;
  } else {
    options.start = (req.query.start) ? req.query.start : 0;
  }
  options.includeGroup = (req.query.includegroup && req.query.includegroup == 'true') ? true : null;

  // Retrieve the tweets
  twitter.getTweets(screen_names, options, function (err, data) {
    if (err) {
      response.message = 'Encountered error: ' + err + '.';
      response.isSuccessful = false;
      res.json(500, response);
    } else {
      // data will be an array of tweets
      // Determine if we're returning HTML or JSON
      if (req.headers.accept.indexOf('html') != -1) {  // incoming request wants tweets as HTML
        var templateData = {
          tweets: data
        };
        var tweetTemplate = fs.readFileSync(__dirname + '/views/partial_tweetRow.hbs', 'utf8');
        tweetTemplate = Handlebars.compile(tweetTemplate.toString());
        var html = tweetTemplate(templateData);
        res.contentType('text/html');
        res.end(html);
      } else {  // Response will be JSON
        if (data.length > 0)
          response.message = 'Successfully retrieved ' + data.length + ' tweets.';
        else
          response.message = 'Did not find any tweets.';

        response.data = data;
        res.json(200, response);
      }
    }
  });
};

// Handler to DELETE a tweet
app.delete('/api/tweets/:id', verifyAPIAuth, function (req, res) {
  var response = models.wrapper();
  var id = req.params.id;

  // Validate required properties are populated
  if (id && id.length > 0) { // Both are required
    twitter.deleteTweet(id, function (err, data) {
      if (err) {
        response.message = 'Encountered error: ' + err + '.';
        response.isSuccessful = false;
        res.json(500, response);
      } else {
        response.message = 'Successfully deleted tweet.';
        response.data = data;
        res.json(200, response);
      }
    });
  } else {
    response.message = 'Did not provide required properties to update a group. Did you mean to create a new group (HTTP POST)?';
    response.isSuccessful = false;
    res.json(400, response);
  }
});


// Handler to GET an empty group
app.get('/api/group/template', function (req, res) {
  var response = models.wrapper();
  response.data = models.group();
  response.message = 'Returned empty group model.';
  res.json(200, response);
});

// Handler to return the Admin client-side mustache templates
app.get('/api/admin/templates', function (req, res) {
  fs.readFile(__dirname + '/views/admin/clientTemplates.hbs', 'utf8', function (err, hbsTemplate) {
    if (err) {
      console.log('Encountered error reading template.');
      res.end('Encountered error reading template. ' + JSON.stringify(err));
    } else {
      res.contentType('text/html');
      res.end(hbsTemplate);
    }
  });
});

// Handler to CREATE a new group
app.post('/api/group', verifyAPIAuth, function (req, res) {
  var response = models.wrapper();
  var newGroup = req.body;

  // Validate required properties are populated
  if (newGroup.name) { // Anything else required?
    newGroup.dateCreated = new Date();
    if (!newGroup.shortCode || newGroup.shortCode.length == 0) newGroup.shortCode = generateShortCode(c.shortCodeLength);

    group.saveGroup(newGroup.shortCode, newGroup, function (err, data) {
      response.data = data;

      if (err) {
        response.message = 'Encountered error: ' + err + '.';
        response.isSuccessful = false;
        res.json(500, response);
      } else {
        response.message = 'Successfully added new group: ' + newGroup.name + '.';
        res.json(200, response);
      }
    });
  } else {
    response.message = 'Did not provide required properties to add a new group.';
    response.isSuccessful = false;
    res.json(400, response);
  }
});

// Handler to UPDATE a group
app.put('/api/group/:shortCode', verifyAPIAuth, function (req, res) {
  var response = models.wrapper();
  var shortCode = req.params.shortCode;
  var editGroup = req.body;

  // Validate required properties are populated
  if ((shortCode && shortCode.length > 0) && (editGroup.name && editGroup.name.length > 0)) { // For an update, both are required.
    group.saveGroup(shortCode, editGroup, function (err, data) {
      if (err) {
        response.message = 'Encountered error: ' + err + '.';
        response.isSuccessful = false;
        res.json(500, response);
      } else {
        response.message = 'Successfully added new group.';
        response.data = data;
        res.json(200, response);
      }
    });
  } else {
    response.message = 'Did not provide required properties to update a group. Did you mean to create a new group (HTTP POST)?';
    response.isSuccessful = false;
    res.json(400, response);
  }
});

// Handler to DELETE a group
app.delete('/api/group/:shortCode', verifyAPIAuth, function (req, res) {
  var response = models.wrapper();
  var shortCode = req.params.shortCode;

  // Validate required properties are populated
  if (shortCode && shortCode.length > 0) { // For an update, both are required
    group.deleteGroup(shortCode, function (err, data) {
      if (err) {
        response.message = 'Encountered error: ' + err + '.';
        response.isSuccessful = false;
        res.json(500, response);
      } else {
        response.message = 'Successfully deleted group.';
        response.data = data;
        res.json(200, response);
      }
    });
  } else {
    response.message = 'Did not provide required properties to update a group. Did you mean to create a new group (HTTP POST)?';
    response.isSuccessful = false;
    res.json(400, response);
  }
});

// Handler to GET a group.
app.get('/api/group/:shortCode', function (req, res) {
  getGroup(req.params.shortCode, req, res);
});
// Handler to GET all groups.
app.get('/api/group', function (req, res) {
  getGroup(null, req, res);
});

// Function to retrieve one group or all groups
function getGroup(shortCode, req, res) {
  var response = models.wrapper();

  group.getGroup(shortCode, function (err, data) {
    if (err) {
      response.message = 'Encountered error: ' + err + '.';
      response.isSuccessful = false;
      res.json(500, response);
    } else {
      // data will be an array of groups.
      if (data.length > 0)
        response.message = 'Successfully retrieved group/groups.';
      else
        response.message = 'Did not find group with shortCode ' + shortCode + '.';

      response.data = data;
      res.json(200, response);
    }
  });
}

// Handler to ADD member to group
app.post('/api/group/:shortCode/members', verifyAPIAuth, function (req, res) {
  var response = models.wrapper();
  var members = req.body.members;
  // members is supposed to be an array: { "members" : [ { name : 'foo', screen_name : 'foobar' }].
  if (members && members.length > 0) {
    group.addMembers(req.params.shortCode, members, function (err, data) {
      if (err) {
        response.message = 'Encountered error: ' + err + '.';
        response.isSuccessful = false;
        res.json(500, response);
      } else {
        response.message = 'Successfully added new members.';
        response.data = data;
        res.json(200, response);
      }
    });
  } else {
    response.message = 'Did not provide member(s) to add.';
    response.isSuccessful = false;
    res.json(400, response);
  }
});

// Handler to REMOVE member from group
app.delete('/api/group/:shortCode/members/:screenName', verifyAPIAuth, function (req, res) {
  var response = models.wrapper();

  group.removeMember(req.params.shortCode, req.params.screenName, function (err, data) {
    if (err) {
      response.message = 'Encountered error: ' + err + '.';
      response.isSuccessful = false;
      res.json(500, response);
    } else {
      response.message = 'Successfully removed ' + req.params.screenName + ' from ' + data.name + '.';
      response.data = data;
      res.json(200, response);
    }
  });
});

/********** END RESTful API HANDLERS **********/

app.listen(c.port);
console.log('Server started on port ' + c.port + '.')


/********** BEGIN AUTHENTICATION FUNCTIONS **********/

// Validate username/password.
function authenticate(username, password, callback) {
  // Check that a username/password was provided
  if (!username || username.length == 0 || !password || password.length == 0) {
    callback('Both username and password must be provided.');
  } else if (encodeCredentials(username, password) === encodeCredentials()) { // Simple authentication. Validate the username and password match what's in the config file
    callback(null);
  } else {
    callback('Incorrect username or password.');
  }
}

// Verify the user has a valid session. 
function verifyUIAuth(req, res, next) {
  req.session.referer = req.route.path;
  if (req.session.auth) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/admin/login');
  }
}

// Verify the API request has a valid session
function verifyAPIAuth(req, res, next) {
  var response = models.wrapper();
  var authHeader = req.headers['authorization'];

  if (req.session.auth || (authHeader && (authHeader == 'Basic ' + encodeCredentials()))) {
    next();
  } else {
    response.message = 'Unauthorized request. Use basic authentication to pass credentials to the API.';
    response.isSuccessful = false;
    res.json(401, response);
  }
}

// base64 encode credentials
function encodeCredentials(username, password) {
  username = (username) ? username.toLowerCase() : c.adminUsername;
  password = (password) ? password : c.adminPassword;

  var auth = new Buffer(username + ':' + password).toString('base64');
  return auth;
}

/********** END AUTHENTICATION FUNCTIONS **********/


/********** BEGIN HELPER FUNCTIONS **********/

// Load the Handlebars partials from a configuration
function loadPartials(name) {
  var def = c.partials[name];

  if (def) {

    // Load the "head" template
    if (def.head) {
      var headTemplate = fs.readFileSync(def.head, 'utf8');
      Handlebars.registerPartial('head', headTemplate.toString());
    } else {
      Handlebars.registerPartial('head', ' ');
    }

    // Load the "body" template
    if (def.body) {
      var bodyTemplate = fs.readFileSync(def.body, 'utf8');
      Handlebars.registerPartial('body', bodyTemplate.toString());
    } else {
      Handlebars.registerPartial('body', ' ');
    }

    // Load the script to include on the page.
    if (def.script) {
      var scriptTemplate = fs.readFileSync(def.script, 'utf8');
      Handlebars.registerPartial('script', scriptTemplate.toString());
    } else {
      Handlebars.registerPartial('script', ' ');
    }
  }
}


// Function to generate a short code
function generateShortCode(len) {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  var code = '';
  for (var ii = 0; ii < len; ii++) {
    var rand = Math.floor(Math.random() * chars.length);
    code += chars[rand];
  }

  return code;
}

// Add "startsWith" to the string
if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str) {
    if (str && str.length > 0) return this.slice(0, str.length) == str;
  };
}


/********** END HELPER FUNCTIONS **********/


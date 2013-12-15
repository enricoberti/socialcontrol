/*!
 * Socialcontrol
 *
 * Copyright 2013 Enrico Berti and other contributors
 * Released under the MIT license
 * http://opensource.org/licenses/MIT
 *
 */
// Handles initialization and other tasks for templating engine (currently Handlebars)

var Handlebars = require('../js/handlebars.min.js');
var moment = require('../lib/moment');
var fs = require('fs');  // File system access

// Setup common templating functionality
exports.init = function () {

  Handlebars.registerHelper('unix', function (context) {
    var _m = moment(context);
    return _m.valueOf();
  });

  Handlebars.registerHelper('americanDate', function (context) {
    var _m = moment(context);
    return _m.format('MM/DD/YYYY HH:mm');
  });

  Handlebars.registerHelper('europeanDate', function (context) {
    var _m = moment(context);
    return _m.format('DD/MM/YYYY HH:mm');
  });

  // Define Handlebars helper to ensure each row of tweets has the proper number of tweets
  var twRow = 4;  // Indicates how many tweets should appear on each row.
  var twSpan = 12 / twRow;  // Matches the "spanN" class used for each tweet container in the template. Currently 3
  Handlebars.registerHelper('tweetRow', function (context, options) {
    var ret = '';
    try {
      for (var ii = 0; ii < context.length; ii++) {
        if (ii % twRow == 0) {  // New row.
          ret += '<div class="row-fluid tweet">';
        }
        ret += options.fn(context[ii]);

        if ((ii == (context.length - 1)) && ((ii % twRow != (twRow - 1)))) {  // If I'm at the end of my tweets and have not finished out a row
          ret += '<div class="span' + (12 - ((ii + 1) % twRow * twSpan)) + '"></div>';
        }

        if ((ii == (context.length - 1)) || ((ii + 1) % twRow == 0)) {  // End of a row
          ret += '</div>';
        }
      }
    } catch (ex) {

    }

    return ret;
  });

  var tweetTemplate = fs.readFileSync('./views/partial_tweetRow.hbs', 'utf8');
  Handlebars.registerPartial('tweets', tweetTemplate);
};

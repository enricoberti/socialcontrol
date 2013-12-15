/*!
 * Socialcontrol
 *
 * Copyright 2013 Enrico Berti and other contributors
 * Released under the MIT license
 * http://opensource.org/licenses/MIT
 *
 */
var ROOTURL = window.location.origin;
var tweetCount = 40;  // The number of tweets to retrieve at a time
var lastTweetRequest = { // Contains details about the last request for tweets
  url: '/api/tweets'
};
var allEntities;  // Will contain all members and groups

$(document).ready(function () {
  initScrolling();
  initEntitySearch();
});


// Attach handler to load more tweets as the user scrolls
// https://github.com/paulirish/infinite-scroll
function initScrolling(reset) {

  if (reset) {
    $('#tweetContainer').infinitescroll('destroy'); // Destroy
    $('#tweetContainer').data('infinitescroll', null);
  }

  $('#tweetContainer').infinitescroll({
    loading: {
      finishedMsg: 'No additional tweets found.',
      img: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///////yH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',  // just an empty image.
      msgText: $('#loadingMsg').html()
    },
    navSelector: '#next:last',
    nextSelector: 'a#next:last',
    itemSelector: 'div.row-fluid',
    debug: false,
    animate: false,
    bufferPx: 50,
    dataType: 'html',
    // maxPage : 3,
    errorCallback: function () {
    },
    path: function (page) {
      return lastTweetRequest.url + '?page=' + --page + '&count=' + tweetCount + '&includegroup=true';
    }
  });
}

// Preload ALL groups and members to search against
function initEntitySearch() {
  $.ajax({
    url: ROOTURL + '/api/entities',
    method: 'GET',
    dataType: 'json',
    data: {},
    success: function (response) {
      allEntities = response.data;

      // Bind event handler for searching categories
      $('#txtSearch').keyup(function (event) {
        var searchTerm = $('#txtSearch').val();

        if (event.which == 13) {
          event.preventDefault();
        } else if (searchTerm.length > 0) {
          var result = queryEntities(allEntities, $('#txtSearch').val());

          // Limit the number of results displayed
          if (result.members.length > 10) {
            result.members = result.members.splice(0, 10);
          }
          if (result.groups.length > 10) {
            result.groups = result.groups.splice(0, 10);
          }

          // Display the results
          if (result.groups.length > 0 || result.members.length > 0) {
            // Render the tweets using a Handlebars template
            var template = Handlebars.compile($('#searchTemplate').html());
            var html = template(result);

            // Append the results to display.
            $('#entitySearchMenu').html(html);

            if ($('#entitySearchMenu').css('display') == 'none')
              $('#btnSearchToggle').dropdown('toggle');
          } else {
            if ($('#entitySearchMenu').css('display') == 'block')
              $('#btnSearchToggle').dropdown('toggle');
          }
        } else {
          if ($('#entitySearchMenu').css('display') == 'block')
            $('#btnSearchToggle').dropdown('toggle');
        }
      });

      $('#txtSearch').removeAttr('disabled');
    },
    error: function (ex) {
      console.log(ex);
      // TODO: do something with this.
    },
    complete: function () {
    }
  });
}

// Search for entities that match the query
// entities will contain two objects: groups, members
function queryEntities(entities, query) {
  var result = {
    groups: [],
    members: []
  };

  if (query && query.length > 0) query = query.toLowerCase();

  // Find Group Matches
  entities.groups.forEach(function (item, array, index) {
    if (item.name.toLowerCase().indexOf(query) != -1) {
      result.groups.push(item);
    }
  });

  // Find Member Matches
  entities.members.forEach(function (item, array, index) {
    if (item.name.toLowerCase().indexOf(query) != -1 || item.screen_name.toLowerCase().indexOf(query) != -1) {
      result.members.push(item);
    }
  });

  return result;
}

// Fires a new search for tweets based on member or group
// item: an item from the autocomplete, will contain a group shortcode or member screen_name
function searchTweets(item) {
  $('#txtSearch').val($(item).data('name'));
  var url = '/api/tweets';

  // determine what type of query we're performing
  if ($(item).data('shortcode')) { // Member group
    url += '/group/' + $(item).data('shortcode');
  } else if ($(item).data('screen_name')) {  // Member
    url += '/member/' + $(item).data('screen_name');
  }
  lastTweetRequest.url = url;  // save this url for pagination/scrolling later

  $('#tweetContainer').html($('#loadingMsg').html());  // Display a loading message

  $.ajax({
    url: ROOTURL + url,
    method: 'GET',
    dataType: 'html',
    data: { 'count': tweetCount, 'includegroup': true },
    success: function (response) {
      $('#tweetContainer').html(response);
      initScrolling(true);
    },
    error: function (ex) {
      console.log(ex);
      // TODO: do something with this.
    },
    complete: function () {
    }
  });

}



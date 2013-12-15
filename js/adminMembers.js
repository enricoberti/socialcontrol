/*!
 * Socialcontrol
 *
 * Copyright 2013 Enrico Berti and other contributors
 * Released under the MIT license
 * http://opensource.org/licenses/MIT
 *
 */
$(document).ready(function () {

  // Handler when the "add Member" button is clicked
  $(document).on('click', '#btnAddMember', function () {
    var members = [];
    members.push({ 'name': $('#newModal .txtName').val(), 'screen_name': $('#newModal .txtScreenName').val() });
    var shortCode = $('#newModal .ddlGroup').val();

    // Save it!
    saveMember(shortCode, members, function (err, response) {
      if (err) {
        //TODO: Handle this.
      } else {
        window.location.href = '/admin/members';
      }
    });
  });

  // Handler to populate "edit member" form
  $(document).on('click', '.editMember', function () {
    // Populate the edit modal with group details.
    $('#editModal .txtTwitterName').val($(this).data('screen_name'));
    $('#editModal .txtName').val($(this).data('name'));
    $('#editModal .ddlGroup').val($(this).data('shortcode'));
    $('#editModal .hidOldGroup').val($(this).data('shortcode'));
  });

  // Handler when the "Update Member" button is clicked
  $(document).on('click', '#btnEditMember', function () {
    var screen_name = $('#editModal .txtTwitterName').val();
    var name = $('#editModal .txtName').val();
    var shortCode = $('#editModal .ddlGroup').val();
    var oldShortCode = $('#editModal .hidOldGroup').val();

    // First, delete from existing group
    $.ajax({
      url: '/api/group/' + oldShortCode + '/members/' + screen_name,
      method: 'DELETE',
      dataType: 'json',
      success: function (response) {
        // Second, Re-add the member
        var members = [];
        members.push({ 'name': name, 'screen_name': screen_name});
        saveMember(shortCode, members, function (err, response) {
          if (err) {
            // TODO: Handle this.
          } else {
            window.location.href = '/admin/members';
          }
        });
      },
      error: function (ex) {
        console.log(ex);
      },
      complete: function () {
      }
    });
  });

  // Handler to populate the "delete group" form
  $(document).on('click', '.deleteMember', function () {
    $('#deleteModal #deleteMemberName').text($(this).data('name') + ' (' + $(this).data('screen_name') + ')');
    $('#deleteModal #hidScreenName').val($(this).data('screen_name'));
    $('#deleteModal #hidGroupShortCode').val($(this).data('shortcode'));
  });

  // Handler when the "Delete Group" button is clicked
  $(document).on('click', '#btnDeleteMember', function () {
    var screen_name = $('#deleteModal #hidScreenName').val();
    var shortCode = $('#deleteModal #hidGroupShortCode').val();

    $.ajax({
      url: '/api/group/' + shortCode + '/members/' + screen_name,
      method: 'DELETE',
      dataType: 'json',
      success: function (response) {
        window.location.href = '/admin/members';
      },
      error: function (ex) {
        // TODO: What to do here?
        console.log(ex);
      },
      complete: function () {
      }
    });
  });

  $('#tweetsModal').on('show', function () {
    $('#tweetsModal #tweetsContainer').html('<i class="icon-fire"></i> Loading...');
  });

  // Handler when the "view tweets" button is clicked
  $(document).on('click', '.viewTweets', function () {
    var screen_name = $(this).data('screen_name');
    $('#tweetsModal #memberName').text($(this).data('name'));
    $('#tweetsModal #memberScreenName').text('@' + screen_name);

    // Retrieve the tweets for this member
    $.ajax({
      url: '/api/tweets/member/' + screen_name,
      method: 'GET',
      dataType: 'json',
      success: function (response) {
        // Render the tweets using a Handlebars template
        var template = Handlebars.compile($('#adminTweetTemplate').html());
        var html = template(response.data);
        $('#tweetsModal #tweetsContainer').html(html);
      },
      error: function (ex) {
        // TODO: What to do here?
        console.log(ex);
      },
      complete: function () {
      }
    });
  });

  // Handler when the "delete tweet" button is clicked
  $(document).on('click', '.deleteTweet', function () {
    var tweetId = $(this).data('tweetid');

    // Delete this tweet.
    $.ajax({
      url: '/api/tweets/' + tweetId,
      method: 'DELETE',
      dataType: 'json',
      success: function (response) {
        // Remove this tweet from the DOM
        $('#' + tweetId).remove();
      },
      error: function (ex) {
        // TODO: What to do here?
        console.log(ex);
      },
      complete: function () {
      }
    });
  });

  // Add member filtering
  $('#txtSearchQuery').on('change keyup', function () {
    var query = $('#txtSearchQuery').val().toLowerCase();
    $('#memberTable > tbody > tr').each(function () {
      if ($(this).data('name').toLowerCase().indexOf(query.toLowerCase()) != -1 || $(this).data('screen_name').toLowerCase().indexOf(query.toLowerCase()) != -1) {
        $(this).show();
      } else {
        $(this).hide();
      }
    });
  });

});

// Generic function to add/edit a member.
function saveMember(shortCode, members, callback) {
  var postData = {
    'members': members
  };
  console.log(postData);
  $.ajax({
    url: '/api/group/' + shortCode + '/members',
    method: 'POST',
    dataType: 'json',
    data: postData,
    success: function (response) {
      callback(null, response);
    },
    error: function (ex) {
      callback(ex);
    },
    complete: function () {
    }
  });
}

// Add functionality for "starts with". 
if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str) {
    return this.slice(0, str.length) == str;
  };
}

/*!
 * Socialcontrol
 *
 * Copyright 2013 Enrico Berti and other contributors
 * Released under the MIT license
 * http://opensource.org/licenses/MIT
 *
 */
var groupTemplate;  // To be populated with a new (empty) group criteria

$(document).ready(function () {

  // Handler when the "add group" button is clicked
  $(document).on('click', '#btnAddGroup', function () {
    // Populate new group object
    var newGroup = $.extend({}, groupTemplate);
    newGroup.name = $('#newModal .txtGroupName').val();
    newGroup.url = $('#newModal .txtGroupURL').val();
    newGroup.twitter = $('#newModal .txtGroupTwitter').val();

    // Save it!
    saveGroup(newGroup, function (err, response) {
      window.location.href = '/admin/group';
    });
  });

  // Handler to populate "edit group" form
  $(document).on('click', '.editGroup', function () {
    // Populate the edit modal with group details
    $('#editModal .txtGroupName').val($(this).data('name'));
    $('#editModal .txtGroupURL').val($(this).data('url'));
    $('#editModal .txtGroupTwitter').val($(this).data('twitter'));
    $('#editModal .txtGroupShortCode').val($(this).data('shortcode'));
  });

  // Handler when the "Update Group" button is clicked
  $(document).on('click', '#btnEditGroup', function () {
    // Populate a group object
    var group = $.extend({}, groupTemplate);
    group.name = $('#editModal .txtGroupName').val();
    group.url = $('#editModal .txtGroupURL').val();
    group.twitter = $('#editModal .txtGroupTwitter').val();
    group.shortCode = $('#editModal .txtGroupShortCode').val();

    saveGroup(group, function (err, response) {
      window.location.href = '/admin/group';
    });
  });

  // Handler to populate the "delete group" form
  $(document).on('click', '.deleteGroup', function () {
    $('#deleteModal #deleteGroupName').text($(this).data('name'));
    $('#deleteModal .txtGroupShortCode').val($(this).data('shortcode'));
  });

  // Handler when the "Delete Group" button is clicked
  $(document).on('click', '#btnDeleteGroup', function () {
    $.ajax({
      url: '/api/group/' + $('#deleteModal .txtGroupShortCode').val(),
      method: 'DELETE',
      dataType: 'json',
      success: function (response) {
        window.location.href = '/admin/group';
      },
      error: function (ex) {
        // TODO: What to do here?
        console.log(ex);
      },
      complete: function () {
      }
    });
  });


  $('#editModal').on('show', function () {

  });


  // Load the template for an empty group object
  $.ajax({
    url: '/api/group/template',
    method: 'GET',
    dataType: 'json',
    data: {},
    success: function (response) {
      groupTemplate = response.data;
    },
    error: function (ex) {
      console.log(ex);
    },
    complete: function () {
    }
  });

});

// Generic function to add/edit a group
function saveGroup(group, callback) {
  // Determine if we're saving a new group or editing an existing one
  var url = '/api/group';
  var method = 'POST';
  if (group.shortCode && group.shortCode.length > 0) {
    method = 'PUT';
    url += '/' + group.shortCode;
  }

  $.ajax({
    url: url,
    method: method,
    dataType: 'json',
    data: group,
    success: function (response) {
      callback(null, response);
    },
    error: function (ex) {
      console.log(ex);
      callback(ex);
    },
    complete: function () {
    }
  });
}

/*!
 * Socialcontrol
 *
 * Copyright 2013 Enrico Berti and other contributors
 * Released under the MIT license
 * http://opensource.org/licenses/MIT
 *
 */
exports.group = function () {

  var obj = {
    // shortCode : null,  // short string to identify group commented out to hide from consumers.
    name: null,
    url: null,
    twitter: null,
    members: []
    // , dateCreated : new Date()
    // , dateUpdated : new Date()
  }

  return obj;
};

exports.wrapper = function () {

  var obj = {
    isSuccessful: true,
    message: null,
    data: {}
  }

  return obj;
};
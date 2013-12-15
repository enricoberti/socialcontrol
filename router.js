/*!
 * Socialcontrol
 *
 * Copyright 2013 Enrico Berti and other contributors
 * Released under the MIT license
 * http://opensource.org/licenses/MIT
 *
 */
// https://github.com/nodejitsu/node-http-proxy
var httpProxy = require('http-proxy');

var PATH_REGEX = /^\/([a-zA-Z0-9]+).*$/;

// Create a proxy server with custom application logic
var server = httpProxy.createServer(function (req, res, proxy) {

  // Grab the first 'directory' from the URL path
  var pathParts = req.url.match(PATH_REGEX);

  // Check if we have something. This identifies the application we should route to
  var app = '';
  if (pathParts && pathParts.length > 0) app = pathParts[1];

  // Determine where to send this request.
  switch (app.toLowerCase()) {

    // To add additional applications, use this pattern:
    /*
     case 'pathName' :  // The first "part" of the path off the root. For instance: if path was /foo/bar, the "pathName" would be "foo".
     proxy.proxyRequest(req, res, {
     host: '127.0.0.1',
     port: 8081  // The port this app is listening on.
     });
     break;
     */

    default: // Homepage
      proxy.proxyRequest(req, res, {
        host: '127.0.0.1',
        port: 8081
      });
      break;
  }

});

server.listen(80);

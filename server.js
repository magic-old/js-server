'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _path = require('path');

var _fsExtra = require('fs-extra');

var _http = require('http');

var _glob = require('glob');

var _mime = require('mime');

var _mime2 = _interopRequireDefault(_mime);

var _logger = require('logger');

var _logger2 = _interopRequireDefault(_logger);

var MagicServer = (function () {
  function MagicServer() {
    var config = arguments.length <= 0 || arguments[0] === undefined ? (0, _path.join)(process.cwd(), 'config.js') : arguments[0];

    _classCallCheck(this, MagicServer);

    this.config = typeof config === 'string' ? require(config) : config;

    var _config = this.config;
    var dirs = _config.dirs;
    var files = _config.files;
    var server = _config.server;

    var dir = (0, _path.join)(dirs.out, '**', server.files);
    (0, _logger2['default'])('collecting files in ' + dir);

    var globbed = (0, _glob.sync)(dir, { nodir: true });
    (0, _logger2['default'])('found ' + globbed.length + ' files');

    var collectedFiles = this.collectFiles(globbed);
    this.serve(collectedFiles);
  }

  _createClass(MagicServer, [{
    key: 'collectFiles',
    value: function collectFiles(globbed) {
      var out = this.config.dirs.out;

      var collectedFiles = {};
      globbed.forEach(function (file) {
        collectedFiles[file.replace(out, '')] = {
          content: (0, _fsExtra.readFileSync)(file),
          mime: _mime2['default'].lookup(file)
        };
      });

      return collectedFiles;
    }
  }, {
    key: 'serve',
    value: function serve(files) {
      var _config2 = this.config;
      var CNAME = _config2.CNAME;
      var port = _config2.port;

      (0, _logger2['default'])('start server on ' + CNAME + ':' + port);

      var server = this.runServer(files);

      // Listen to port set in config
      server.listen(port, function () {
        _logger2['default'].success('server listening to localhost:' + port);
      });
    }
  }, {
    key: 'error404',
    value: function error404(url, res) {
      _logger2['default'].error('could not find file with url: ' + url);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    }
  }, {
    key: 'runServer',
    value: function runServer(files) {
      var _this = this;

      return (0, _http.createServer)(function (req, res) {
        // Get startTime for logging
        var startTime = process.hrtime();

        var url = _this.getUrl(req.url, files);

        var file = _this.getFile(req, res, files);

        // 404 if file is empty
        if (!file || !file.content || !file.mime) {
          return _this.error404(url, res);
        }

        // Set the Content-Type to the mime of the uncompressed file
        res.setHeader('Content-Type', file.mime);
        console.log('file mime: ' + file.mime);

        // End the response with the file contents
        res.end(file.content);

        var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        var endTime = process.hrtime(startTime);
        _logger2['default'].request(ip, url, startTime, endTime);
      });
    }
  }, {
    key: 'getUrl',
    value: function getUrl(url, files) {
      var _config3 = this.config;
      var menuItems = _config3.menuItems;
      var pageItems = _config3.pageItems;

      // replace trailing slash with empty string
      if (url.length > 1 && url.substr(url.length - 1) === '/') {
        url = url.substr(0, url.length - 1);
      }

      var isLocalUrl = !!menuItems && menuItems.filter(function (item) {
        return item.href === url || item.href.replace('#', '/') === url;
      }).length;

      var isPageUrl = !!pageItems && Object.keys(pageItems).filter(function (key) {
        return key === url;
      }).length;

      // Return index.html for client side urls and root
      // ♥ = %E2%99%A5
      if (isLocalUrl) {
        url = '/index.html';
      } else if (isPageUrl) {
        var pageItemUrl = pageItems[url];
        var pageItemFile = files[pageItemUrl];

        if (pageItemFile && pageItemFile.mime) {
          url = pageItemUrl;
        }
      }

      return url;
    }
  }, {
    key: 'getFile',
    value: function getFile(req, res, files) {
      var url = this.getUrl(req.url, files);
      var file = files[url];

      // Check if client accepts gzip
      var zipped = req.headers['accept-encoding'].indexOf('gzip') > -1;

      // If accepted, set Content-Encoding and add .gz to url
      if (zipped) {
        var testUrl = url + '.gz';
        if (files[testUrl] && files[testUrl].content) {
          res.setHeader('Content-Encoding', 'gzip');
          file.content = files[testUrl].content;
        }
      }
      return file;
    }
  }]);

  return MagicServer;
})();

exports['default'] = new MagicServer();
module.exports = exports['default'];
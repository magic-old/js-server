import {join} from 'path';
import {readdirSync, readFileSync, statSync} from 'fs-extra';
import {createServer} from 'http';
import {sync} from 'glob';
import mime from 'mime';
import log from 'logger';

class MagicServer {
  constructor(configPath = join(process.cwd(), 'config.js')) {
    this.config = require(configPath);

    const {dirs, files, server} = this.config;

    const dir = join(dirs.out, '**', server.files);
    log(`collecting files in ${dir}`);

    const globbed = sync(dir, {nodir: true});
    log(`found ${globbed.length} files`);

    const collectedFiles = this.collectFiles(globbed);
    this.serve(collectedFiles);
  }

  collectFiles(globbed) {
    const {out} = this.config.dirs;
    let collectedFiles = {};
    globbed.forEach((file) => {
      collectedFiles[file.replace(out, '')] = {
        content: readFileSync(file),
        mime: mime.lookup(file),
      };
    });

    return collectedFiles;
  }

  serve(files) {
    const {CNAME, port, menuItems, pageItems} = this.config;
    log(`start server on ${CNAME}:${port}`);

    createServer((req, res) => {
      // Get startTime for logging
      const startTime = process.hrtime();

      let url = req.url;

      // replace trailing slash with empty string
      if(url.length > 1 && url.substr(url.length - 1) === '/') {
        url = url.substr(0, url.length - 1);
      }

      const isLocalUrl = !!menuItems && menuItems.filter(item => {
        return item.href === url || item.href.replace('#', '/') === url;
      }).length;

      const isPageUrl = !!pageItems && Object.keys(pageItems).filter(key => key === url).length;

      let file = files[url];

      // Return index.html for client side urls and root
      // ♥ = %E2%99%A5
      if (isLocalUrl) {
        url = '/index.html';
        file = files[url];
      } else if (isPageUrl) {
        const pageItemUrl = pageItems[url];
        const pageItemFile = files[pageItemUrl];

        if (pageItemFile && pageItemFile.mime) {
          url = pageItemUrl;
          file = pageItemFile;
        }
      }

      // 404 if file is empty
      if (!file || !file.content) {
        return this.error404(url, res);
      }

      // Get original file mimetype
      const {mime} = file;

      let zippedFile = null;

      // Check if client accepts gzip
      const zipped = req.headers['accept-encoding'].indexOf('gzip') > -1;

      // If accepted, set Content-Encoding and add .gz to url
      if (zipped) {
        const testUrl = `${url}.gz`;
        if (files[testUrl] && files[testUrl].content) {
          res.setHeader('Content-Encoding', 'gzip');
          file = files[testUrl];
        }
      }

      // 404 if file is empty
      if (!file || !file.content) {
        return this.error404(url, res);
      }

      // Set the Content-Type to the mime of the uncompressed file
      res.setHeader('Content-Type', mime);

      // End the response with the file contents
      res.end(file.content);

      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      const endTime = process.hrtime(startTime);
      log.request(ip, url, startTime, endTime);
    })

    // Listen to port set in config
    .listen(port, () => {
      log.success(`server listening to localhost:${port}`);
    });
  }

  error404(url, res) {
    log.error(`could not find file with url: ${url}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
  }
}

export default new MagicServer();

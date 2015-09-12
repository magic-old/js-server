import {join} from 'path';
import {readdirSync, readFileSync, statSync} from 'fs-extra';
import {createServer} from 'http';
import {sync} from 'glob';
import mime from 'mime';
import log from 'logger';

class MagicServer {
  constructor(config = join(process.cwd(), 'config.js')) {
    this.config = typeof config === 'string' 
                  ? require(config)
                  : config;

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
    const {CNAME, port} = this.config;
    log(`start server on ${CNAME}:${port}`);

    const server = this.runServer(files);

    // Listen to port set in config
    server.listen(port, () => {
      log.success(`server listening to localhost:${port}`);
    });
  }

  error404(url, res) {
    log.error(`could not find file with url: ${url}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
  }

  runServer(files) {
    return createServer((req, res) => {
      // Get startTime for logging
      const startTime = process.hrtime();

      let url = this.getUrl(req.url, files);

      let file = this.getFile(req, res, files);

      // 404 if file is empty
      if (!file || !file.content || !file.mime) {
        return this.error404(url, res);
      }

      // Set the Content-Type to the mime of the uncompressed file
      res.setHeader('Content-Type', file.mime);
      console.log(`file mime: ${file.mime}`);

      // End the response with the file contents
      res.end(file.content);

      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      const endTime = process.hrtime(startTime);
      log.request(ip, url, startTime, endTime);
    });
  }

  getUrl(url, files) {
    const {menuItems, pageItems} = this.config;

    // replace trailing slash with empty string
    if(url.length > 1 && url.substr(url.length - 1) === '/') {
      url = url.substr(0, url.length - 1);
    }

    const isLocalUrl = !!menuItems && menuItems.filter(item => {
      return item.href === url || item.href.replace('#', '/') === url;
    }).length;

    const isPageUrl = !!pageItems && Object.keys(pageItems).filter(key => key === url).length;

    // Return index.html for client side urls and root
    // ♥ = %E2%99%A5
    if (isLocalUrl) {
      url = '/index.html';
    } else if (isPageUrl) {
      const pageItemUrl = pageItems[url];
      const pageItemFile = files[pageItemUrl];

      if (pageItemFile && pageItemFile.mime) {
        url = pageItemUrl;
      }
    }

    return url;
  }

  getFile(req, res, files) {
    const url = this.getUrl(req.url, files);
    let file = files[url];

    // Check if client accepts gzip
    const zipped = req.headers['accept-encoding'].indexOf('gzip') > -1;

    // If accepted, set Content-Encoding and add .gz to url
    if (zipped) {
      const testUrl = `${url}.gz`;
      if (files[testUrl] && files[testUrl].content) {
        res.setHeader('Content-Encoding', 'gzip');
        file.content = files[testUrl].content;
      }
    }
    return file;
  }
}

export default new MagicServer();

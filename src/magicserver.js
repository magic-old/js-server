import {join} from 'path';
import {readdirSync, readFileSync, statSync} from 'fs-extra';
import {createServer} from 'http';
import {sync} from 'glob';
import mime from 'mime';
import color from 'bash-color';

export class Server {
  constructor(configPath = join(process.cwd(), 'config.js')) {
    this.config = require(configPath);

    const {dirs, files, server} = this.config;

    const dir = join(dirs.out, '**', server.files);
    log.info(`collecting files in ${dir}`);

    const globbed = sync(dir, {nodir: true});
    log.info(`found ${globbed.length} files`);

    const collectedFiles = this.collectFiles(globbed);
    this.serve(collectedFiles);
  }

  collectFiles(globbed) {
    const {dirs} = this.config;
    let collectedFiles = {};
    globbed.forEach((file) => {
      collectedFiles[file.replace(dirs.out, '')] = {
        content: readFileSync(file),
        mime: mime.lookup(file),
      };
    });

    return collectedFiles;
  }

  serve(files) {
    const {port, menuItems} = this.config;
    log.info(`start server`);

    createServer((req, res) => {
      // Get startTime for logging
      const startTime = process.hrtime();

      let url = req.url;

      const isLocalUrl = menuItems.filter(item => item.href === url).length;

      // Return index.html for client side urls and root
      // ♥ = %E2%99%A5
      if (url === '/' || url === '/%E2%99%A5' || isLocalUrl) {
        url = '/index.html';
      }

      // 404 if file does not have a mime-type
      if (!files[url] || !files[url].mime) {
        return this.error404(url, res);
      }

      // Get original file mimetype
      const {mime} = files[url];

      // Check if client accepts gzip
      const zipped = req.headers['accept-encoding'].indexOf('gzip') > -1;

      // If accepted, set Content-Encoding and add .gz to url
      if (zipped) {
        url = `${url}.gz`;
        res.setHeader('Content-Encoding', 'gzip');
      }

      // finally get the compressed or uncompressed file
      const file = files[url];

      // 404 if file is empty
      if (!file.content) {
        return this.error404(url, res);
      }

      // Set the Content-Type to the mime of the uncompressed file
      res.setHeader('Content-Type', mime);

      // End the response with the file contents
      res.end(file.content);

      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      log.request(ip, url, startTime);
    })

    // Listen to port set in config
    .listen(port, () => {
      log.success(`server listening to ${port}`);
    });
  }

  error404(url, res) {
    log.error(`could not find file: ${url}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
  }
}

class MagicLogger {
  info(val) {
    console.log(val);
  }
  success(val) {
    console.log(color.green(val));
  }
  error(val) {
    console.log(color.red(val));
  }

  request(ip, url, start) {
    const end = process.hrtime(start);

    // log the url and response time
    const nanoseconds = ((end[0] * 1e9) + end[1]);
    let displayedTime = nanoseconds;
    let timeUnit = 'ns';

    if (displayedTime > 1000) {
      displayedTime = displayedTime / 1000;
      timeUnit = 'µs';
    }

    if (displayedTime > 1000) {
      displayedTime = displayedTime / 1000;
      timeUnit = 'ms';
    }

    if (displayedTime > 300 && timeUnit === 'ms') {
      log.error(`${url} Response time over 300ms`);
    }
    log.success(`${ip} - ${url} - ${parseInt(displayedTime)}${timeUnit}`);
  }
}

const log = new MagicLogger();

export default new Server();

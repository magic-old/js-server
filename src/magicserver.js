import {join} from 'path';
import {readdirSync, readFileSync, statSync} from 'fs-extra';
import {createServer} from 'http';
import {sync} from 'glob';
import mime from 'mime';


export default class Server {
  constructor(config) {
    this.config = config;

    const {dirs, files, server} = this.config;

    const dir = join(dirs.out, '**', server.files);
    console.log(`collecting files in ${dir}`);

    const globbed = sync(dir, {nodir: true});
    console.log(`found ${globbed.length} files`);

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
    console.log(`start server`);

    createServer((req, res) => {
      // Get startTime for logging
      const startTime = new Date().getTime();

      let url = req.url;

      const isLocalUrl = menuItems.filter(item => item.href === url).length;

      // Return index.html for client side urls and root
      if (url === '/' || isLocalUrl) {
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

      const endTime = new Date().getTime();

      // log the url and response time
      console.log(`${url} ${endTime - startTime}ms`);
    })

    // Listen to port set in config
    .listen(port, () => {
      console.log(`server listening to ${port}`);
    });
  }

  error404(url, res) {
    console.log(`could not find file: ${url}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
  }
}

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
      const startTime = new Date().getTime();
      let url = req.url;

      const isLocalUrl = menuItems.filter(item => item.href === url).length;
      if (url === '/' || isLocalUrl) {
        url = '/index.html';
      }

      if (!files[url] || !files[url].mime) {
        return this.error404(url, res);
      }
      const {mime} = files[url];

      const zipped = req.headers['accept-encoding'].indexOf('gzip') > -1;

      if (zipped) {
        url = `${url}.gz`;
        res.setHeader('Content-Encoding', 'gzip');
      }

      const file = files[url];

      if (!file.content) {
        return this.error404(url, res);
      }

      res.setHeader('Content-Type', mime);

      res.end(file.content);

      const endTime = new Date().getTime();

      console.log(`${url} ${endTime - startTime}ms`);
    })
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

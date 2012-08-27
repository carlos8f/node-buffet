#!/usr/bin/env node
var program = require('commander')
  , version = require(require('path').join(__dirname, '../package.json')).version

program
  .version(version)
  .usage('[options] [root]')
  .option('-r, --root <path>', 'path to webroot (default: cwd)', function (root) {
    return root || program.args[0] || process.cwd();
  })
  .option('-p, --port <port>', 'specify the port (default: 8080)', Number, 8080)
  .option('-t, --threads <count>', 'number of threads to use (default: CPU count)', Number, require('os').cpus().length)
  .option('--no-log', 'disable logging')
  .option('--logFile <path>', 'log requests to a file')
  .option('--no-watch', "don't watch for file changes")
  .option('--maxAge <seconds>', 'value for max-age Cache-Control header (default: 300)', Number, 300)
  .option('--notFoundPath <path>', 'path of file to serve on 404 (default: /404.html)', '/404.html')
  .option('--no-indexes', "don't serve index file when a directory is requested")
  .option('--index <file>', 'name of index file to look for (default: index.html)', 'index.html')
  .option('--keepAlive <ms>', 'timeout for HTTP keep-alive (default: 5000)', Number, 5000)
  .option('--conf <path>', 'path to JSON file to load options from')
  .parse(process.argv);

if (program.conf) {
  var conf = require(program.conf);
  Object.keys(conf).forEach(function (k) {
    program[k] = conf[k];
  });
}

if (program.logFile) {
  program.log = program.logFile;
}

// Reduce commander's output to a regular object.
var keys = Object.keys(program).filter(function (k) {
  return !k.match(/^(commands|args|name|options|rawArgs|Command|Option)$|_/);
}), options = {};
keys.forEach(function (k) {
  options[k] = program[k];
});

var cluster = require('cluster')
  , workerCount = 0

cluster.setupMaster({
  exec: require('path').resolve(__dirname, '../lib/worker.js')
});

// Auto-respawn
cluster.on('exit', function (worker, code, signal) {
  cluster.fork();
});

for (var i = 0; i < options.threads; i++) {
  var worker = cluster.fork();
  worker.on('message', function (message) {
    if (message.cmd === 'BUFFET_UP') {
      workerCount++;
      if (workerCount === options.threads) {
        console.error('buffet ' + version + ' listening on port ' + options.port);
      }
    }
  });
  worker.send({cmd: 'BUFFET_OPTIONS', options: options});
}
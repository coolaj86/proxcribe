(function () {
  "use strict";

  var config = require('./config')
    , server = require('./server')
    ;

  config.port = config.port || process.argv[2];

  function logPort() {
    console.log("Dropsharing on " + server.address().address + ":" + server.address().port);
  }

  if (config.port) {
    server.listen(config.port, logPort);
  } else {
    server.listen(logPort);
  }
}());

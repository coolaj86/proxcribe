(function () {
  "use strict";

  var connect = require('steve')
    , socketIo = require('socket.io')
    , fs = require('fs')
    , proxdat = JSON.parse(fs.readFileSync('./example-proxdat.json'))
    , port = process.argv[2]
    , server
    , io
    ;

  function dummyProxdat(req, res, next) {
    res.json(proxdat);
  }

  function router(app) {
    app.get('/api/proxdat', dummyProxdat);
  }

  server = connect.createServer(
      connect.static(__dirname + '/public')
    , connect.router(router)
  );

  io = socketIo.listen(server);

  function listening() {
    console.log('listening on', server.address().port);
  }
  if (port) {
    server.listen(port, listening);
  } else {
    server.listen(listening);
  }
}());

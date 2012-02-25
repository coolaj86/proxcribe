(function () {
  "use strict";

  var connect = require('steve')
    , socketIo = require('socket.io')
    , fs = require('fs')
    , Proxcribe = require('./index')
    , proxdat = JSON.parse(fs.readFileSync('./example-proxdat.json'))
    , UUID = require('node-uuid')
    , url = require('url')
    , server
    , io
    , proxcriptions = {}
    , port = process.argv[2]
    ;

  function dummyProxdat(req, res, next) {
    res.json(proxdat);
  }

  function router(app) {
    app.get('/api/proxdat', dummyProxdat);
    app.post('/api/proxcriptions/new', proxcribeRoute);
  }

  function listening() {
    console.log('listening on', server.address().port);
  }

  server = connect.createServer(
      connect.static(__dirname + '/public')
    , connect.bodyParser()
    , connect.router(router)
  );

  io = socketIo.listen(server);
  // tell socket io to SHUT UP!
  io.set('log level', 0);
  io.sockets.on('connection', function (socket) {
    var proxId
      ;

    function addSubscription(id) {
      removeSubscription();
      proxId = id;
      if (proxcriptions[proxId]) {
        proxcriptions[proxId].emitter.addListener('data', pushData);
      }
    }

    function removeSubscription() {
      if (proxcriptions[proxId]) {
        proxcriptions[proxId].emitter.removeListener('data', pushData);
      }
    }

    function pushData(data) {
      socket.emit(subscription, data);
    }

    socket.emit('msg', "welcome");
    socket.on('subscribe', addSubscription);
    socket.on('unsubscribe', removeSubscription);

    socket.on('disconnect', removeSubscription);
  });

  function formatProxdat() {
    var byHost = {}
      ;
    Object.keys(proxcriptions).forEach(function (id) {
      var proxcription
        , host
        , resource
        ;

      proxcription = proxcriptions[id];

      host = byHost[proxcription.host] = byHost[proxcription.host] || {
          "host": proxcription.host
        , "uptime": Infinity   // how long the test has been passing
        , "runtime": 0  // how long the test has been running
        , "resources": []
      };

      // TODO host.uptime
      host.runtime = Math.max(host.runtime, Date.now() - proxcription.createdAt);
      host.uptime = Math.min(host.uptime, Date.now() - proxcription.erroredAt);

      resource = {
          "uuid": proxcription.uuid
        , "name": proxcription.resource
        , "count": proxcription.count
        , "size": proxcription.size
        , "protocol": proxcription.protocol
      }
      host.resources.push(resource);
    });

    proxdat = [];
    Object.keys(byHost).forEach(function (key) {
      proxdat.push(byHost[key]);
    });
    io.sockets.emit('data', proxdat);
  }
  setInterval(formatProxdat, 3 * 1000);

  function proxcribeRoute(req, res) {
    var proxcription
      , pushNotification
      , urlObj
      , uuid
      , emitter
      , netqueueProxy
      , netqueueTarget
      , netqueueTargetParams
      ;

    pushNotification = req.body;

    if (!req.body) {
      res.error("no body");
      res.json();
      return;
    }

    console.log(req.body);

    // TODO validate
    // validatePushNotification(req.body);

    if (/get/i.exec(pushNotification.protocol)) {
      res.error("HTTP GET not yet supported");
      res.json();
      return;
    }

    uuid = UUID.v4();
    proxcription = proxcriptions[uuid] = {
        uuid: uuid
      , protocol: pushNotification.protocol
      , resource: pushNotification.resource
      , host: pushNotification.host
      , createdAt: Date.now()
      , previouslyUpdatedAt: Date.now()
      , updatedAt: Date.now()
      , erroredAt: Date.now()
      , size: 0
      , count: 0
      , errorCount: 0
    };
    //urlObj = url.parse(pushNotification.device, true);
    
    netqueueProxy = {
        hostname: 'nq.foobar3000.com'
      , port: 8877
      , pathname: '/nq'
    };
    netqueueTarget = {
        protocol: pushNotification.protocol
      , resourceUrl: 'http://' + pushNotification.host + '/' + pushNotification.resource
    };
    netqueueTargetParams = pushNotification.args || {
        "filter": {
            "maxWait": 10 * 1000
          , "minWait": 3 * 1000
        }
    }; // { params: ..., filter: ..., etc}
    console.log('netqueueTarget');
    console.log(netqueueTarget);
    emitter = proxcriptions[uuid].emitter = Proxcribe.create(
        netqueueProxy
      , netqueueTarget
      , netqueueTargetParams
    );
    
    emitter.on('error', function (err) {
      console.error('prox error:');
      console.error(err);
      proxcription.errorCount += 1;
    });

    var nodataTimeoutToken
      ;
    emitter.on('data', function (data) {
      var now = Date.now()
        ;

      clearTimeout(nodataTimeoutToken);
      setTimeout(function () {
        proxcription.errorCount += 1;
        proxcription.erroredAt = now;
      }, 7 * 1000);
      proxcription.updatedAt = now;
      proxcription.count += 1;
      // TODO stringify json to count size
      proxcription.size += data.length;
    });

    //emitter.on('end', reformat);
  }
  //server.use('/nq', nq.create());

  if (port) {
    server.listen(port, listening);
  } else {
    server.listen(listening);
  }
}());

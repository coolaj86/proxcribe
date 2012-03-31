(function () {
  "use strict";

  var connect = require('steve')
    , socketIo = require('socket.io')
    , fs = require('fs')
    , Saruman = require('saruman').Saruman
    , UUID = require('node-uuid')
    , url = require('url')
    , server
    , io
    , proxcriptions = {}
    , proxdat = JSON.parse(fs.readFileSync(__dirname + '/example-proxdat.json'))
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
      console.log('uptime');
      console.log(host.uptime);
      console.log(proxcription.erroredAt);
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


  var request = require('ahr2')
    , querystring = require('querystring')
    , url = require('url')
    , EventEmitter = require('events').EventEmitter
    ;

  function ProxcribeGet(target, filter, params) {
    var self = this
      , isObj
      , querystr
      , urlstr
      ;

    target.protocol = 'http:'
    console.log('target');
    console.log(target);
    // XXX shouldn't need extra filter.filter
    filter = (filter && filter.filter) || filter || {};
    params = params || {};

    isObj = Object.keys(params).some(function (key) {
      var obj = params[key];
      if ('object' === typeof obj) {
        return true;
      }
    });

    if (isObj) {
      filter.json = JSON.stringify(params);
    } else {
      Object.keys(params).forEach(function (key) {
        // could override existing key
        filter[key] = params[key];
      });
    }

    querystr = querystring.stringify(filter);
    if (querystr) {
      querystr = '?' + querystr;
    }

    urlstr = url.format(target) + querystr;
    console.log('urlstr');
    console.log(urlstr);

    function getUrl() {
      request.get(urlstr).when(function (err, ahr, data) {
        console.log('blah blah blah');
        if (!data || err) {
          self.emit('error', err);
          return;
        }

        // XXX ahr needs an option for not handling data
        if ('string' === typeof data) {
          data = new Buffer(data);
        } else if (data instanceof Buffer) {
          // ignore
        } else {
          data = new Buffer(JSON.stringify(data));
        }

        self.emit('data', data);
        getUrl();
      });
    }

    getUrl();
  }

  ProxcribeGet.prototype = new EventEmitter();

  ProxcribeGet.create = function (a, b, c, d, e) {
    return new ProxcribeGet(a, b, c, d, e);
  };

  function proxcribeRoute(req, res) {
    var proxcription
      , pushNotification
      , uuid
      , emitter
      , proxyInfo
      , deviceInfo
      , filter
      , params
      , listenerInfo
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
    

    proxyInfo = {
        hostname: 'sauron.foobar3000.com'
      //, port: 8877
      //, pathname: ''
    };
    listenerInfo = {
        protocol: pushNotification.protocol
    };
    deviceInfo = {
        host: pushNotification.host
      , hostname: pushNotification.host.split(':')[0]
      , port: pushNotification.host.split(':')[1]
      , resource: pushNotification.resource
    };
    filter = pushNotification.filter || {
        "maxWait": 10 * 1000
      , "minWait": 3 * 1000
    }; // { params: ..., filter: ..., etc}
    params = pushNotification.params || {};


    if (/get/i.exec(pushNotification.protocol)) {
      emitter = proxcriptions[uuid].emitter = ProxcribeGet.create(
          deviceInfo
        , filter
      );
    } else {
      console.log('creating emitter');
      emitter = proxcriptions[uuid].emitter = Saruman.create(
          proxyInfo
        , deviceInfo
        , listenerInfo
        , filter
        , params
      );

      emitter.begin();

      console.log('ALL THE THINGS');
      console.log(proxyInfo);
      console.log(listenerInfo);
      console.log(deviceInfo);
      console.log(filter);
      console.log(params);
    }
    
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

      console.log('now it start the working');

      clearTimeout(nodataTimeoutToken);
      nodataTimeoutToken = setTimeout(function () {
        proxcription.errorCount += 1;
        proxcription.erroredAt = now;
      }, 7 * 1000);
      proxcription.updatedAt = now;
      proxcription.count += 1;
      // TODO stringify json to count size
      proxcription.size += data.length;
    });

    //emitter.on('end', reformat);
    res.json("happy day");
  }

  module.exports = server
}());

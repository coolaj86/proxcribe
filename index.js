(function () {
  "use strict";

  var request = require('ahr2')
    , EventEmitter = require('events').EventEmitter
    , dns = require('dns')
    , forEachAsync = require('forEachAsync');
    ;

  function ProxcribeError(err) {
    this.stack = err;
  }
  ProxcribeError.prototype = Error.prototype;
  ProxcribeError.toString = function () {
    return JSON.stringify(this);
  }


  function create(nq, listener, params) {
    var emitter = new EventEmitter()
      ;

    function proxcribe(callback, netqrl, protocol, pushy) {
      var resource
        ;

      function open() {
      // The port number will be chosen at random and sent back
        request.post(netqrl + '/new', null, { protocol: protocol }).when(function (err, ahr, data) {
          // TODO BUG fix content-type headers 
          //data = JSON.stringify(data.toString('utf8'));
          data = data || {};
          if (data.error) {
            err = new ProxcribeError(data.errors[0]);
          }
          if (err) {
            emitter.emit('error', err);
            return;
          }

          resource = data.result.resource;

          callback(err, {
              meta: meta
            , get: get
            , close: close
          }, data.result);
        });
      }

      function meta(cb) {
        request.get(netqrl + '/' + resource).when(function (err, ahr, data) {
          if (data && data.error) {
            // TODO create a SteveResponseError that can handle multiple errors
            err = new ProxcribeError(data.errors[0]);
          }
          if (err) {
            emitter.emit('error', err);
            console.error('error:');
            console.error(err);
            cb(err);
            return;
          }

          if (data.result && !data.result.length) {
            // TODO return if it flat-out fails
            setTimeout(meta, 1 * 1000, cb);
            return;
          }

          emitter.emit('meta', data.result);
          cb(err, data.result);
        });
      }

      function get(cb, index) {
        request.delete(netqrl + '/' + resource + '/' + index).when(function (err, ahr, data) {
          // will be a Buffer or a steve response
          if (data && data.error) {
            err = new ProxcribeError(data.errors[0]);
          }
          if (err) {
            emitter.emit('error', err);
            cb(err);
            return;
          }

          emitter.emit('data', data);
          cb(err, data);
        });
      }

      function close(cb) {
        request.delete(netqrl + '/' + resource).when(function (err, ahr, data) {
          if (data.error) {
            err = new ProxcribeError(data.errors[0]);
          }
          if (err) {
            emitter.emit('error', err);
            cb(err);
            return;
          }

          emitter.emit('close');
          cb(err, data.result);
        });
      }

      emitter.end = function () {
        emitter.closing = true;
        close(function () {
          emitter.emit('end');
        });
      };

      open();
    }

    function subscribeOnDevice(cb, resourceUrl, pushNotification) {

      function subscribe() {
        //console.log('subscribe', resourceUrl + '/subscribe');
        request.post(resourceUrl + '/subscribe', null, pushNotification).when(function (err, ahr, data) {
          //console.log('subscribed', resourceUrl + '/subscribe');
          if (err) {
            console.error(err.stack);
            return;
          }
          cb();
        });
      }

      function unsubscribeOne(next, id) {
        // TODO error checking
        //console.log('unsubscribe', resourceUrl + '/subscriptions/' + id);
        request.post(resourceUrl + '/unsubscribe', null, { id: id }).when(next);
      }

      function unsubscribeAll(callback) {
        //console.log('subscriptions', resourceUrl + '/subscriptions');

        request.get(resourceUrl + '/subscriptions').when(function (err, ahr, data) {
          if (err || !data) {
            console.error('Error getting subscription list');
            console.error(err);
            emitter.emit('error', err || new Error('Error getting subscription list'));
            return;
          }

          if (data.error) {
            err = Array.isArray(data.errors) ? data.errors[0] : data.errors;
            console.error('Internal error from Device');
            console.error(err);
            emitter.emit('error', err);
            return;
          }

          if (!data.result) {
            console.error('Invalid data returned from Device');  
            console.error(data);
            emitter.emit('error', new Error('Invalid data returned from Device'));
            return;
          }

          forEachAsync(Object.keys(data.result), unsubscribeOne).then(callback);
        });

      }

      unsubscribeAll(subscribe);

      return function () {
        unsubscribeAll(function () {});
      };
    }

    function forwardProxcription(err, vpsreq, result) {
      var unsubscribe
        ;

      function getData() {
        var intervalToken
          , metas
          , keepOnKeepingOn = true
          , maxRequests = 15
          , numRequests = 0
          ;
          
        function getSingleRequest() {
          var meta = metas.pop()
            ;


          if (!keepOnKeepingOn || emitter.closing) {
            return;
          }

          if (numRequests >= maxRequests) {
            vpsreq.close(reformat);
            unsubscribe();
            keepOnKeepingOn = false;
            return;
          }

          if (!meta) {
            getMetas();
            return;
          }

          vpsreq.get(function (err, data) {
            // ignore
            getSingleRequest();
          }, meta.id);
        }

        function getEach(err, result) {
          if (!keepOnKeepingOn || emitter.closing) {
            return;
          }

          if (err) {
            console.error('Error getting meta');
            console.error(err);
            return;
          }

          metas = result;
          getSingleRequest();
        }

        function getMetas() {
          if (!keepOnKeepingOn || emitter.closing) {
            return;
          }

          vpsreq.meta(getEach);
        }

        getMetas();
      }

      params.protocol = listener.protocol;
      // resolved via DNS below
      //params.hostname = result.hostname || netqHost; 
      params.port = result.port;
      
      // TODO better passing of this unsubscriber
      unsubscribe = subscribeOnDevice(getData, listener.resourceUrl, params);
    }

    // the sensor can't resolve so well
    dns.resolve4(nq.hostname, function (err, addresses) {
      if (err) {
        console.error('dns issues');
        console.error(nq);
        console.error(err.stack);
        return;
      }

      params.hostname = addresses[0];
      proxcribe(forwardProxcription, 'http://' + nq.hostname + ':' + nq.port + nq.pathname, listener.protocol, params);
    });

    return emitter;
  }

  module.exports.create = create;
}());

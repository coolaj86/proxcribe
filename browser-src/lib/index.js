(function () {
  "use strict";

  console.log('start of file');

  function pad(n) {
    var s = String(n)
      ;
    while (s.length < 2) {
      s = '0' + s;
    }

    return s;
  }

  function toByteCount(size) {
    // 102.4
    if (size < 1024) {
      return size + ' B';
    }

    // 104857.6
    if (size < 1048576) {
      return (size / 1024).toFixed(1) + ' KiB';
    }

    // 107374182.4
    if (size < 1073741824) {
      return (size / (1024 * 1024)).toFixed(2) + ' MiB';
    }

    // 1099511627776
    return (size / (1024 * 1024 * 1024)).toFixed(3) + ' GiB';
  }

  function toAbstractTime(ms) {
    var timestr = ""
      , sec = Math.round(ms / 1000) 
      , days
      , hours
      , minutes
      , seconds
      ;

    days = Math.floor(sec / (24 * 60 * 60));
    sec = sec - (days * 24 * 60 * 60);
    hours = Math.floor(sec / (60 * 60));
    sec = sec - (hours * 60 * 60);
    minutes = Math.floor(sec / 60);
    sec = sec - (minutes * 60);
    seconds = sec;

    if (days) {
      timestr += pad(days) + ':';
    }

    if ('number' === typeof hours) {
      timestr += pad(hours) + ':';
    }

    if ('number' === typeof minutes) {
      timestr += pad(minutes) + ':';
    }

    timestr += pad(seconds) + '';

    return timestr;
  }

  var $ = require('ender')
    , request = require('ahr2')
    , pure = require('pure').$p
    , io = require('socket.io')
    , serializeForm = require('serialize-form').serializeFormObject
    , directive = {
        "tbody tr": {
          "dev<-": {
              ".devicename": "dev.host"
            , ".uptime": function (data) {
                return toAbstractTime(data.item.uptime);
              }
            , ".runtime": function (data) {
                return toAbstractTime(data.item.runtime);
              } 
            , ".packets ul": {
                  "res<-dev.resources": {
                      "li": "res.count"
                  }
              }
            , ".packettype ul": {
                  "res<-dev.resources": {
                      "li": function (data) {
                        return data.item.protocol + data.item.name;
                      }
                  }
              }
            , ".size ul": {
                  "res<-dev.resources": {
                    "li": function (data) {
                      return toByteCount(data.item.size);
                    }
                  }
              }
          }
        }
      }
    , rfn
    ;

  function showProxcriptions(proxdat) {
    pure('#results').render(proxdat, rfn);
  }

  function addProxcription(ev) {
    var data
      ;

    ev.preventDefault();
    
    data = serializeForm('form#proxcribe');
    // TODO post this data
    console.log(data);
    console.log('POST /api/proxcriptions/new');
    request.post('/api/proxcriptions/new', null, data).when(function (err, ahr, data) {
      console.log('POST /api/proxcriptions/new - response');
      console.log(data);
      //showProxcriptions(data.result);
    });
    /*
    request.get('/api/proxdat').when(function (err, ahr, data) {
      console.log(data);
      showProxcriptions(data.result);
    });
    */
  }

  function attachHandlers() {
    $('body').delegate('form#proxcribe', 'submit', addProxcription);

    rfn = pure('#results').compile(directive);

    var socket = io.connect();
    socket.on('msg', function (msg) {
      console.log('msg');
      console.log(msg);
    });
    socket.on('data', function (data) {
      console.log('data');
      console.log(data);
      showProxcriptions(data);
    });
  }

  console.log('dom readying');
  $.domReady(attachHandlers);

}());

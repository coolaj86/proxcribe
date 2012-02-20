(function () {
  "use strict";

  var $ = require('ender')
    , request = require('ahr2')
    , pure = require('pure').$p
    , socketIo = require('socket.io')
    , serializeForm = require('serialize-form').serializeFormObject
    , directive = {
        "tbody tr": {
          "dev<-": {
              ".devicename": "dev.host"
            , ".uptime": "dev.uptime"
            , ".runtime": "dev.runtime"
            , ".packets ul": {
                  "res<-dev.resources": {
                    "li": "res.count"
                  }
              }
            , ".packettype ul": {
                  "res<-dev.resources": {
                    "li": "res.name"
                  }
              }
          }
        }
      }
    ;

  function showProxcriptions(proxdat) {
    var rfn = pure('#results').compile(directive);
    pure('#results').render(proxdat, rfn);
  }

  function addProxcription(ev) {
    var data
      ;

    ev.preventDefault();
    
    data = serializeForm('form#proxcribe');
    // TODO post this data
    console.log(data);
    request.get('/api/proxdat').when(function (err, ahr, data) {
      console.log(data);
      showProxcriptions(data.result);
    });
  }

  function attachHandlers() {
    $('body').delegate('form#proxcribe', 'submit', addProxcription);
  }

  $.domReady(attachHandlers);
}());

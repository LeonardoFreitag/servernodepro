'use strict';

const Firebird = require("node-firebird");

const config = require("../config");

var options = {};
options.host = config.host;
options.port = 3050;
options.database = config.connectionString;
options.user = 'SYSDBA';
options.password = 'masterkey';
options.lowercase_keys = false;
options.role = null;
options.pageSize = 4096;

const firebase = require("../services/firebaseConfig");

const fb = firebase.firebase;

exports.getProviderId = idProvider => {
  Firebird.attach(options, function (err, db) {
    if (err) throw err; // db = DATABASE

    db.query('SELECT web_key FROM config', function (err, result) {
      // id = result[0].WEB_KEY.toString();
      db.detach();
      let id = result[0].WEB_KEY;
      return idProvider(id);
    });
  });
};
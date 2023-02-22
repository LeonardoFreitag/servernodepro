"use strict";
const Firebird = require("node-firebird");
const config = require("../config");
var options = {};
options.host = config.host;
options.port = 3050;
options.database = config.connectionString;
options.user = "SYSDBA";
options.password = "masterkey";
options.lowercase_keys = false;
options.role = null;
options.pageSize = 4096;

exports.get = (req, res, next) => {
  Firebird.attach(options, function (err, db) {
    if (err) throw err;

    // db = DATABASE
    db.query("SELECT * FROM V_ANDROID_GRUPOS", function (err, result) {
      // IMPORTANT: close the connection
      const dataResult = result.map((item) => {
        return {
          codigo: item.CODIGO,
          nome: item.NOME,
          combinado: item.COMBINADO,
          sabores: item.SABORES,
        };
      });
      res.status(200).send(dataResult);
      db.detach();
    });
  });
};

'use strict';

const Firebird = require("node-firebird");

const sqlite = require("../database/connection");

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

exports.getProducts = () => {
  Firebird.attach(options, function (err, db) {
    if (err) throw err; // db = DATABASE

    let data = [];
    db.query('SELECT * FROM v_estoque', function (err, result) {
      // IMPORTANT: close the connection
      //res.status(200).send(result)
      data = result;
      db.detach();
    });
    return data;
  });
};

exports.sendProducts = () => {
  Firebird.attach(options, function (err, db) {
    if (err) throw err; // db = DATABASE

    let data = [];
    db.query('SELECT * FROM v_estoque', function (err, result) {
      // IMPORTANT: close the connection
      //res.status(200).send(result)
      data = result;
      insertProduct(data);
      db.detach();
    });
  });
};

function insertProduct(data) {
  data.forEach(element => {
    const {
      CODIGO,
      NOME,
      UNIDADE,
      PRECO,
      GRUPO,
      SUBGRUPO,
      IMPRESSAO
    } = element;
    console.log({
      CODIGO,
      NOME,
      UNIDADE,
      PRECO,
      GRUPO,
      SUBGRUPO,
      IMPRESSAO
    }); // sqlite('products').insert({
    //     CODIGO,
    //     NOME,
    //     UNIDADE,
    // });
  }); // seleciona os dados primeiro
  // compara os dados das duas fontes
  // se for alteração atualiza
  // se for novo roduto insere e envia pro firebase
}
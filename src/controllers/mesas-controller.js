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
    db.query("SELECT * FROM v_mesas", function (err, result) {
      // IMPORTANT: close the connection
      const dataResult = result.map((item) => {
        return {
          codigo: item.CODIGO,
          comanda: item.MESA,
          subtotal: item.SUBTOTAL,
          total: item.TOTAL,
          status: item.STATUS,
          ordem: item.ORDEM,
        };
      });
      res.status(200).send(dataResult);
      db.detach();
    });
  });
};

exports.post = (req, res, next) => {
  res.status(201).send(req.body);
};

exports.insereComanda = (req, res, next) => {
  let mesa = req.body.mesa;
  let mesaDestino = req.body.mesaDestino;
  let intMesa = Number(mesa);
  let mesaChanged = String(intMesa);
  let atende = req.body.codAtendente;
  Firebird.attach(options, function (err, db) {
    if (err) throw err;

    // db = DATABASE
    db.query(
      "SELECT oretorno FROM POCKET_INSERT_MESA(?, ?, ?)",
      [atende, mesaChanged, mesaDestino],
      function (err, result) {
        // IMPORTANT: close the connection
        if (err) {
          res.status(400).send(err);
        }
        const dataResult = result.map((item) => {
          return {
            oretorno: item.ORETORNO,
          };
        });
        res.status(200).send(dataResult);
        db.detach();
      }
    );
  });
};

exports.delete = (req, res, next) => {
  res.status(200).send(req.body);
};

const getPrintCaixaGroupId = () => {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, function (err, db) {
      if (err) throw err;
      db.query(
        "select gen_id(g_print_group_caixa, 1) as id from rdb$database",
        function (err, result) {
          if (err) {
            reject(err);
          } else {
            resolve(result[0].ID);
          }
          db.detach();
        }
      );
    });
  });
};

const insertImpressaoCaixa = (printGroupId, codMesa, destino) => {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, function (err, db) {
      if (err) throw err;
      db.query(
        "insert into impressoes_caixa(id, id_computador, id_origem, origem, destino) values(?, ?, ?, ?, ?)",
        [printGroupId, "MOBILE", codMesa, "M", destino],
        function (err, result) {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
          db.detach();
        }
      );
    });
  });
};

const updateStatusConta = (codigo) => {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, function (err, db) {
      if (err) throw err;
      db.query(
        "update mesas_abertas set status=? where codigo=?",
        ["F", codigo],
        function (err, result) {
          if (err) {
            reject(false);
          } else {
            resolve(true);
          }
          db.detach();
        }
      );
    });
  });
};

exports.fechaConta = (req, res) => {
  getPrintCaixaGroupId().then(async (printGroupId) => {
    let fechouConta = false;
    const { codigo, destino } = req.body;
    if (destino === "F") {
      fechouConta = await updateStatusConta(codigo);
    }
    const dataResult = {
      fechouConta: fechouConta,
    };
    insertImpressaoCaixa(printGroupId, codigo, destino).then(() => {
      res.status(200).send(dataResult);
    });
  });
};

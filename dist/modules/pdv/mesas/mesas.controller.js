"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.del = del;
exports.fechaConta = fechaConta;
exports.get = get;
exports.insereComanda = insereComanda;
exports.post = post;
var _nodeFirebird = _interopRequireDefault(require("node-firebird"));
var _firebird = _interopRequireDefault(require("../../../shared/database/firebird"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function getPrintCaixaGroupId() {
  return new Promise((resolve, reject) => {
    _nodeFirebird.default.attach(_firebird.default, (err, db) => {
      if (err) throw err;
      db.query('select gen_id(g_print_group_caixa, 1) as id from rdb$database', (err, result) => {
        if (err) reject(err);else resolve(result[0].ID);
        db.detach();
      });
    });
  });
}
function insertImpressaoCaixa(printGroupId, codMesa, destino) {
  return new Promise((resolve, reject) => {
    _nodeFirebird.default.attach(_firebird.default, (err, db) => {
      if (err) throw err;
      db.query('insert into impressoes_caixa(id, id_computador, id_origem, origem, destino) values(?, ?, ?, ?, ?)', [printGroupId, 'MOBILE', codMesa, 'M', destino], (err, result) => {
        if (err) reject(err);else resolve(result);
        db.detach();
      });
    });
  });
}
function updateStatusConta(codigo) {
  return new Promise((resolve, reject) => {
    _nodeFirebird.default.attach(_firebird.default, (err, db) => {
      if (err) throw err;
      db.query("update mesas_abertas set status=? where codigo=?", ['F', codigo], err => {
        if (err) reject(false);else resolve(true);
        db.detach();
      });
    });
  });
}
function get(req, res, next) {
  _nodeFirebird.default.attach(_firebird.default, (err, db) => {
    if (err) throw err;
    db.query('SELECT * FROM v_mesas', (err, result) => {
      const dataResult = result.map(item => ({
        codigo: item.CODIGO,
        comanda: item.MESA,
        subtotal: item.SUBTOTAL,
        total: item.TOTAL,
        status: item.STATUS,
        ordem: item.ORDEM
      }));
      res.status(200).send(dataResult);
      db.detach();
    });
  });
}
function post(req, res, next) {
  res.status(201).send(req.body);
}
function insereComanda(req, res, next) {
  const mesa = req.body.mesa;
  const mesaDestino = req.body.mesaDestino;
  const mesaChanged = String(Number(mesa));
  const atende = req.body.codAtendente;
  _nodeFirebird.default.attach(_firebird.default, (err, db) => {
    if (err) throw err;
    db.query('SELECT oretorno FROM POCKET_INSERT_MESA(?, ?, ?)', [atende, mesaChanged, mesaDestino], (err, result) => {
      if (err) {
        res.status(400).send(err);
        return;
      }
      const dataResult = result.map(item => ({
        oretorno: item.ORETORNO
      }));
      res.status(200).send(dataResult);
      db.detach();
    });
  });
}
function del(req, res, next) {
  res.status(200).send(req.body);
}
async function fechaConta(req, res) {
  const printGroupId = await getPrintCaixaGroupId();
  let fechouConta = false;
  const {
    codigo,
    destino
  } = req.body;
  if (destino === 'F') {
    fechouConta = await updateStatusConta(codigo);
  }
  await insertImpressaoCaixa(printGroupId, codigo, destino);
  res.status(200).send({
    fechouConta
  });
}
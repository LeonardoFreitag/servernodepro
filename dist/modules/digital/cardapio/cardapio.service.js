"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getProducts = getProducts;
exports.sendProducts = sendProducts;
var _nodeFirebird = _interopRequireDefault(require("node-firebird"));
var _firebird = _interopRequireDefault(require("../../../shared/database/firebird"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function getProducts() {
  _nodeFirebird.default.attach(_firebird.default, (err, db) => {
    if (err) throw err;
    db.query('SELECT * FROM v_estoque', (err, result) => {
      db.detach();
    });
  });
}
function sendProducts() {
  _nodeFirebird.default.attach(_firebird.default, (err, db) => {
    if (err) throw err;
    db.query('SELECT * FROM v_estoque', (err, result) => {
      insertProduct(result);
      db.detach();
    });
  });
}
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
    });
  });
}
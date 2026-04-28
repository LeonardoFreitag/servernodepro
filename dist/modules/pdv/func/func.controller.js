"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.del = del;
exports.get = get;
exports.post = post;
exports.put = put;
var _nodeFirebird = _interopRequireDefault(require("node-firebird"));
var _firebird = _interopRequireDefault(require("../../../shared/database/firebird"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function get(req, res, next) {
  _nodeFirebird.default.attach(_firebird.default, (err, db) => {
    if (err) throw err;
    db.query('SELECT * FROM v_func', (err, result) => {
      const dataResult = result.map(item => ({
        codigo: String(item.CODIGO),
        nome: item.NOME,
        senha: item.SENHA
      }));
      res.status(200).send(dataResult);
      db.detach();
    });
  });
}
function post(req, res, next) {
  res.status(201).send(req.body);
}
function put(req, res, next) {
  res.status(201).send({
    id: req.params.id,
    item: req.body
  });
}
function del(req, res, next) {
  res.status(200).send(req.body);
}
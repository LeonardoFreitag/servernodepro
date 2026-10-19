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
/** GET /func — vendedores/funcionários ativos com senha (view V_FUNC; Mettre e AutoMax). */
function get(req, res, next) {
  _nodeFirebird.default.attach(_firebird.default, (err, db) => {
    // Nunca `throw` dentro do callback: derruba o processo (ou, com a guarda
    // global de uncaughtException, deixa a requisição pendurada sem resposta).
    if (err) return next(err);
    db.query('SELECT CODIGO, NOME, SENHA FROM V_FUNC', (err, result) => {
      db.detach();
      if (err) {
        console.error(`[func] GET /func: ${err.message}`);
        res.status(500).send({
          error: `Falha ao ler V_FUNC: ${err.message}`
        });
        return;
      }
      const dataResult = (result ?? []).map(item => ({
        codigo: String(item.CODIGO ?? '').trim(),
        nome: String(item.NOME ?? '').trim(),
        senha: String(item.SENHA ?? '').trim()
      }));
      res.status(200).send(dataResult);
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
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
    db.query('SELECT V_LIMITE_PEDACOS, V_COBR_SERVICO, V_PER_SERVICO FROM config', (err, result) => {
      const row = result?.[0] ?? {};
      res.status(200).send({
        vLimitePedacos: row.V_LIMITE_PEDACOS ?? null,
        cieloClientId: process.env.CIELO_CLIENT_ID ?? '',
        cieloAccessToken: process.env.CIELO_ACCESS_TOKEN ?? '',
        cobrServico: (row.V_COBR_SERVICO ?? 'N').toString().trim(),
        perServico: row.V_PER_SERVICO ?? 0
      });
      db.detach();
    });
  });
}
function post(req, res, next) {
  res.status(201).send(req.body);
}
function put(req, res, next) {
  const id = req.params.id;
  res.status(201).send({
    id,
    title: req.body.title,
    cost: req.body.cost
  });
}
function del(req, res, next) {
  res.status(200).send(req.body);
}
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.del = del;
exports.get = get;
exports.post = post;
exports.put = put;
var _nodeFirebird = _interopRequireDefault(require("node-firebird"));
var _firebird = _interopRequireDefault(require("../database/firebird"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function get(req, res, next) {
  _nodeFirebird.default.attach(_firebird.default, (err, db) => {
    if (err) throw err;
    db.query('SELECT V_LIMITE_PEDACOS FROM config', (err, result) => {
      res.status(200).send(result);
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
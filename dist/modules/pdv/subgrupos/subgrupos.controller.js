"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.get = get;
var _nodeFirebird = _interopRequireDefault(require("node-firebird"));
var _firebird = _interopRequireDefault(require("../../../shared/database/firebird"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function get(req, res, next) {
  _nodeFirebird.default.attach(_firebird.default, (err, db) => {
    if (err) throw err;
    db.query('SELECT * FROM V_ANDROID_SUBGRUPOS', (err, result) => {
      const dataResult = result.map(item => ({
        nome: item.NOME
      }));
      res.status(200).send(dataResult);
      db.detach();
    });
  });
}
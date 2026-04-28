"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getProviderId = getProviderId;
var _nodeFirebird = _interopRequireDefault(require("node-firebird"));
var _firebird = _interopRequireDefault(require("../database/firebird"));
var _firebaseConfig = require("./firebaseConfig");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const fb = _firebaseConfig.firebase;
function getProviderId(callback) {
  _nodeFirebird.default.attach(_firebird.default, (err, db) => {
    if (err) throw err;
    db.query('SELECT web_key FROM config', (err, result) => {
      db.detach();
      const id = result[0].WEB_KEY;
      return callback(id);
    });
  });
}
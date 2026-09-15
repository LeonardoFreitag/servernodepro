"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "admin", {
  enumerable: true,
  get: function () {
    return _firebaseAdmin.default;
  }
});
exports.db = void 0;
var _firebaseAdmin = _interopRequireDefault(require("firebase-admin"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
if (!_firebaseAdmin.default.apps.length) {
  const serviceAccount = require("../../../serviceAccountKey.json");
  _firebaseAdmin.default.initializeApp({
    credential: _firebaseAdmin.default.credential.cert(serviceAccount)
  });
}
const db = exports.db = _firebaseAdmin.default.firestore();
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _config = _interopRequireDefault(require("../../config"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const firebirdOptions = {
  host: _config.default.host,
  port: _config.default.firebirdPort,
  database: _config.default.connectionString,
  user: _config.default.firebirdUser,
  password: _config.default.firebirdPassword,
  lowercase_keys: false,
  role: null,
  pageSize: 4096
};
var _default = exports.default = firebirdOptions;
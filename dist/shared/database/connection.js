"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _knex = _interopRequireDefault(require("knex"));
var _knexfile = _interopRequireDefault(require("../../../knexfile"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const connection = (0, _knex.default)(_knexfile.default.development);
var _default = exports.default = connection;
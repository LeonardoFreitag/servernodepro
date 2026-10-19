"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.requireApiKey = requireApiKey;
var _config = _interopRequireDefault(require("../../config"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
/**
 * Exige o header `X-Api-Key` igual a `config.apiKey`.
 * Quando `config.apiKey` está vazio (instalações antigas), não exige nada.
 */
function requireApiKey(req, res, next) {
  const expected = (_config.default.apiKey ?? '').trim();
  if (!expected) return next();
  const received = String(req.header('x-api-key') ?? '').trim();
  if (received && received === expected) return next();
  res.status(401).send({
    error: 'X-Api-Key ausente ou inválida.'
  });
}
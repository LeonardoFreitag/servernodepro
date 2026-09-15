"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.enviarWhatsApp = enviarWhatsApp;
exports.gerarToken = gerarToken;
var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));
var _twilio = _interopRequireDefault(require("twilio"));
var _config = _interopRequireDefault(require("../../../config"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function gerarToken(payload) {
  return _jsonwebtoken.default.sign(payload, _config.default.jwtSecret, {
    expiresIn: '8h'
  });
}
async function enviarWhatsApp(fone, link) {
  const client = (0, _twilio.default)(_config.default.twilioSid, _config.default.twilioToken);
  await client.messages.create({
    from: _config.default.twilioWhatsappFrom,
    to: `whatsapp:+${fone}`,
    body: `Olá! Acesse seus pedidos de entrega pelo link:\n${link}`
  });
}
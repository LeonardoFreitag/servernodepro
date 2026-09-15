"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.enviarLink = enviarLink;
var _config = _interopRequireDefault(require("../../../config"));
var _entregas = require("./entregas.service");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
async function enviarLink(req, res, next) {
  const {
    idProvider,
    entregador_code,
    entregador_name,
    entregador_fone
  } = req.body;
  const ts = new Date().toISOString();
  try {
    const token = (0, _entregas.gerarToken)({
      idProvider,
      entregador_code,
      entregador_name
    });
    const link = `${_config.default.frontendUrl}/entregas?token=${token}`;
    console.log(`[${ts}] enviarLink — idProvider=${idProvider} entregador=${entregador_code}`);
    await (0, _entregas.enviarWhatsApp)(entregador_fone, link);
    res.status(200).json({
      sucesso: true,
      link
    });
  } catch (err) {
    console.error(`[${ts}] enviarLink — erro:`, err.message);
    res.status(500).json({
      sucesso: false,
      erro: err.message
    });
  }
}
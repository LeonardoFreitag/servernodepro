"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.heartbeat = heartbeat;
var _heartbeat = require("./heartbeat.service");
async function heartbeat(req, res) {
  const {
    id
  } = req.body ?? {};
  if (!id || typeof id !== 'string') {
    res.status(400).send({
      ok: false,
      erro: 'id é obrigatório'
    });
    return;
  }
  try {
    const result = await (0, _heartbeat.handleHeartbeat)(id);
    if (result.status === 'unknown') {
      res.status(404).send({
        ok: false
      });
      return;
    }
    res.status(200).send({
      ok: true,
      open: result.open
    });
  } catch (err) {
    console.error(`[heartbeat] erro ao processar heartbeat de ${id}`, err);
    res.status(500).send({
      ok: false,
      erro: err.message
    });
  }
}
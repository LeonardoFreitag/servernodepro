"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.abrirRestaurante = abrirRestaurante;
exports.abrirRestauranteInterno = abrirRestauranteInterno;
exports.fecharRestaurante = fecharRestaurante;
exports.fecharRestauranteInterno = fecharRestauranteInterno;
exports.listarEventos = listarEventos;
var _nodeFirebird = _interopRequireDefault(require("node-firebird"));
var _firebaseAdmin = require("../../../shared/firebase/firebase-admin.config");
var _firebird = _interopRequireDefault(require("../../../shared/database/firebird"));
var _restauranteEventos = require("../../../shared/utils/restauranteEventos");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function abrirRestauranteInterno(idProvider, link) {
  return _firebaseAdmin.db.collection('restauranteAtivo').doc(idProvider).set({
    restaurante: 'ServerNode',
    idProvider,
    link,
    ativo: true,
    atualizadoEm: _firebaseAdmin.admin.firestore.FieldValue.serverTimestamp()
  });
}
function fecharRestauranteInterno(idProvider) {
  return _firebaseAdmin.db.collection('restauranteAtivo').doc(idProvider).update({
    ativo: false,
    atualizadoEm: _firebaseAdmin.admin.firestore.FieldValue.serverTimestamp()
  });
}
function abrirRestaurante(req, res) {
  _nodeFirebird.default.attach(_firebird.default, (err, fbDb) => {
    if (err) {
      res.status(500).send({
        sucesso: false,
        erro: err.message
      });
      return;
    }
    fbDb.query('SELECT web_key, web_url_whats FROM config ROWS 1', async (queryErr, result) => {
      fbDb.detach();
      if (queryErr) {
        res.status(500).send({
          sucesso: false,
          erro: queryErr.message
        });
        return;
      }
      const row = result && result[0];
      if (!row) {
        res.status(500).send({
          sucesso: false,
          erro: 'Nenhum registro encontrado na tabela config'
        });
        return;
      }
      try {
        const idProvider = row.WEB_KEY ?? row.web_key;
        await abrirRestauranteInterno(idProvider, row.WEB_URL_WHATS ?? row.web_url_whats);
        console.log(`[restaurante] ${new Date().toISOString()} abrir-manual: ${idProvider}`);
        (0, _restauranteEventos.registrarEventoRestaurante)(idProvider, 'abertura', 'manual');
        res.status(200).send({
          sucesso: true,
          restaurante: 'ServerNode'
        });
      } catch (fsErr) {
        res.status(500).send({
          sucesso: false,
          erro: fsErr.message
        });
      }
    });
  });
}
function fecharRestaurante(req, res) {
  _nodeFirebird.default.attach(_firebird.default, (err, fbDb) => {
    if (err) {
      res.status(500).send({
        sucesso: false,
        erro: err.message
      });
      return;
    }
    fbDb.query('SELECT web_key FROM config ROWS 1', async (queryErr, result) => {
      fbDb.detach();
      if (queryErr) {
        res.status(500).send({
          sucesso: false,
          erro: queryErr.message
        });
        return;
      }
      const row = result && result[0];
      if (!row) {
        res.status(500).send({
          sucesso: false,
          erro: 'Nenhum registro encontrado na tabela config'
        });
        return;
      }
      try {
        const idProvider = row.WEB_KEY ?? row.web_key;
        await fecharRestauranteInterno(idProvider);
        console.log(`[restaurante] ${new Date().toISOString()} fechar-manual: ${idProvider}`);
        (0, _restauranteEventos.registrarEventoRestaurante)(idProvider, 'fechamento', 'manual');
        res.status(200).send({
          sucesso: true,
          restaurante: 'ServerNode'
        });
      } catch (fsErr) {
        res.status(500).send({
          sucesso: false,
          erro: fsErr.message
        });
      }
    });
  });
}
function listarEventos(req, res) {
  const limit = Number(req.query.limit) || 200;
  res.status(200).send((0, _restauranteEventos.listarEventosRestaurante)(limit));
}
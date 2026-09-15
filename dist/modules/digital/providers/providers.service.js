"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getConfigRow = getConfigRow;
exports.getProviderId = getProviderId;
exports.getProviderSnapshot = getProviderSnapshot;
exports.setProviderOpenFlag = setProviderOpenFlag;
var _nodeFirebird = _interopRequireDefault(require("node-firebird"));
var _firebird = _interopRequireDefault(require("../../../shared/database/firebird"));
var _firebaseAdmin = require("../../../shared/firebase/firebase-admin.config");
var _status = require("./status.cache");
var _datetime = require("../../../shared/utils/datetime");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
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
function getConfigRow() {
  return new Promise((resolve, reject) => {
    _nodeFirebird.default.attach(_firebird.default, (err, fbDb) => {
      if (err) {
        reject(err);
        return;
      }
      fbDb.query('SELECT web_key, web_url_whats FROM config ROWS 1', (queryErr, result) => {
        fbDb.detach();
        if (queryErr) {
          reject(queryErr);
          return;
        }
        const row = result && result[0];
        if (!row) {
          reject(new Error('Nenhum registro encontrado na tabela config'));
          return;
        }
        resolve({
          webKey: row.WEB_KEY ?? row.web_key,
          webUrlWhats: row.WEB_URL_WHATS ?? row.web_url_whats
        });
      });
    });
  });
}
function getProviderSnapshot(id) {
  return _firebaseAdmin.db.collection('providers').doc(id).get();
}

/**
 * Grava o estado de abertura do provider.
 *
 * `source` é opcional e apenas carimba quem definiu o estado (consumido por
 * GET /providers/status). O contrato HTTP das rotas existentes não muda.
 */
function setProviderOpenFlag(id, open, source) {
  const payload = {
    open
  };
  if (source) {
    payload.openSource = source;
    payload.openChangedAt = (0, _datetime.toIsoOffset)();
  }

  // Invalida antes e depois: antes evita servir estado velho durante a escrita,
  // depois cobre leituras que tenham repovoado o cache no meio do caminho.
  (0, _status.invalidateStatusCache)(id);
  return _firebaseAdmin.db.collection('providers').doc(id).update(payload).then(result => {
    (0, _status.invalidateStatusCache)(id);
    return result;
  });
}
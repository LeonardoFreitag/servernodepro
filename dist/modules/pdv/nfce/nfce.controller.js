"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.solicitar = solicitar;
exports.status = status;
var _nodeFirebird = _interopRequireDefault(require("node-firebird"));
var _firebird = _interopRequireDefault(require("../../../shared/database/firebird"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function getNextId() {
  return new Promise((resolve, reject) => {
    _nodeFirebird.default.attach(_firebird.default, (err, db) => {
      if (err) return reject(err);
      db.query('SELECT GEN_ID(G_SOLICITACOES_NFCE_MOBILE, 1) AS ID FROM RDB$DATABASE', (err, result) => {
        if (err) {
          db.detach();
          return reject(err);
        }
        resolve(result[0].ID);
        db.detach();
      });
    });
  });
}

/**
 * POST /nfce/solicitar
 *
 * Body: { codMesa: number, cpfCliente?: string }
 * Response: { id: number }
 */
async function solicitar(req, res) {
  const {
    codMesa,
    cpfCliente
  } = req.body;
  if (!codMesa) {
    res.status(400).send({
      error: 'codMesa é obrigatório.'
    });
    return;
  }
  try {
    const id = await getNextId();
    await new Promise((resolve, reject) => {
      _nodeFirebird.default.attach(_firebird.default, (err, db) => {
        if (err) return reject(err);
        db.query(`INSERT INTO SOLICITACOES_NFCE_MOBILE
            (ID, COD_MESA, CPF_CLIENTE, STATUS, CREATED_AT, UPDATED_AT)
           VALUES (?, ?, ?, 'PENDENTE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [id, Number(codMesa), cpfCliente ?? null], err => {
          if (err) {
            db.detach();
            return reject(err);
          }
          resolve();
          db.detach();
        });
      });
    });
    res.status(201).send({
      id
    });
  } catch (error) {
    console.error('[nfce] Erro ao solicitar NFC-e:', error);
    res.status(500).send({
      error: 'Erro ao registrar solicitação de NFC-e.'
    });
  }
}

/**
 * GET /nfce/status/:id
 *
 * Response: {
 *   id, status, chaveAcesso?, numeroNota?, serie?,
 *   qrcodeUrl?, danfeTexto?, valorTotal?, mensagemErro?
 * }
 */
async function status(req, res) {
  const {
    id
  } = req.params;
  if (!id) {
    res.status(400).send({
      error: 'id é obrigatório.'
    });
    return;
  }
  try {
    const row = await new Promise((resolve, reject) => {
      _nodeFirebird.default.attach(_firebird.default, (err, db) => {
        if (err) return reject(err);
        db.query(`SELECT ID, STATUS, CHAVE_ACESSO, NUMERO_NOTA, SERIE,
                  QRCODE_URL, DANFE_TEXTO, VALOR_TOTAL, MENSAGEM_ERRO
           FROM SOLICITACOES_NFCE_MOBILE
           WHERE ID = ?`, [Number(id)], (err, result) => {
          if (err) {
            db.detach();
            return reject(err);
          }
          resolve(result?.[0] ?? null);
          db.detach();
        });
      });
    });
    if (!row) {
      res.status(404).send({
        error: 'Solicitação não encontrada.'
      });
      return;
    }

    // DANFE_TEXTO pode vir como Buffer (BLOB) — converter para string
    let danfeTexto = null;
    if (row.DANFE_TEXTO) {
      danfeTexto = typeof row.DANFE_TEXTO === 'string' ? row.DANFE_TEXTO : row.DANFE_TEXTO.toString('utf8');
    }
    res.status(200).send({
      id: row.ID,
      status: row.STATUS,
      chaveAcesso: row.CHAVE_ACESSO ?? null,
      numeroNota: row.NUMERO_NOTA ?? null,
      serie: row.SERIE ?? null,
      qrcodeUrl: row.QRCODE_URL ?? null,
      danfeTexto,
      valorTotal: row.VALOR_TOTAL ?? null,
      mensagemErro: row.MENSAGEM_ERRO ?? null
    });
  } catch (error) {
    console.error('[nfce] Erro ao consultar status:', error);
    res.status(500).send({
      error: 'Erro ao consultar status da NFC-e.'
    });
  }
}
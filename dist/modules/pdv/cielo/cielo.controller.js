"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.listarPagamentosMesa = listarPagamentosMesa;
exports.registrarPagamento = registrarPagamento;
var _nodeFirebird = _interopRequireDefault(require("node-firebird"));
var _firebird = _interopRequireDefault(require("../../../shared/database/firebird"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function getNextId() {
  return new Promise((resolve, reject) => {
    _nodeFirebird.default.attach(_firebird.default, (err, db) => {
      if (err) return reject(err);
      db.query('SELECT GEN_ID(G_CIELO_PAGAMENTOS, 1) AS ID FROM RDB$DATABASE', (err, result) => {
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
function insertPagamento(params) {
  return new Promise((resolve, reject) => {
    _nodeFirebird.default.attach(_firebird.default, (err, db) => {
      if (err) return reject(err);
      db.query(`INSERT INTO CIELO_PAGAMENTOS (
          ID, COD_MESA, CIELO_ORDER_ID, MEIO_PAGAMENTO, BANDEIRA,
          VALOR_TOTAL, VALOR_PAGO, PARCELAS,
          AUTH_CODE, CIELO_CODE, NSU, TERMINAL, COD_EC, MASK_CARTAO,
          PRODUTO_PRIMARIO, PROD_SECUNDARIO, STATUS_CODE, PAYLOAD_JSON
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )`, [params.id, params.codMesa, params.cieloOrderId, params.meioPagamento, params.bandeira, params.valorTotal, params.valorPago, params.parcelas, params.authCode, params.cieloCode, params.nsu, params.terminal, params.codEc, params.maskCartao, params.produtoPrimario, params.produtoSecundario, params.statusCode, params.payloadJson], err => {
        if (err) {
          db.detach();
          return reject(err);
        }
        resolve();
        db.detach();
      });
    });
  });
}

/**
 * POST /cielo/pagamento
 *
 * Body esperado:
 * {
 *   codMesa:      number,   -- código da mesa/comanda (MESAS_ABERTAS.CODIGO)
 *   paymentCode:  string,   -- ex: "CREDITO_AVISTA"
 *   cieloResponse: object   -- JSON completo retornado pela Cielo Smart
 * }
 */
async function registrarPagamento(req, res) {
  const {
    codMesa,
    paymentCode,
    cieloResponse
  } = req.body;
  if (!codMesa || !paymentCode || !cieloResponse) {
    res.status(400).send({
      error: 'codMesa, paymentCode e cieloResponse são obrigatórios.'
    });
    return;
  }

  // Extrai campos do primeiro pagamento (a Cielo retorna array de payments)
  const payment = cieloResponse.payments?.[0] ?? {};
  const fields = payment.paymentFields ?? {};
  try {
    const id = await getNextId();
    await insertPagamento({
      id,
      codMesa: Number(codMesa),
      cieloOrderId: cieloResponse.id ?? '',
      meioPagamento: paymentCode,
      bandeira: payment.brand ?? '',
      valorTotal: (cieloResponse.price ?? 0) / 100,
      valorPago: (payment.amount ?? cieloResponse.paidAmount ?? 0) / 100,
      parcelas: Number(payment.installments ?? 0),
      authCode: payment.authCode ?? '',
      cieloCode: payment.cieloCode ?? '',
      nsu: fields.paymentTransactionId ?? payment.externalId ?? '',
      terminal: payment.terminal ?? '',
      codEc: payment.merchantCode ?? '',
      maskCartao: payment.mask ?? fields.pan ?? '',
      produtoPrimario: fields.primaryProductName ?? '',
      produtoSecundario: fields.secondaryProductName ?? '',
      statusCode: fields.statusCode ?? '1',
      payloadJson: JSON.stringify(cieloResponse)
    });
    res.status(201).send({
      id,
      codMesa
    });
  } catch (error) {
    console.error('[cielo] Erro ao registrar pagamento:', error);
    res.status(500).send({
      error: 'Erro ao salvar pagamento no banco de dados.'
    });
  }
}
function selectPagamentosByMesa(codMesa) {
  return new Promise((resolve, reject) => {
    _nodeFirebird.default.attach(_firebird.default, (err, db) => {
      if (err) return reject(err);
      db.query(`SELECT ID, MEIO_PAGAMENTO, BANDEIRA, VALOR_PAGO, AUTH_CODE, NSU
           FROM CIELO_PAGAMENTOS
          WHERE COD_MESA = ?
          ORDER BY ID`, [codMesa], (err, result) => {
        if (err) {
          db.detach();
          return reject(err);
        }
        resolve(result);
        db.detach();
      });
    });
  });
}

/**
 * GET /cielo/pagamentos/:codMesa
 *
 * Lista os pagamentos Cielo já registrados para a comanda e o total pago.
 * Só entram em CIELO_PAGAMENTOS transações aprovadas (o app grava após o
 * retorno de sucesso da Cielo), portanto a soma representa o valor recebido.
 * Usado pelo app para restaurar pagamentos parciais e bloquear novas cobranças
 * quando a conta já foi totalmente recebida.
 *
 * Resposta: { codMesa, totalPago, pagamentos: [{ id, meioPagamento, bandeira, valorPago, authCode, nsu }] }
 */
async function listarPagamentosMesa(req, res) {
  const codMesa = Number(req.params.codMesa);
  if (!codMesa) {
    res.status(400).send({
      error: 'codMesa inválido.'
    });
    return;
  }
  try {
    const rows = await selectPagamentosByMesa(codMesa);
    const pagamentos = rows.map(r => ({
      id: r.ID,
      meioPagamento: r.MEIO_PAGAMENTO ?? '',
      bandeira: r.BANDEIRA ?? '',
      valorPago: Number(r.VALOR_PAGO ?? 0),
      authCode: r.AUTH_CODE ?? '',
      nsu: r.NSU ?? ''
    }));
    const totalPago = Math.round(pagamentos.reduce((sum, p) => sum + p.valorPago, 0) * 100) / 100;
    res.status(200).send({
      codMesa,
      totalPago,
      pagamentos
    });
  } catch (error) {
    console.error('[cielo] Erro ao listar pagamentos da mesa:', error);
    res.status(500).send({
      error: 'Erro ao consultar pagamentos no banco de dados.'
    });
  }
}
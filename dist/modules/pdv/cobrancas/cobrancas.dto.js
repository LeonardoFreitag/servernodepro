"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.STATUS_FINAIS = exports.SELECT_COBRANCA = void 0;
exports.isStatusFinal = isStatusFinal;
exports.rowToDTO = rowToDTO;
var _fb = require("../../../shared/database/fb");
const STATUS_FINAIS = exports.STATUS_FINAIS = ['approved', 'declined', 'canceled', 'expired', 'error'];
function isStatusFinal(s) {
  return STATUS_FINAIS.includes(String(s));
}
/** SELECT padrão (COBRANCAS_TERMINAL + alvo). Usar sempre com alias C/P. */
const SELECT_COBRANCA = exports.SELECT_COBRANCA = `
  SELECT C.ID, C.ORIGEM, C.COD_VENDA, C.COD_CAIXA, C.VALOR, C.TIPO_PRE, C.PARCELAS_PRE,
         C.MODO, C.OPERACAO, C.ALVO_PAGAMENTO_ID, C.TERMINAL_ID, C.COD_ENTREGADOR,
         C.DESCRICAO, C.EXTERNAL_REF, C.STATUS, C.CANCEL_REQUESTED, C.PROVIDER,
         C.PAGAMENTO_ID, C.MOTIVO_ERRO, C.CONSUMIDO, C.CRIADO_EM, C.EXPIRA_EM, C.ATUALIZADO_EM,
         P.ID AS P_ID, P.PROVIDER AS P_PROVIDER, P.ATK AS P_ATK, P.CIELO_ORDER_ID AS P_ORDER_ID,
         P.AUTH_CODE AS P_AUTH_CODE, P.CIELO_CODE AS P_CIELO_CODE, P.VALOR_PAGO AS P_VALOR_PAGO,
         P.TRANSACTION_TYPE AS P_TRANSACTION_TYPE, P.PARCELAS AS P_PARCELAS
    FROM COBRANCAS_TERMINAL C
    LEFT JOIN CIELO_PAGAMENTOS P ON P.ID = C.ALVO_PAGAMENTO_ID`;
const trim = v => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
function rowToDTO(r) {
  const operacao = trim(r.OPERACAO) ?? 'P';
  const alvo = operacao === 'C' && r.P_ID != null ? {
    pagamentoId: Number(r.P_ID),
    provider: trim(r.P_PROVIDER) ?? 'CIELO',
    atk: trim(r.P_ATK),
    cieloOrderId: trim(r.P_ORDER_ID),
    authCode: trim(r.P_AUTH_CODE),
    cieloCode: trim(r.P_CIELO_CODE),
    valorCents: Math.round(Number(r.P_VALOR_PAGO ?? 0) * 100),
    transactionType: trim(r.P_TRANSACTION_TYPE) ?? '',
    installments: Number(r.P_PARCELAS ?? 1) || 1
  } : null;
  return {
    id: String(r.ID).trim(),
    origem: trim(r.ORIGEM),
    codVenda: Number(r.COD_VENDA),
    valorCents: Math.round(Number(r.VALOR ?? 0) * 100),
    tipoPre: trim(r.TIPO_PRE),
    parcelasPre: Number(r.PARCELAS_PRE ?? 1) || 1,
    modo: trim(r.MODO),
    operacao,
    alvoPagamentoId: r.ALVO_PAGAMENTO_ID == null ? null : Number(r.ALVO_PAGAMENTO_ID),
    terminalId: trim(r.TERMINAL_ID),
    codEntregador: r.COD_ENTREGADOR == null ? null : Number(r.COD_ENTREGADOR),
    descricao: trim(r.DESCRICAO),
    externalRef: trim(r.EXTERNAL_REF),
    status: trim(r.STATUS) ?? 'pending',
    cancelRequested: trim(r.CANCEL_REQUESTED) === 'S',
    provider: trim(r.PROVIDER),
    pagamentoId: r.PAGAMENTO_ID == null ? null : Number(r.PAGAMENTO_ID),
    motivoErro: trim(r.MOTIVO_ERRO),
    consumido: trim(r.CONSUMIDO) === 'S',
    criadoEm: (0, _fb.toIso)(r.CRIADO_EM),
    expiraEm: (0, _fb.toIso)(r.EXPIRA_EM),
    atualizadoEm: (0, _fb.toIso)(r.ATUALIZADO_EM),
    alvo
  };
}
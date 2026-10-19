import { toIso } from '../../../shared/database/fb';

import { Origem } from '../pagamentos/pagamentos.mapping';

export const STATUS_FINAIS = ['approved', 'declined', 'canceled', 'expired', 'error'] as const;
export type CobrancaStatus = 'pending' | 'sent_to_terminal' | (typeof STATUS_FINAIS)[number];

export function isStatusFinal(s: string | null | undefined): boolean {
  return (STATUS_FINAIS as readonly string[]).includes(String(s));
}

export interface CobrancaAlvo {
  pagamentoId: number;
  provider: string;
  atk: string | null;
  cieloOrderId: string | null;
  authCode: string | null;
  cieloCode: string | null;
  valorCents: number;
  transactionType: string;
  installments: number;
}

export interface CobrancaDTO {
  id: string;
  origem: Origem;
  codVenda: number;
  valorCents: number;
  tipoPre: string | null;
  parcelasPre: number;
  modo: 'A' | 'D';
  operacao: 'P' | 'C';
  alvoPagamentoId: number | null;
  terminalId: string | null;
  codEntregador: number | null;
  descricao: string | null;
  externalRef: string | null;
  status: CobrancaStatus;
  cancelRequested: boolean;
  provider: string | null;
  pagamentoId: number | null;
  motivoErro: string | null;
  consumido: boolean;
  criadoEm: string | null;
  expiraEm: string | null;
  atualizadoEm: string | null;
  alvo: CobrancaAlvo | null;
}

/** SELECT padrão (COBRANCAS_TERMINAL + alvo). Usar sempre com alias C/P. */
export const SELECT_COBRANCA = `
  SELECT C.ID, C.ORIGEM, C.COD_VENDA, C.COD_CAIXA, C.VALOR, C.TIPO_PRE, C.PARCELAS_PRE,
         C.MODO, C.OPERACAO, C.ALVO_PAGAMENTO_ID, C.TERMINAL_ID, C.COD_ENTREGADOR,
         C.DESCRICAO, C.EXTERNAL_REF, C.STATUS, C.CANCEL_REQUESTED, C.PROVIDER,
         C.PAGAMENTO_ID, C.MOTIVO_ERRO, C.CONSUMIDO, C.CRIADO_EM, C.EXPIRA_EM, C.ATUALIZADO_EM,
         P.ID AS P_ID, P.PROVIDER AS P_PROVIDER, P.ATK AS P_ATK, P.CIELO_ORDER_ID AS P_ORDER_ID,
         P.AUTH_CODE AS P_AUTH_CODE, P.CIELO_CODE AS P_CIELO_CODE, P.VALOR_PAGO AS P_VALOR_PAGO,
         P.TRANSACTION_TYPE AS P_TRANSACTION_TYPE, P.PARCELAS AS P_PARCELAS
    FROM COBRANCAS_TERMINAL C
    LEFT JOIN CIELO_PAGAMENTOS P ON P.ID = C.ALVO_PAGAMENTO_ID`;

const trim = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

export function rowToDTO(r: any): CobrancaDTO {
  const operacao = (trim(r.OPERACAO) ?? 'P') as 'P' | 'C';
  const alvo: CobrancaAlvo | null = operacao === 'C' && r.P_ID != null
    ? {
        pagamentoId: Number(r.P_ID),
        provider: trim(r.P_PROVIDER) ?? 'CIELO',
        atk: trim(r.P_ATK),
        cieloOrderId: trim(r.P_ORDER_ID),
        authCode: trim(r.P_AUTH_CODE),
        cieloCode: trim(r.P_CIELO_CODE),
        valorCents: Math.round(Number(r.P_VALOR_PAGO ?? 0) * 100),
        transactionType: trim(r.P_TRANSACTION_TYPE) ?? '',
        installments: Number(r.P_PARCELAS ?? 1) || 1,
      }
    : null;

  return {
    id: String(r.ID).trim(),
    origem: trim(r.ORIGEM) as Origem,
    codVenda: Number(r.COD_VENDA),
    valorCents: Math.round(Number(r.VALOR ?? 0) * 100),
    tipoPre: trim(r.TIPO_PRE),
    parcelasPre: Number(r.PARCELAS_PRE ?? 1) || 1,
    modo: trim(r.MODO) as 'A' | 'D',
    operacao,
    alvoPagamentoId: r.ALVO_PAGAMENTO_ID == null ? null : Number(r.ALVO_PAGAMENTO_ID),
    terminalId: trim(r.TERMINAL_ID),
    codEntregador: r.COD_ENTREGADOR == null ? null : Number(r.COD_ENTREGADOR),
    descricao: trim(r.DESCRICAO),
    externalRef: trim(r.EXTERNAL_REF),
    status: (trim(r.STATUS) ?? 'pending') as CobrancaStatus,
    cancelRequested: trim(r.CANCEL_REQUESTED) === 'S',
    provider: trim(r.PROVIDER),
    pagamentoId: r.PAGAMENTO_ID == null ? null : Number(r.PAGAMENTO_ID),
    motivoErro: trim(r.MOTIVO_ERRO),
    consumido: trim(r.CONSUMIDO) === 'S',
    criadoEm: toIso(r.CRIADO_EM),
    expiraEm: toIso(r.EXPIRA_EM),
    atualizadoEm: toIso(r.ATUALIZADO_EM),
    alvo,
  };
}

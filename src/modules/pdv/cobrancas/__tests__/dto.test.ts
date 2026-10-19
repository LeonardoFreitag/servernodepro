import { rowToDTO, isStatusFinal } from '../cobrancas.dto';

describe('rowToDTO', () => {
  const base = {
    ID: 'a1b2', ORIGEM: 'E', COD_VENDA: 789, VALOR: 45, TIPO_PRE: 'CREDIT', PARCELAS_PRE: 1,
    MODO: 'D', OPERACAO: 'P', ALVO_PAGAMENTO_ID: null, TERMINAL_ID: null, COD_ENTREGADOR: 3,
    DESCRICAO: 'Entrega 789 - Fulano', EXTERNAL_REF: 'E-789', STATUS: 'pending', CANCEL_REQUESTED: 'N',
    PROVIDER: null, PAGAMENTO_ID: null, MOTIVO_ERRO: null, CONSUMIDO: 'N',
    CRIADO_EM: new Date('2026-09-15T12:00:00Z'), EXPIRA_EM: null, ATUALIZADO_EM: new Date('2026-09-15T12:00:00Z'),
  };
  it('converte VALOR reais → valorCents e CHAR(1) → boolean', () => {
    const dto = rowToDTO(base);
    expect(dto).toMatchObject({
      id: 'a1b2', origem: 'E', codVenda: 789, valorCents: 4500, tipoPre: 'CREDIT', parcelasPre: 1,
      modo: 'D', operacao: 'P', codEntregador: 3, status: 'pending', cancelRequested: false,
      consumido: false, criadoEm: '2026-09-15T12:00:00.000Z', expiraEm: null, alvo: null,
    });
  });
  it('preenche alvo em OPERACAO=C', () => {
    const dto = rowToDTO({
      ...base, OPERACAO: 'C', ALVO_PAGAMENTO_ID: 41, P_ID: 41, P_PROVIDER: 'CIELO', P_ATK: null,
      P_ORDER_ID: 'ORDER-1', P_AUTH_CODE: 'AUTH', P_CIELO_CODE: 'CC', P_VALOR_PAGO: 12.34,
      P_TRANSACTION_TYPE: 'CREDIT', P_PARCELAS: 2,
    });
    expect(dto.alvo).toEqual({
      pagamentoId: 41, provider: 'CIELO', atk: null, cieloOrderId: 'ORDER-1', authCode: 'AUTH',
      cieloCode: 'CC', valorCents: 1234, transactionType: 'CREDIT', installments: 2,
    });
  });
  it('isStatusFinal', () => {
    expect(isStatusFinal('approved')).toBe(true);
    expect(isStatusFinal('sent_to_terminal')).toBe(false);
  });
});

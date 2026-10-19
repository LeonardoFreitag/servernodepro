"use strict";

var _pagamentos = require("../pagamentos.service");
/**
 * Testes do serviço sem banco: executor falso que registra o SQL executado.
 * Cobre idempotência (busca prévia, corrida no índice único), filtro do PDV
 * na listagem e o estorno manual.
 */

const mockFb = {
  withTransaction: jest.fn(),
  withDb: jest.fn()
};
jest.mock("../../../../shared/database/fb", () => {
  const actual = jest.requireActual("../../../../shared/database/fb");
  return {
    ...actual,
    withTransaction: fn => mockFb.withTransaction(fn),
    withDb: fn => mockFb.withDb(fn)
  };
});
/** Executor falso: responde por padrão de SQL, na ordem de registro. */
function fakeExecutor(respostas) {
  const chamadas = [];
  const ex = {
    async query(sql, params = []) {
      chamadas.push({
        sql: sql.replace(/\s+/g, ' ').trim(),
        params
      });
      for (const [re, r] of respostas) {
        if (re.test(sql)) {
          if (r instanceof Error) throw r;
          return typeof r === 'function' ? r(params) : r;
        }
      }
      return [];
    }
  };
  return {
    ex,
    chamadas
  };
}
const cielo = id => ({
  id,
  price: 5000,
  paidAmount: 5000,
  payments: [{
    amount: 5000,
    installments: 1,
    brand: 'VISA',
    authCode: 'A1B2C3',
    cieloCode: 'CC9',
    terminal: 'LIO-1',
    paymentFields: {
      paymentTransactionId: 'NSU1',
      primaryProductName: 'CREDITO',
      statusCode: '1'
    }
  }]
});
const input = (orderId, reference) => ({
  provider: 'CIELO',
  origem: 'M',
  codVenda: 7,
  transactionType: 'CREDIT',
  installments: 1,
  amountCents: 5000,
  totalCents: 5000,
  providerData: {
    paymentCode: 'CREDITO_AVISTA',
    reference
  },
  rawResponse: cielo(orderId)
});
beforeEach(() => jest.clearAllMocks());
describe('inserirPagamento — idempotência', () => {
  it('sem existente: GEN_ID + INSERT com REFERENCIA e MANUAL; duplicado=false', async () => {
    const {
      ex,
      chamadas
    } = fakeExecutor([[/SELECT FIRST 1 ID/, []], [/GEN_ID\(G_CIELO_PAGAMENTOS,/, [{
      ID: 101
    }]]]);
    const r = await (0, _pagamentos.inserirPagamento)(ex, input('ORDER-1', 'M:7:abc'));
    expect(r).toEqual({
      id: 101,
      duplicado: false
    });
    const ins = chamadas.find(c => c.sql.startsWith('INSERT INTO CIELO_PAGAMENTOS'));
    expect(ins.sql).toMatch(/REFERENCIA, MANUAL/);
    expect(ins.params[0]).toBe(101);
    expect(ins.params).toEqual(expect.arrayContaining(['ORDER-1', 'M:7:abc', 'N', 'CIELO', 'M', 'CREDIT', '1']));
    // busca por order id E por referência antes de inserir
    expect(chamadas.filter(c => c.sql.includes('SELECT FIRST 1 ID'))).toHaveLength(2);
  });
  it('já existe pelo (PROVIDER, CIELO_ORDER_ID): devolve o id sem GEN_ID nem INSERT', async () => {
    const {
      ex,
      chamadas
    } = fakeExecutor([[/CIELO_ORDER_ID = \?/, p => p[0] === 'CIELO' && p[1] === 'ORDER-1' ? [{
      ID: 55
    }] : []]]);
    expect(await (0, _pagamentos.inserirPagamento)(ex, input('ORDER-1'))).toEqual({
      id: 55,
      duplicado: true
    });
    expect(chamadas.some(c => /GEN_ID|INSERT/.test(c.sql))).toBe(false);
  });
  it('sem order id igual mas mesma REFERENCIA (pagamento manual reenviado): duplicado', async () => {
    const {
      ex
    } = fakeExecutor([[/CIELO_ORDER_ID = \?/, []], [/REFERENCIA = \?/, p => p[1] === 'M:7:abc' ? [{
      ID: 56
    }] : []]]);
    expect(await (0, _pagamentos.inserirPagamento)(ex, input('ORDER-2', 'M:7:abc'))).toEqual({
      id: 56,
      duplicado: true
    });
  });
  it('corrida: INSERT viola UK_CIELO_PAG_ORDER_EXPR (gdscode 335544349) → busca de novo e devolve o vencedor', async () => {
    let inseridos = 0;
    const erro = new Error('attempt to store duplicate value (visible to active transactions) in unique index "UK_CIELO_PAG_ORDER_EXPR"');
    erro.gdscode = 335544349;
    const {
      ex
    } = fakeExecutor([[/CIELO_ORDER_ID = \?/, () => inseridos ? [{
      ID: 77
    }] : []], [/GEN_ID\(G_CIELO_PAGAMENTOS,/, [{
      ID: 78
    }]], [/INSERT INTO CIELO_PAGAMENTOS/, () => {
      inseridos++;
      throw erro;
    }]]);
    expect(await (0, _pagamentos.inserirPagamento)(ex, input('ORDER-9'))).toEqual({
      id: 77,
      duplicado: true
    });
  });
  it('outro erro do Firebird propaga', async () => {
    const erro = new Error('arithmetic exception, numeric overflow, or string truncation');
    erro.gdscode = 335544321;
    const {
      ex
    } = fakeExecutor([[/GEN_ID\(G_CIELO_PAGAMENTOS,/, [{
      ID: 1
    }]], [/INSERT INTO CIELO_PAGAMENTOS/, erro]]);
    await expect((0, _pagamentos.inserirPagamento)(ex, input('ORDER-X'))).rejects.toThrow(/string truncation/);
  });
  it('grava itens na mesma transação quando vêm', async () => {
    const {
      ex,
      chamadas
    } = fakeExecutor([[/GEN_ID\(G_CIELO_PAGAMENTOS,/, [{
      ID: 10
    }]], [/GEN_ID\(G_CIELO_PAGAMENTOS_ITENS/, [{
      ID: 900
    }]]]);
    await (0, _pagamentos.inserirPagamento)(ex, {
      ...input('ORDER-I'),
      itens: [{
        codItem: 5,
        codConjuga: 0,
        qtde: 1,
        valor: 50
      }]
    });
    const it = chamadas.find(c => c.sql.startsWith('INSERT INTO CIELO_PAGAMENTOS_ITENS'));
    expect(it.params).toEqual([900, 10, 7, 5, 0, 1, 50]);
  });
});
describe('listarPagamentos — filtro igual ao do PDV', () => {
  it("STATUS_CODE IN ('0','1') sem COALESCE, ESTORNADO_POR IS NULL, devolve manual/consumido", async () => {
    const {
      ex,
      chamadas
    } = fakeExecutor([[/FROM CIELO_PAGAMENTOS P/, [{
      ID: 1,
      PROVIDER: 'CIELO',
      TRANSACTION_TYPE: 'INSTANT_PAYMENT',
      MEIO_PAGAMENTO: 'PIX',
      BANDEIRA: '',
      VALOR_PAGO: 10.5,
      AUTH_CODE: 'E2E',
      NSU: '',
      CONSUMIDO: 'N',
      MANUAL: 'S'
    }, {
      ID: 2,
      PROVIDER: 'STONE',
      TRANSACTION_TYPE: 'CREDIT',
      MEIO_PAGAMENTO: 'CREDIT',
      BANDEIRA: 'VISA',
      VALOR_PAGO: 20,
      AUTH_CODE: '123',
      NSU: '123',
      CONSUMIDO: 'S',
      MANUAL: 'N'
    }]], [/FROM CIELO_PAGAMENTOS_ITENS I/, [{
      COD_ITEM: 3,
      COD_CONJUGA: 0,
      QTDE: 1,
      VALOR: 10.5
    }]]]);
    mockFb.withDb.mockImplementation(fn => fn(ex));
    const r = await (0, _pagamentos.listarPagamentos)('M', 7);
    expect(r.totalPago).toBe(30.5);
    expect(r.pagamentos[0]).toMatchObject({
      id: 1,
      manual: true,
      consumido: false
    });
    expect(r.pagamentos[1]).toMatchObject({
      id: 2,
      manual: false,
      consumido: true
    });
    expect(r.itensPagos).toEqual([{
      codItem: 3,
      codConjuga: 0,
      qtde: 1,
      valor: 10.5
    }]);
    for (const c of chamadas) {
      expect(c.sql).toMatch(/P\.STATUS_CODE IN \('0', '1'\)/);
      expect(c.sql).not.toMatch(/COALESCE\(P\.STATUS_CODE/);
      expect(c.sql).toMatch(/COALESCE\(P\.ORIGEM, 'M'\) = \?/);
      expect(c.sql).toMatch(/P\.ESTORNADO_POR IS NULL/);
      expect(c.params).toEqual([7, 'M']);
    }
  });
});
describe('estornarManual', () => {
  /** O mesmo executor atende a leitura do BLOB (withDb, auto-commit) e a transação com WITH LOCK. */
  const comBanco = ex => {
    mockFb.withTransaction.mockImplementation(fn => fn(ex));
    mockFb.withDb.mockImplementation(fn => fn(ex));
  };
  it('404 quando não existe', async () => {
    const {
      ex
    } = fakeExecutor([[/WITH LOCK/, []], [/SELECT CAST\(PAYLOAD_JSON AS VARCHAR\(32000\)\)/, []]]);
    comBanco(ex);
    await expect((0, _pagamentos.estornarManual)(9, {
      motivo: 'x'
    })).rejects.toMatchObject({
      httpStatus: 404
    });
  });
  it('409 quando já estornado (pela fila ou manual)', async () => {
    const {
      ex
    } = fakeExecutor([[/WITH LOCK/, [{
      ID: 9,
      ESTORNADO_POR: 'uuid-estorno'
    }]], [/SELECT CAST\(PAYLOAD_JSON AS VARCHAR\(32000\)\)/, [{
      P: '{}'
    }]]]);
    comBanco(ex);
    const err = await (0, _pagamentos.estornarManual)(9, {
      motivo: 'x'
    }).catch(e => e);
    expect(err).toBeInstanceOf(_pagamentos.PagamentoError);
    expect(err).toMatchObject({
      httpStatus: 409,
      extra: {
        estornadoPor: 'uuid-estorno'
      }
    });
  });
  it('lê o payload por CAST fora da transação (auto-commit) e só então trava a linha', async () => {
    const {
      ex,
      chamadas
    } = fakeExecutor([[/SELECT CAST\(PAYLOAD_JSON AS VARCHAR\(32000\)\)/, [{
      P: '{}'
    }]], [/WITH LOCK/, [{
      ID: 9,
      ESTORNADO_POR: null
    }]]]);
    comBanco(ex);
    await (0, _pagamentos.estornarManual)(9, {
      motivo: 'm'
    });
    expect(chamadas[0].sql).toMatch(/^SELECT CAST\(PAYLOAD_JSON AS VARCHAR\(32000\)\) AS P/);
    expect(chamadas[1].sql).toMatch(/WITH LOCK/);
    expect(chamadas[1].sql).not.toMatch(/PAYLOAD_JSON/);
  });
  it('se a leitura do payload falhar (CAST estourou, banco fora), estorna mesmo assim sem mexer no PAYLOAD_JSON', async () => {
    const {
      ex,
      chamadas
    } = fakeExecutor([[/SELECT CAST\(PAYLOAD_JSON AS VARCHAR\(32000\)\)/, Object.assign(new Error('arithmetic exception, numeric overflow, or string truncation'), {
      gdscode: 335544321
    })], [/WITH LOCK/, [{
      ID: 9,
      ESTORNADO_POR: null
    }]]]);
    comBanco(ex);
    const r = await (0, _pagamentos.estornarManual)(9, {
      motivo: 'm'
    });
    expect(r.estornadoPor).toBe('MANUAL');
    const upd = chamadas.find(c => c.sql.startsWith('UPDATE CIELO_PAGAMENTOS'));
    expect(upd.sql).toMatch(/ESTORNADO_POR = 'MANUAL', ESTORNADO_EM = CURRENT_TIMESTAMP WHERE ID = \?/);
    expect(upd.sql).not.toMatch(/PAYLOAD_JSON/);
    expect(upd.params).toEqual([9]);
  });
  it('marca MANUAL + ESTORNADO_EM e mescla usuário/motivo no PAYLOAD_JSON sem perder o cru', async () => {
    const cru = {
      id: 'ORDER-1',
      payments: [{
        authCode: 'E2E'
      }]
    };
    const {
      ex,
      chamadas
    } = fakeExecutor([[/SELECT CAST\(PAYLOAD_JSON AS VARCHAR\(32000\)\)/, [{
      P: Buffer.from(JSON.stringify(cru))
    }]], [/WITH LOCK/, [{
      ID: 9,
      ESTORNADO_POR: null
    }]]]);
    comBanco(ex);
    const r = await (0, _pagamentos.estornarManual)(9, {
      usuario: 'caixa1',
      motivo: 'Pix devolvido no portal'
    });
    expect(r).toMatchObject({
      id: 9,
      estornadoPor: 'MANUAL'
    });
    const upd = chamadas.find(c => c.sql.startsWith('UPDATE CIELO_PAGAMENTOS'));
    expect(upd.sql).toMatch(/ESTORNADO_POR = 'MANUAL', ESTORNADO_EM = CURRENT_TIMESTAMP, PAYLOAD_JSON = \?/);
    expect(upd.sql).not.toMatch(/REFERENCIA/);
    const payload = JSON.parse(upd.params[0]);
    expect(payload.id).toBe('ORDER-1');
    expect(payload.payments).toEqual(cru.payments);
    expect(payload.estornoManual).toMatchObject({
      usuario: 'caixa1',
      motivo: 'Pix devolvido no portal'
    });
    expect(upd.params[1]).toBe(9);
  });
  it('PAYLOAD_JSON que não é JSON vira { raw } e não quebra', async () => {
    const {
      ex,
      chamadas
    } = fakeExecutor([[/SELECT CAST\(PAYLOAD_JSON AS VARCHAR\(32000\)\)/, [{
      P: 'lixo'
    }]], [/WITH LOCK/, [{
      ID: 9,
      ESTORNADO_POR: ''
    }]]]);
    comBanco(ex);
    await (0, _pagamentos.estornarManual)(9, {
      motivo: 'm'
    });
    const payload = JSON.parse(chamadas.find(c => c.sql.startsWith('UPDATE')).params[0]);
    expect(payload).toMatchObject({
      raw: 'lixo',
      estornoManual: {
        motivo: 'm',
        usuario: null
      }
    });
  });
});
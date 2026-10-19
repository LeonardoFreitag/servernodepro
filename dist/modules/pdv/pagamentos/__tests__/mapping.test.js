"use strict";

var _pagamentos = require("../pagamentos.mapping");
/** E2E ID de Pix (32 chars) — era truncado em 20 pela API antiga. */
const E2E = 'E18236120202510191830s0123456789';
const cieloResponse = {
  id: 'ORDER-123',
  price: 5000,
  paidAmount: 5000,
  payments: [{
    amount: 5000,
    installments: 1,
    brand: 'VISA',
    authCode: 'A1B2C3',
    cieloCode: 'CC-9',
    externalId: 'EXT-1',
    terminal: 'LIO-0001',
    merchantCode: 'EC-77',
    mask: '**** 1234',
    paymentFields: {
      paymentTransactionId: 'NSU-555',
      primaryProductName: 'CREDITO',
      secondaryProductName: 'A VISTA',
      statusCode: '1'
    }
  }]
};
describe('transactionTypeFromCieloPaymentCode', () => {
  it.each([['CREDITO_AVISTA', 'CREDIT'], ['CREDITO_PARCELADO_LOJA', 'CREDIT'], ['DEBITO_AVISTA', 'DEBIT'], ['PIX', 'INSTANT_PAYMENT'], ['VOUCHER_REFEICAO', 'VOUCHER'], ['VOUCHER_ALIMENTACAO', 'VOUCHER']])('%s → %s', (code, expected) => {
    expect((0, _pagamentos.transactionTypeFromCieloPaymentCode)(code)).toBe(expected);
  });
  it('desconhecido → null', () => {
    expect((0, _pagamentos.transactionTypeFromCieloPaymentCode)('XPTO')).toBeNull();
    expect((0, _pagamentos.transactionTypeFromCieloPaymentCode)(undefined)).toBeNull();
  });
});
describe('mapPagamentoToColumns — CIELO', () => {
  it('extrai payments[0] como o registrarPagamento antigo', () => {
    const c = (0, _pagamentos.mapPagamentoToColumns)({
      provider: 'CIELO',
      origem: 'M',
      codVenda: 7,
      cobrancaId: 'uuid-1',
      transactionType: 'CREDIT',
      installments: 1,
      amountCents: 5000,
      totalCents: 5000,
      providerData: {
        paymentCode: 'CREDITO_AVISTA'
      },
      rawResponse: cieloResponse
    });
    expect(c).toMatchObject({
      COD_MESA: 7,
      CIELO_ORDER_ID: 'ORDER-123',
      MEIO_PAGAMENTO: 'CREDITO_AVISTA',
      BANDEIRA: 'VISA',
      VALOR_TOTAL: 50,
      VALOR_PAGO: 50,
      PARCELAS: 1,
      AUTH_CODE: 'A1B2C3',
      CIELO_CODE: 'CC-9',
      NSU: 'NSU-555',
      TERMINAL: 'LIO-0001',
      COD_EC: 'EC-77',
      MASK_CARTAO: '**** 1234',
      PRODUTO_PRIMARIO: 'CREDITO',
      PROD_SECUNDARIO: 'A VISTA',
      STATUS_CODE: '1',
      PROVIDER: 'CIELO',
      ORIGEM: 'M',
      TRANSACTION_TYPE: 'CREDIT',
      ATK: null,
      COBRANCA_ID: 'uuid-1',
      REFERENCIA: null,
      MANUAL: 'N'
    });
    expect(JSON.parse(c.PAYLOAD_JSON)).toEqual(cieloResponse);
  });
  it('Pix: authCode de 32 chars inteiro, brand vazio, STATUS_CODE 0, tipo INSTANT_PAYMENT', () => {
    const raw = {
      ...cieloResponse,
      id: 'ORDER-PIX',
      payments: [{
        ...cieloResponse.payments[0],
        brand: '',
        authCode: E2E,
        paymentCode: 'PIX',
        paymentFields: {
          ...cieloResponse.payments[0].paymentFields,
          primaryProductName: 'PIX',
          secondaryProductName: '',
          statusCode: '1'
        }
      }]
    };
    const c = (0, _pagamentos.mapPagamentoToColumns)({
      provider: 'CIELO',
      origem: 'M',
      codVenda: 55,
      transactionType: 'INSTANT_PAYMENT',
      amountCents: 5000,
      providerData: {
        paymentCode: 'PIX',
        reference: 'M:55:3f2a1c9e-0000-4000-8000-000000000001'
      },
      rawResponse: raw
    });
    expect(c.AUTH_CODE).toBe(E2E);
    expect(c.AUTH_CODE).toHaveLength(32);
    expect(c.BANDEIRA).toBeNull();
    expect(c).toMatchObject({
      CIELO_ORDER_ID: 'ORDER-PIX',
      MEIO_PAGAMENTO: 'PIX',
      TRANSACTION_TYPE: 'INSTANT_PAYMENT',
      STATUS_CODE: '0',
      REFERENCIA: 'M:55:3f2a1c9e-0000-4000-8000-000000000001',
      MANUAL: 'N'
    });
  });
  it('Pix sem paymentCode: detecta por primaryProductName (fallback da FAQ Cielo)', () => {
    const raw = {
      ...cieloResponse,
      id: 'ORDER-PIX2',
      payments: [{
        ...cieloResponse.payments[0],
        brand: undefined,
        authCode: E2E,
        paymentFields: {
          primaryProductName: 'Pix',
          statusCode: '1'
        }
      }]
    };
    // o app pediu CREDIT por engano/legado — o que a maquineta fez (Pix) prevalece
    const c = (0, _pagamentos.mapPagamentoToColumns)({
      provider: 'CIELO',
      origem: 'M',
      codVenda: 55,
      transactionType: 'CREDIT',
      amountCents: 5000,
      providerData: {},
      rawResponse: raw
    });
    expect(c).toMatchObject({
      MEIO_PAGAMENTO: 'PIX',
      TRANSACTION_TYPE: 'INSTANT_PAYMENT',
      STATUS_CODE: '0',
      AUTH_CODE: E2E
    });
  });
  it('paymentCode da maquineta manda no TRANSACTION_TYPE (app pediu CREDIT, saiu DEBITO)', () => {
    const c = (0, _pagamentos.mapPagamentoToColumns)({
      provider: 'CIELO',
      origem: 'M',
      codVenda: 1,
      transactionType: 'CREDIT',
      amountCents: 100,
      providerData: {
        paymentCode: 'DEBITO_AVISTA'
      },
      rawResponse: cieloResponse
    });
    expect(c.TRANSACTION_TYPE).toBe('DEBIT');
    expect(c.STATUS_CODE).toBe('1');
  });
  it('AUTH_CODE/CIELO_CODE cortam em 40 (não mais 20)', () => {
    const raw = {
      ...cieloResponse,
      payments: [{
        ...cieloResponse.payments[0],
        authCode: 'A'.repeat(45),
        cieloCode: 'C'.repeat(45)
      }]
    };
    const c = (0, _pagamentos.mapPagamentoToColumns)({
      provider: 'CIELO',
      origem: 'M',
      codVenda: 1,
      transactionType: 'CREDIT',
      amountCents: 100,
      rawResponse: raw
    });
    expect(c.AUTH_CODE).toHaveLength(40);
    expect(c.CIELO_CODE).toHaveLength(40);
  });
  it('pagamento manual (resposta perdida): MANUAL=S e CIELO_ORDER_ID cai para a referência', () => {
    const reference = 'M:77:9b1d2e3f-0000-4000-8000-000000000002';
    const c = (0, _pagamentos.mapPagamentoToColumns)({
      provider: 'CIELO',
      origem: 'M',
      codVenda: 77,
      transactionType: 'INSTANT_PAYMENT',
      amountCents: 2500,
      providerData: {
        paymentCode: 'PIX',
        manual: true,
        reference
      },
      rawResponse: {
        manual: true,
        motivo: 'app reiniciou',
        reference,
        iniciadoEm: '2026-10-19T10:00:00Z'
      }
    });
    expect(c).toMatchObject({
      MANUAL: 'S',
      REFERENCIA: reference,
      CIELO_ORDER_ID: reference,
      STATUS_CODE: '0',
      AUTH_CODE: null,
      MEIO_PAGAMENTO: 'PIX'
    });
  });
  it('NSU cai para externalId sem paymentTransactionId; mask cai para pan', () => {
    const raw = {
      ...cieloResponse,
      payments: [{
        ...cieloResponse.payments[0],
        mask: undefined,
        paymentFields: {
          pan: '5555'
        }
      }]
    };
    const c = (0, _pagamentos.mapPagamentoToColumns)({
      provider: 'CIELO',
      origem: 'B',
      codVenda: 1,
      transactionType: 'DEBIT',
      amountCents: 1000,
      providerData: {
        paymentCode: 'DEBITO_AVISTA'
      },
      rawResponse: raw
    });
    expect(c.NSU).toBe('EXT-1');
    expect(c.MASK_CARTAO).toBe('5555');
    expect(c.STATUS_CODE).toBe('1');
    expect(c.VALOR_TOTAL).toBe(50); // totalCents ausente → cai para rawResponse.price
  });
});
describe('mapPagamentoToColumns — STONE', () => {
  it('mapeia providerData normalizado (ATK, ITK→CIELO_CODE, NSU=authorizationCode)', () => {
    const c = (0, _pagamentos.mapPagamentoToColumns)({
      provider: 'STONE',
      origem: 'E',
      codVenda: 789,
      cobrancaId: 'uuid-2',
      terminalId: 'T1',
      transactionType: 'CREDIT',
      installments: 3,
      amountCents: 4500,
      totalCents: 4500,
      providerData: {
        atk: 'ATK-0001',
        itk: 'ITK-9',
        authorizationCode: '123456',
        brand: 'MASTERCARD',
        panMasked: '**** 9876',
        entryMode: 'CHIP',
        installmentCount: 3,
        transactionType: 'CREDIT',
        orderId: 'uuid-2'
      },
      rawResponse: {
        atk: 'ATK-0001'
      }
    });
    expect(c).toMatchObject({
      COD_MESA: 789,
      CIELO_ORDER_ID: 'uuid-2',
      MEIO_PAGAMENTO: 'CREDIT',
      BANDEIRA: 'MASTERCARD',
      VALOR_TOTAL: 45,
      VALOR_PAGO: 45,
      PARCELAS: 3,
      AUTH_CODE: '123456',
      CIELO_CODE: 'ITK-9',
      NSU: '123456',
      TERMINAL: 'T1',
      COD_EC: null,
      MASK_CARTAO: '**** 9876',
      PRODUTO_PRIMARIO: 'CHIP',
      STATUS_CODE: '1',
      PROVIDER: 'STONE',
      ORIGEM: 'E',
      TRANSACTION_TYPE: 'CREDIT',
      ATK: 'ATK-0001',
      COBRANCA_ID: 'uuid-2'
    });
  });
  it('Pix → STATUS_CODE 0', () => {
    const c = (0, _pagamentos.mapPagamentoToColumns)({
      provider: 'STONE',
      origem: 'B',
      codVenda: 1,
      transactionType: 'INSTANT_PAYMENT',
      amountCents: 100,
      providerData: {
        atk: 'x'
      }
    });
    expect(c.STATUS_CODE).toBe('0');
  });
  it('CIELO_ORDER_ID nunca fica nulo quando há ATK ou referência (proteção do índice único)', () => {
    const soAtk = (0, _pagamentos.mapPagamentoToColumns)({
      provider: 'STONE',
      origem: 'B',
      codVenda: 1,
      transactionType: 'CREDIT',
      amountCents: 100,
      providerData: {
        atk: 'ATK-77'
      }
    });
    expect(soAtk.CIELO_ORDER_ID).toBe('ATK-77');
    const soRef = (0, _pagamentos.mapPagamentoToColumns)({
      provider: 'STONE',
      origem: 'B',
      codVenda: 1,
      transactionType: 'CREDIT',
      amountCents: 100,
      providerData: {
        reference: 'B:1:abc'
      }
    });
    expect(soRef).toMatchObject({
      CIELO_ORDER_ID: 'B:1:abc',
      REFERENCIA: 'B:1:abc',
      ATK: null
    });
    const nada = (0, _pagamentos.mapPagamentoToColumns)({
      provider: 'STONE',
      origem: 'B',
      codVenda: 1,
      transactionType: 'CREDIT',
      amountCents: 100
    });
    expect(nada.CIELO_ORDER_ID).toBeNull();
  });
  it('REFERENCIA vem de providerData.reference, senão do order_id ecoado', () => {
    const c = (0, _pagamentos.mapPagamentoToColumns)({
      provider: 'STONE',
      origem: 'E',
      codVenda: 9,
      transactionType: 'DEBIT',
      amountCents: 100,
      providerData: {
        atk: 'A',
        orderId: 'E:9:idlocal'
      },
      rawResponse: {
        order_id: 'E:9:idlocal'
      }
    });
    expect(c.REFERENCIA).toBe('E:9:idlocal');
    expect(c.CIELO_ORDER_ID).toBe('E:9:idlocal');
    expect(c.MANUAL).toBe('N');
  });
});
describe('isPixCielo / statusCodeDe', () => {
  it.each([['PIX', undefined, undefined, true], ['', 'PIX', undefined, true], ['', 'Pix Cielo', 'CREDIT', true], ['', '', 'INSTANT_PAYMENT', true], ['CREDITO_AVISTA', 'CREDITO', 'CREDIT', false], [undefined, undefined, undefined, false]])('paymentCode=%p produto=%p tipo=%p → %p', (code, produto, tipo, esperado) => {
    expect((0, _pagamentos.isPixCielo)(code, produto, tipo)).toBe(esperado);
  });
  it('STATUS_CODE: Pix 0, demais 1 (contrato com o PDV)', () => {
    expect((0, _pagamentos.statusCodeDe)('INSTANT_PAYMENT')).toBe('0');
    expect((0, _pagamentos.statusCodeDe)('CREDIT')).toBe('1');
    expect((0, _pagamentos.statusCodeDe)('DEBIT')).toBe('1');
    expect((0, _pagamentos.statusCodeDe)('VOUCHER')).toBe('1');
  });
});
describe('validarPagamentoInput', () => {
  const ok = {
    provider: 'CIELO',
    origem: 'M',
    codVenda: 1,
    transactionType: 'CREDIT',
    amountCents: 100
  };
  it('aceita corpo mínimo com defaults', () => {
    const {
      input,
      error
    } = (0, _pagamentos.validarPagamentoInput)(ok);
    expect(error).toBeUndefined();
    expect(input).toMatchObject({
      installments: 1,
      totalCents: 100,
      cobrancaId: null
    });
  });
  it.each([[{
    ...ok,
    provider: 'PAGSEGURO'
  }, /provider/], [{
    ...ok,
    origem: 'X'
  }, /origem/], [{
    ...ok,
    codVenda: 0
  }, /codVenda/], [{
    ...ok,
    transactionType: 'CARD'
  }, /transactionType/], [{
    ...ok,
    amountCents: 10.5
  }, /amountCents/], [{
    ...ok,
    installments: 0
  }, /installments/], [{
    ...ok,
    itens: 'x'
  }, /itens deve ser uma lista/], [{
    ...ok,
    itens: [{
      codItem: 0,
      qtde: 1,
      valor: 1
    }]
  }, /itens\[0\]\.codItem/], [{
    ...ok,
    itens: [{
      codItem: 5,
      qtde: 0,
      valor: 1
    }]
  }, /itens\[0\]\.qtde/], [{
    ...ok,
    itens: [{
      codItem: 5,
      qtde: 1,
      valor: -1
    }]
  }, /itens\[0\]\.valor/]])('rejeita %j', (body, re) => {
    expect((0, _pagamentos.validarPagamentoInput)(body).error).toMatch(re);
  });
  it('itens ausente ou vazio → null', () => {
    expect((0, _pagamentos.validarPagamentoInput)(ok).input?.itens).toBeNull();
    expect((0, _pagamentos.validarPagamentoInput)({
      ...ok,
      itens: []
    }).input?.itens).toBeNull();
  });
  it('normaliza itens (codConjuga default 0, qtde 3 casas, valor 2 casas)', () => {
    const {
      input,
      error
    } = (0, _pagamentos.validarPagamentoInput)({
      ...ok,
      itens: [{
        codItem: 7,
        qtde: 2,
        valor: 12.345
      }, {
        codItem: 8,
        codConjuga: 3,
        qtde: 0.3504,
        valor: 9
      }]
    });
    expect(error).toBeUndefined();
    expect(input?.itens).toEqual([{
      codItem: 7,
      codConjuga: 0,
      qtde: 2,
      valor: 12.35
    }, {
      codItem: 8,
      codConjuga: 3,
      qtde: 0.35,
      valor: 9
    }]);
  });
});
describe('legacyCieloBodyToInput (POST /cielo/pagamento)', () => {
  it('converte corpo antigo para provider CIELO / origem M', () => {
    const {
      input,
      error
    } = (0, _pagamentos.legacyCieloBodyToInput)({
      codMesa: 7,
      paymentCode: 'DEBITO_AVISTA',
      cieloResponse
    });
    expect(error).toBeUndefined();
    expect(input).toMatchObject({
      provider: 'CIELO',
      origem: 'M',
      codVenda: 7,
      transactionType: 'DEBIT',
      installments: 1,
      amountCents: 5000,
      totalCents: 5000,
      providerData: {
        paymentCode: 'DEBITO_AVISTA'
      }
    });
    const c = (0, _pagamentos.mapPagamentoToColumns)(input);
    expect(c.MEIO_PAGAMENTO).toBe('DEBITO_AVISTA');
    expect(c.VALOR_PAGO).toBe(50);
  });
  it('exige os três campos como antes', () => {
    expect((0, _pagamentos.legacyCieloBodyToInput)({
      codMesa: 7
    }).error).toMatch(/obrigatórios/);
  });
  it('Pix com paymentCode desconhecido cai para INSTANT_PAYMENT pelo primaryProductName', () => {
    const resp = {
      ...cieloResponse,
      payments: [{
        ...cieloResponse.payments[0],
        authCode: E2E,
        paymentFields: {
          primaryProductName: 'PIX'
        }
      }]
    };
    const {
      input
    } = (0, _pagamentos.legacyCieloBodyToInput)({
      codMesa: 7,
      paymentCode: 'XPTO',
      cieloResponse: resp
    });
    expect(input.transactionType).toBe('INSTANT_PAYMENT');
    const c = (0, _pagamentos.mapPagamentoToColumns)(input);
    expect(c).toMatchObject({
      STATUS_CODE: '0',
      AUTH_CODE: E2E,
      TRANSACTION_TYPE: 'INSTANT_PAYMENT'
    });
  });
});
describe('origens por modo (config.modo)', () => {
  const carregar = modo => {
    let mod;
    jest.isolateModules(() => {
      const anterior = process.env.MODO;
      process.env.MODO = modo;
      mod = require("../pagamentos.mapping");
      process.env.MODO = anterior;
    });
    return mod;
  };
  it('METTRE aceita M | B | E e recusa V', () => {
    const m = carregar('METTRE');
    expect([...m.ORIGENS]).toEqual(['M', 'B', 'E']);
    expect(m.isOrigem('M')).toBe(true);
    expect(m.isOrigem('V')).toBe(false);
  });
  it('AUTOMAX aceita V | S | A e recusa M (loja AutoMax, Firebird 5)', () => {
    const m = carregar('AUTOMAX');
    expect([...m.ORIGENS]).toEqual(['V', 'S', 'A']);
    expect(m.isOrigem('V')).toBe(true);
    expect(m.isOrigem('M')).toBe(false);
    expect(m.validarPagamentoInput({
      provider: 'CIELO',
      origem: 'M',
      codVenda: 1,
      transactionType: 'CREDIT',
      amountCents: 100
    }).error).toMatch(/V \| S \| A/);
  });
});
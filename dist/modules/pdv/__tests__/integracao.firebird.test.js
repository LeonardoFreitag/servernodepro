"use strict";

var _fb = require("../../../shared/database/fb");
var pag = _interopRequireWildcard(require("../pagamentos/pagamentos.service"));
var cob = _interopRequireWildcard(require("../cobrancas/cobrancas.service"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); } /**
 * Teste de INTEGRAÇÃO contra um Firebird real (item 7 dos critérios de aceite).
 * Exercita o SQL de verdade: WITH LOCK, transações, EXECUTE PROCEDURE, SELECT FIRST,
 * RETURNING, os triggers BI0/BU0, a P_COBRANCAS_EXPIRAR, o índice único por
 * expressão UK_CIELO_PAG_ORDER_EXPR (Script23) e o estorno manual.
 *
 * NÃO roda por padrão (precisa de um Firebird com o schema criado). Para rodar:
 *   1. suba um Firebird descartável e crie o schema com
 *      `__tests__/fixtures/schema_teste.sql` (DDL real do Script21 + Script23);
 *   2. aponte o .env para esse banco;
 *   3. `FB_INTEGRATION=1 npm test -- integracao`.
 *
 * Sem a variável, os blocos são pulados e `npm test` continua verde sem banco.
 *
 * Observação sobre o driver: node-firebird 0.9.9 só fala Legacy_Auth. Num
 * Firebird 3 de testes é preciso `AuthServer = Srp, Legacy_Auth`,
 * `UserManager = Srp, Legacy_UserManager` e `WireCrypt = Disabled` no
 * firebird.conf — o Firebird 2.5 de produção já é legacy por natureza.
 */
const rodarIntegracao = process.env.FB_INTEGRATION === '1';
const bloco = rodarIntegracao ? describe : describe.skip;
const cieloResponse = {
  id: 'ORDER-1',
  price: 5000,
  paidAmount: 5000,
  payments: [{
    amount: 5000,
    installments: 1,
    brand: 'VISA',
    authCode: 'A1B2C3',
    cieloCode: 'CC9',
    externalId: 'EXT1',
    terminal: 'LIO-1',
    merchantCode: 'EC77',
    mask: '**** 1234',
    paymentFields: {
      paymentTransactionId: 'NSU555',
      primaryProductName: 'CREDITO',
      secondaryProductName: 'A VISTA',
      statusCode: '1'
    }
  }]
};

/** Mesma resposta com outro order id — cada pagamento precisa do seu (idempotência). */
const cielo = orderId => ({
  ...cieloResponse,
  id: orderId
});
async function limpar() {
  await (0, _fb.fbQuery)('DELETE FROM COBRANCAS_TERMINAL');
  await (0, _fb.fbQuery)('DELETE FROM CIELO_PAGAMENTOS');
}

/** Insere uma cobrança como o PDV faria (SQL direto) e devolve o ID gerado pelo trigger. */
async function inserirCobranca(campos) {
  const cols = Object.keys(campos);
  const sql = `INSERT INTO COBRANCAS_TERMINAL (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) RETURNING ID`;
  const r = await (0, _fb.fbQuery)(sql, cols.map(c => campos[c]));
  return String(r.ID ?? r[0]?.ID).trim();
}
const base = {
  ORIGEM: 'B',
  COD_VENDA: 1,
  VALOR: 10,
  MODO: 'A',
  TERMINAL_ID: 'CAIXA1'
};
if (rodarIntegracao) {
  beforeAll(limpar);
  afterAll(limpar);
}
bloco('pagamentos', () => {
  it('registrarPagamento grava todas as colunas novas', async () => {
    const {
      id,
      duplicado
    } = await pag.registrarPagamento({
      provider: 'CIELO',
      origem: 'M',
      codVenda: 7,
      cobrancaId: null,
      transactionType: 'CREDIT',
      installments: 1,
      amountCents: 5000,
      totalCents: 5000,
      providerData: {
        paymentCode: 'CREDITO_AVISTA'
      },
      rawResponse: cielo('ORDER-1')
    });
    expect(id).toBeGreaterThan(0);
    expect(duplicado).toBe(false);
    const [row] = await (0, _fb.fbQuery)('SELECT * FROM CIELO_PAGAMENTOS WHERE ID = ?', [id]);
    expect(row.PROVIDER.trim()).toBe('CIELO');
    expect(row.STATUS_CODE.trim()).toBe('1');
    expect(row.MANUAL.trim()).toBe('N');
    expect(row.ORIGEM.trim()).toBe('M');
    expect(row.TRANSACTION_TYPE.trim()).toBe('CREDIT');
    expect(row.MEIO_PAGAMENTO.trim()).toBe('CREDITO_AVISTA');
    expect(Number(row.VALOR_PAGO)).toBe(50);
    expect(row.ATK).toBeNull();
    expect(row.COBRANCA_ID).toBeNull();
    expect(row.DATA_HORA).toBeInstanceOf(Date);
  });
  it('listarPagamentos soma e filtra por origem', async () => {
    const r = await pag.listarPagamentos('M', 7);
    expect(r.totalPago).toBe(50);
    expect(r.pagamentos[0]).toMatchObject({
      provider: 'CIELO',
      transactionType: 'CREDIT',
      estornado: false,
      consumido: false
    });
    expect((await pag.listarPagamentos('B', 7)).pagamentos).toHaveLength(0);
  });
  it('grava Stone com ATK', async () => {
    const {
      id
    } = await pag.registrarPagamento({
      provider: 'STONE',
      origem: 'E',
      codVenda: 789,
      transactionType: 'CREDIT',
      installments: 3,
      amountCents: 4500,
      totalCents: 4500,
      terminalId: 'CAIXA1',
      providerData: {
        atk: 'ATK-1',
        itk: 'ITK-9',
        authorizationCode: '123456',
        brand: 'MASTERCARD',
        panMasked: '**** 9876',
        entryMode: 'CHIP',
        installmentCount: 3,
        transactionType: 'CREDIT',
        orderId: 'ord-1'
      },
      rawResponse: {
        atk: 'ATK-1'
      }
    });
    const [row] = await (0, _fb.fbQuery)('SELECT ATK, CIELO_CODE, NSU, PARCELAS, TERMINAL FROM CIELO_PAGAMENTOS WHERE ID = ?', [id]);
    expect(row.ATK.trim()).toBe('ATK-1');
    expect(row.CIELO_CODE.trim()).toBe('ITK-9');
    expect(row.NSU.trim()).toBe('123456');
    expect(row.PARCELAS).toBe(3);
    expect(row.TERMINAL.trim()).toBe('CAIXA1');
  });
});
bloco('idempotência e Script23', () => {
  const E2E = 'E18236120202510191830s0123456789';
  const pix = {
    provider: 'CIELO',
    origem: 'M',
    codVenda: 31,
    transactionType: 'INSTANT_PAYMENT',
    installments: 1,
    amountCents: 4200,
    totalCents: 4200,
    providerData: {
      paymentCode: 'PIX',
      reference: 'M:31:11111111-2222-4333-8444-555555555555'
    },
    rawResponse: {
      ...cielo('ORDER-PIX-31'),
      payments: [{
        ...cieloResponse.payments[0],
        brand: '',
        authCode: E2E,
        paymentFields: {
          primaryProductName: 'PIX',
          statusCode: '1'
        }
      }]
    }
  };
  it('Pix: E2E de 32 chars gravado inteiro, STATUS_CODE 0, REFERENCIA', async () => {
    const {
      id,
      duplicado
    } = await pag.registrarPagamento(pix);
    expect(duplicado).toBe(false);
    const [row] = await (0, _fb.fbQuery)('SELECT AUTH_CODE, STATUS_CODE, TRANSACTION_TYPE, REFERENCIA, CIELO_ORDER_ID FROM CIELO_PAGAMENTOS WHERE ID = ?', [id]);
    expect(row.AUTH_CODE.trim()).toBe(E2E);
    expect(row.STATUS_CODE.trim()).toBe('0');
    expect(row.TRANSACTION_TYPE.trim()).toBe('INSTANT_PAYMENT');
    expect(row.REFERENCIA.trim()).toBe(pix.providerData.reference);
    expect(row.CIELO_ORDER_ID.trim()).toBe('ORDER-PIX-31');
  });
  it('mesmo order id duas vezes → mesmo id, duplicado=true, uma linha só', async () => {
    const a = await pag.registrarPagamento(pix);
    expect(a.duplicado).toBe(true);
    const [{
      N
    }] = await (0, _fb.fbQuery)("SELECT COUNT(*) AS N FROM CIELO_PAGAMENTOS WHERE CIELO_ORDER_ID = 'ORDER-PIX-31'");
    expect(N).toBe(1);
    expect((await pag.listarPagamentos('M', 31)).totalPago).toBe(42);
  });
  it('o índice UK_CIELO_PAG_ORDER_EXPR recusa INSERT direto repetido (proteção no banco)', async () => {
    await expect((0, _fb.fbQuery)(`INSERT INTO CIELO_PAGAMENTOS (ID, COD_MESA, CIELO_ORDER_ID, MEIO_PAGAMENTO, VALOR_TOTAL, VALOR_PAGO, PROVIDER, ORIGEM, STATUS_CODE)
       VALUES (GEN_ID(G_CIELO_PAGAMENTOS, 1), 31, 'ORDER-PIX-31', 'PIX', 1, 1, 'CIELO', 'M', '0')`)).rejects.toThrow(/unique|duplicate/i);
  });
  it('pagamento manual: MANUAL=S, CIELO_ORDER_ID = referência; reenvio é duplicado', async () => {
    const reference = 'M:32:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const manual = {
      provider: 'CIELO',
      origem: 'M',
      codVenda: 32,
      transactionType: 'CREDIT',
      installments: 1,
      amountCents: 1500,
      totalCents: 1500,
      providerData: {
        paymentCode: 'CREDITO_AVISTA',
        manual: true,
        reference
      },
      rawResponse: {
        manual: true,
        motivo: 'app reiniciou',
        reference
      }
    };
    const a = await pag.registrarPagamento(manual);
    const [row] = await (0, _fb.fbQuery)('SELECT MANUAL, CIELO_ORDER_ID, REFERENCIA FROM CIELO_PAGAMENTOS WHERE ID = ?', [a.id]);
    expect(row.MANUAL.trim()).toBe('S');
    expect(row.CIELO_ORDER_ID.trim()).toBe(reference);
    const b = await pag.registrarPagamento(manual);
    expect(b).toEqual({
      id: a.id,
      duplicado: true
    });
    expect((await pag.listarPagamentos('M', 32)).pagamentos[0]).toMatchObject({
      manual: true,
      consumido: false
    });
  });
  it('estorno manual: ESTORNADO_POR=MANUAL, ESTORNADO_EM, payload mesclado, some da listagem; repetição 409', async () => {
    const {
      id
    } = await pag.registrarPagamento({
      ...pix,
      codVenda: 33,
      rawResponse: cielo('ORDER-33'),
      providerData: {
        paymentCode: 'PIX',
        reference: 'M:33:x'
      }
    });
    expect((await pag.listarPagamentos('M', 33)).pagamentos).toHaveLength(1);
    const r = await pag.estornarManual(id, {
      usuario: 'caixa1',
      motivo: 'Pix devolvido no portal'
    });
    expect(r.estornadoPor).toBe('MANUAL');
    const [row] = await (0, _fb.fbQuery)("SELECT ESTORNADO_POR, ESTORNADO_EM, CAST(PAYLOAD_JSON AS VARCHAR(8000)) AS P FROM CIELO_PAGAMENTOS WHERE ID = ?", [id]);
    expect(row.ESTORNADO_POR.trim()).toBe('MANUAL');
    expect(row.ESTORNADO_EM).toBeInstanceOf(Date);
    const payload = JSON.parse(String(row.P));
    expect(payload.id).toBe('ORDER-33');
    expect(payload.estornoManual).toMatchObject({
      usuario: 'caixa1',
      motivo: 'Pix devolvido no portal'
    });
    expect((await pag.listarPagamentos('M', 33)).pagamentos).toHaveLength(0);
    await expect(pag.estornarManual(id, {
      motivo: 'de novo'
    })).rejects.toMatchObject({
      httpStatus: 409
    });
    await expect(pag.estornarManual(999999, {
      motivo: 'x'
    })).rejects.toMatchObject({
      httpStatus: 404
    });
  });
  it('VERSAO_SCRIPTS: health lê 23', async () => {
    const {
      lerScriptAtual
    } = await Promise.resolve().then(() => _interopRequireWildcard(require("../../../shared/database/dbVersion")));
    expect(await lerScriptAtual()).toBeGreaterThanOrEqual(23);
  });
  it('cards/pendentes ignoram CANAL A (canal automax-api)', async () => {
    await inserirCobranca({
      ...base,
      COD_VENDA: 777,
      TERMINAL_ID: 'CANALA',
      CANAL: 'A'
    });
    expect(await cob.listarPendentes('CANALA')).toHaveLength(0);
    await inserirCobranca({
      ORIGEM: 'M',
      COD_VENDA: 778,
      VALOR: 5,
      MODO: 'D',
      DESCRICAO: 'Mesa automax',
      CANAL: 'A'
    });
    expect((await cob.listarCards({
      mesas: true
    })).some(c => c.codVenda === 778)).toBe(false);
  });
});
bloco('attended (MODO A)', () => {
  let id = '';
  it('pendentes devolve no máximo 1 do terminal', async () => {
    id = await inserirCobranca({
      ...base,
      TIPO_PRE: 'CREDIT'
    });
    await inserirCobranca({
      ...base,
      COD_VENDA: 2
    });
    const lista = await cob.listarPendentes('CAIXA1');
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      origem: 'B',
      codVenda: 1,
      valorCents: 1000,
      modo: 'A',
      operacao: 'P',
      status: 'pending',
      tipoPre: 'CREDIT',
      parcelasPre: 1,
      cancelRequested: false,
      alvo: null
    });
    expect(await cob.listarPendentes('CAIXA2')).toHaveLength(0);
  });
  it('claim: primeiro ok, repetido do mesmo terminal ok, de outro 409', async () => {
    expect((await cob.claim(id, 'CAIXA1')).status).toBe('sent_to_terminal');
    expect((await cob.claim(id, 'CAIXA1')).status).toBe('sent_to_terminal');
    await expect(cob.claim(id, 'CAIXA2')).rejects.toMatchObject({
      httpStatus: 409
    });
  });
  it('PATCH de outro terminal em MODO A dá 409', async () => {
    await expect(cob.registrarDesfecho(id, {
      terminalId: 'CAIXA9',
      provider: 'CIELO',
      status: 'declined'
    })).rejects.toMatchObject({
      httpStatus: 409
    });
  });
  it('PATCH approved insere o pagamento e liga PAGAMENTO_ID; repetição não duplica', async () => {
    const dto = await cob.registrarDesfecho(id, {
      terminalId: 'CAIXA1',
      provider: 'CIELO',
      status: 'approved',
      pagamento: {
        transactionType: 'DEBIT',
        installments: 1,
        amountCents: 1000,
        providerData: {
          paymentCode: 'DEBITO_AVISTA'
        },
        rawResponse: cielo('ORDER-2')
      }
    });
    expect(dto.status).toBe('approved');
    expect(dto.pagamentoId).toBeGreaterThan(0);
    const [p] = await (0, _fb.fbQuery)('SELECT COBRANCA_ID, ORIGEM, COD_MESA, TRANSACTION_TYPE, VALOR_PAGO FROM CIELO_PAGAMENTOS WHERE ID = ?', [dto.pagamentoId]);
    expect(p.COBRANCA_ID.trim()).toBe(id);
    expect(p.ORIGEM.trim()).toBe('B');
    expect(p.COD_MESA).toBe(1);
    expect(p.TRANSACTION_TYPE.trim()).toBe('DEBIT');
    expect(Number(p.VALOR_PAGO)).toBe(10);
    const again = await cob.registrarDesfecho(id, {
      terminalId: 'CAIXA1',
      provider: 'CIELO',
      status: 'approved',
      pagamento: {
        transactionType: 'DEBIT',
        installments: 1,
        amountCents: 1000,
        providerData: {},
        rawResponse: {}
      }
    });
    expect(again.pagamentoId).toBe(dto.pagamentoId);
    const [{
      N
    }] = await (0, _fb.fbQuery)('SELECT COUNT(*) AS N FROM CIELO_PAGAMENTOS WHERE COBRANCA_ID = ?', [id]);
    expect(N).toBe(1);
  });
  it('declined grava motivo truncado em 200', async () => {
    const outro = await inserirCobranca({
      ...base,
      COD_VENDA: 3
    });
    await cob.claim(outro, 'CAIXA1');
    const dto = await cob.registrarDesfecho(outro, {
      terminalId: 'CAIXA1',
      provider: 'CIELO',
      status: 'declined',
      motivoErro: 'x'.repeat(300)
    });
    expect(dto.status).toBe('declined');
    expect(dto.motivoErro).toHaveLength(200);
  });
});
bloco('cards (MODO D)', () => {
  it('entregador vê só os seus; mesas=1 traz ORIGEM M; nenhum aparece em pendentes', async () => {
    await inserirCobranca({
      ORIGEM: 'E',
      COD_VENDA: 789,
      VALOR: 45,
      MODO: 'D',
      COD_ENTREGADOR: 3,
      DESCRICAO: 'Entrega 789 - Fulano',
      EXTERNAL_REF: 'E-789'
    });
    await inserirCobranca({
      ORIGEM: 'M',
      COD_VENDA: 55,
      VALOR: 20,
      MODO: 'D',
      DESCRICAO: 'Mesa 12'
    });
    const e3 = await cob.listarCards({
      entregador: 3
    });
    expect(e3).toHaveLength(1);
    expect(e3[0]).toMatchObject({
      origem: 'E',
      codEntregador: 3,
      descricao: 'Entrega 789 - Fulano',
      externalRef: 'E-789',
      modo: 'D'
    });
    expect(await cob.listarCards({
      entregador: 4
    })).toHaveLength(0);
    const mesas = await cob.listarCards({
      mesas: true
    });
    expect(mesas).toHaveLength(1);
    expect(mesas[0].origem).toBe('M');
    expect(await cob.listarPendentes('CAIXA1')).toHaveLength(1); // só as MODO A pendentes
  });
  it('trigger BI0 exige COD_ENTREGADOR em MODO D / ORIGEM E', async () => {
    await expect(inserirCobranca({
      ORIGEM: 'E',
      COD_VENDA: 1,
      VALOR: 1,
      MODO: 'D'
    })).rejects.toThrow();
  });
});
bloco('expiração', () => {
  it('pending vencida expira; sent_to_terminal vencida não', async () => {
    const venc = await inserirCobranca({
      ...base,
      COD_VENDA: 10
    });
    const venc2 = await inserirCobranca({
      ...base,
      COD_VENDA: 11
    });
    await (0, _fb.fbQuery)("UPDATE COBRANCAS_TERMINAL SET EXPIRA_EM = DATEADD(-1 MINUTE TO CURRENT_TIMESTAMP) WHERE ID IN (?, ?)", [venc, venc2]);
    await cob.claim(venc2, 'CAIXA1'); // vira sent_to_terminal

    const qtde = await cob.expirarPendentes();
    expect(qtde).toBeGreaterThanOrEqual(1);
    expect((await cob.obter(venc)).status).toBe('expired');
    expect((await cob.obter(venc2)).status).toBe('sent_to_terminal');
  });
});
bloco('estorno (OPERACAO C)', () => {
  it('DTO traz alvo; approved grava ESTORNADO_POR e some da listagem', async () => {
    const {
      id: pagamentoId
    } = await pag.registrarPagamento({
      provider: 'CIELO',
      origem: 'M',
      codVenda: 90,
      transactionType: 'CREDIT',
      installments: 2,
      amountCents: 1234,
      totalCents: 1234,
      providerData: {
        paymentCode: 'CREDITO_PARCELADO_LOJA'
      },
      rawResponse: cielo('ORDER-3')
    });
    expect((await pag.listarPagamentos('M', 90)).pagamentos).toHaveLength(1);
    const est = await inserirCobranca({
      ORIGEM: 'M',
      COD_VENDA: 90,
      VALOR: 12.34,
      MODO: 'A',
      TERMINAL_ID: 'CAIXA1',
      OPERACAO: 'C',
      ALVO_PAGAMENTO_ID: pagamentoId,
      EXTERNAL_REF: `EST-M-90-${pagamentoId}`
    });
    const dto = await cob.obter(est);
    expect(dto.alvo).toMatchObject({
      pagamentoId,
      provider: 'CIELO',
      atk: null,
      cieloOrderId: 'ORDER-3',
      authCode: 'A1B2C3',
      cieloCode: 'CC9',
      merchantCode: 'EC77',
      valorCents: 1234,
      transactionType: 'CREDIT',
      installments: 2
    });
    await cob.claim(est, 'CAIXA1');
    const fim = await cob.registrarDesfecho(est, {
      terminalId: 'CAIXA1',
      provider: 'CIELO',
      status: 'approved'
    });
    expect(fim.status).toBe('approved');
    const [p] = await (0, _fb.fbQuery)('SELECT ESTORNADO_POR, ESTORNADO_EM FROM CIELO_PAGAMENTOS WHERE ID = ?', [pagamentoId]);
    expect(p.ESTORNADO_POR.trim()).toBe(est);
    expect(p.ESTORNADO_EM).toBeInstanceOf(Date);
    expect((await pag.listarPagamentos('M', 90)).pagamentos).toHaveLength(0);
  });
});
bloco('cancelar', () => {
  it('pending → 200 canceled; sent_to_terminal → 202 CANCEL_REQUESTED; final → 409', async () => {
    const a = await inserirCobranca({
      ...base,
      COD_VENDA: 20
    });
    const r1 = await cob.cancelar(a);
    expect(r1.httpStatus).toBe(200);
    expect(r1.cobranca.status).toBe('canceled');
    const b = await inserirCobranca({
      ...base,
      COD_VENDA: 21
    });
    await cob.claim(b, 'CAIXA1');
    const r2 = await cob.cancelar(b);
    expect(r2.httpStatus).toBe(202);
    expect(r2.cobranca.status).toBe('sent_to_terminal');
    expect(r2.cobranca.cancelRequested).toBe(true);
    await expect(cob.cancelar(a)).rejects.toMatchObject({
      httpStatus: 409
    });
  });
  it('obter de id inexistente devolve null; claim dá 404', async () => {
    expect(await cob.obter('nao-existe')).toBeNull();
    await expect(cob.claim('nao-existe', 'CAIXA1')).rejects.toMatchObject({
      httpStatus: 404
    });
  });
});
bloco('desfecho que chega atrasado (card encerrado no caixa)', () => {
  /**
   * Cenário real das Fases 4/5: o caixa recebe a entrega/mesa e o Frente marca
   * os cards abertos como `canceled`. Se o entregador estava sem rede e cobrou
   * assim mesmo, o `approved` chega depois — o dinheiro existe na maquineta.
   */
  it('approved sobre cobrança canceled grava o pagamento assim mesmo', async () => {
    const id = await inserirCobranca({
      ORIGEM: 'E',
      COD_VENDA: 4242,
      VALOR: 30,
      MODO: 'D',
      COD_ENTREGADOR: 3,
      DESCRICAO: 'Entrega 4242'
    });
    await (0, _fb.fbQuery)("UPDATE COBRANCAS_TERMINAL SET STATUS = 'canceled' WHERE ID = ?", [id]);
    const dto = await cob.registrarDesfecho(id, {
      terminalId: 'APP-3',
      provider: 'CIELO',
      status: 'approved',
      pagamento: {
        transactionType: 'CREDIT',
        installments: 1,
        amountCents: 3000,
        providerData: {
          paymentCode: 'CREDITO_AVISTA'
        },
        rawResponse: cielo('ORDER-4')
      }
    });
    expect(dto.status).toBe('canceled'); // o histórico do card é preservado
    expect(dto.pagamentoId).toBeGreaterThan(0); // mas o pagamento existe
    expect(dto.motivoErro).toMatch(/encerrada/i);
    const pagos = await pag.listarPagamentos('E', 4242);
    expect(pagos.totalPago).toBe(30);
    expect(pagos.pagamentos[0].transactionType).toBe('CREDIT');
  });
  it('não duplica se o mesmo approved chegar outra vez', async () => {
    const [{
      N: antes
    }] = await (0, _fb.fbQuery)('SELECT COUNT(*) AS N FROM CIELO_PAGAMENTOS WHERE COD_MESA = 4242');
    const id = (await (0, _fb.fbQuery)("SELECT ID FROM COBRANCAS_TERMINAL WHERE COD_VENDA = 4242"))[0].ID.trim();
    await cob.registrarDesfecho(id, {
      terminalId: 'APP-3',
      provider: 'CIELO',
      status: 'approved',
      pagamento: {
        transactionType: 'CREDIT',
        installments: 1,
        amountCents: 3000,
        providerData: {},
        rawResponse: {}
      }
    });
    const [{
      N: depois
    }] = await (0, _fb.fbQuery)('SELECT COUNT(*) AS N FROM CIELO_PAGAMENTOS WHERE COD_MESA = 4242');
    expect(depois).toBe(antes);
  });
  it('approved sobre cobrança expired também grava', async () => {
    const id = await inserirCobranca({
      ...base,
      COD_VENDA: 4343
    });
    await (0, _fb.fbQuery)("UPDATE COBRANCAS_TERMINAL SET EXPIRA_EM = DATEADD(-1 MINUTE TO CURRENT_TIMESTAMP) WHERE ID = ?", [id]);
    await cob.expirarPendentes();
    expect((await cob.obter(id)).status).toBe('expired');
    const dto = await cob.registrarDesfecho(id, {
      terminalId: 'CAIXA1',
      provider: 'CIELO',
      status: 'approved',
      pagamento: {
        transactionType: 'DEBIT',
        installments: 1,
        amountCents: 1000,
        providerData: {},
        rawResponse: {}
      }
    });
    expect(dto.status).toBe('expired');
    expect(dto.pagamentoId).toBeGreaterThan(0);
    expect((await pag.listarPagamentos('B', 4343)).totalPago).toBe(10);
  });
  it('declined atrasado não grava nada', async () => {
    const id = await inserirCobranca({
      ...base,
      COD_VENDA: 4444
    });
    await (0, _fb.fbQuery)("UPDATE COBRANCAS_TERMINAL SET STATUS = 'canceled' WHERE ID = ?", [id]);
    const dto = await cob.registrarDesfecho(id, {
      terminalId: 'CAIXA1',
      provider: 'CIELO',
      status: 'declined',
      motivoErro: 'recusado'
    });
    expect(dto.status).toBe('canceled');
    expect(dto.pagamentoId).toBeNull();
    expect((await pag.listarPagamentos('B', 4444)).pagamentos).toHaveLength(0);
  });
  it('estorno aprovado atrasado marca ESTORNADO_POR do alvo', async () => {
    const {
      id: alvoId
    } = await pag.registrarPagamento({
      provider: 'CIELO',
      origem: 'M',
      codVenda: 4545,
      transactionType: 'CREDIT',
      installments: 1,
      amountCents: 2000,
      totalCents: 2000,
      providerData: {
        paymentCode: 'CREDITO_AVISTA'
      },
      rawResponse: cielo('ORDER-5')
    });
    const id = await inserirCobranca({
      ORIGEM: 'M',
      COD_VENDA: 4545,
      VALOR: 20,
      MODO: 'A',
      TERMINAL_ID: 'CAIXA1',
      OPERACAO: 'C',
      ALVO_PAGAMENTO_ID: alvoId
    });
    await (0, _fb.fbQuery)("UPDATE COBRANCAS_TERMINAL SET STATUS = 'canceled' WHERE ID = ?", [id]);
    await cob.registrarDesfecho(id, {
      terminalId: 'CAIXA1',
      provider: 'CIELO',
      status: 'approved'
    });
    const [p] = await (0, _fb.fbQuery)('SELECT ESTORNADO_POR FROM CIELO_PAGAMENTOS WHERE ID = ?', [alvoId]);
    expect(p.ESTORNADO_POR.trim()).toBe(id);
    expect((await pag.listarPagamentos('M', 4545)).pagamentos).toHaveLength(0);
  });
});
bloco('guarda de entregador no claim', () => {
  /**
   * Segunda barreira do lado do servidor: o app só lista o que é do entregador
   * logado, mas um card reatribuído pelo caixa pode ter ficado no cache offline
   * do aparelho antigo. A guarda só age quando o aparelho manda `codEntregador`.
   */
  let cardEntrega = '';
  let cardMesa = '';
  beforeAll(async () => {
    cardEntrega = await inserirCobranca({
      ORIGEM: 'E',
      COD_VENDA: 7001,
      VALOR: 50,
      MODO: 'D',
      COD_ENTREGADOR: 3,
      DESCRICAO: 'Entrega 7001'
    });
    cardMesa = await inserirCobranca({
      ORIGEM: 'M',
      COD_VENDA: 7002,
      VALOR: 15,
      MODO: 'D',
      DESCRICAO: 'Mesa 7'
    });
  });
  it('entregador diferente é recusado e nada é alterado', async () => {
    await expect(cob.claim(cardEntrega, 'MOTO9', 4)).rejects.toMatchObject({
      httpStatus: 409,
      message: 'Esta cobranca e de outro entregador'
    });
    const dto = await cob.obter(cardEntrega);
    expect(dto.status).toBe('pending');
    expect(dto.terminalId).toBeNull();
  });
  it('entregador certo passa', async () => {
    const dto = await cob.claim(cardEntrega, 'MOTO1', 3);
    expect(dto.status).toBe('sent_to_terminal');
    expect(dto.terminalId).toBe('MOTO1');
  });
  it('a guarda vale também para o card já em cobrança', async () => {
    await expect(cob.claim(cardEntrega, 'MOTO1', 4)).rejects.toMatchObject({
      httpStatus: 409
    });
  });
  it('card de mesa (sem dono) ignora o campo', async () => {
    const dto = await cob.claim(cardMesa, 'SALAO1', 3);
    expect(dto.status).toBe('sent_to_terminal');
  });
  it('sem codEntregador continua o comportamento antigo', async () => {
    const outro = await inserirCobranca({
      ORIGEM: 'E',
      COD_VENDA: 7003,
      VALOR: 20,
      MODO: 'D',
      COD_ENTREGADOR: 3,
      DESCRICAO: 'Entrega 7003'
    });
    const dto = await cob.claim(outro, 'MOTO9'); // aparelho antigo, que não se identifica
    expect(dto.status).toBe('sent_to_terminal');
    expect(dto.terminalId).toBe('MOTO9');
  });
});
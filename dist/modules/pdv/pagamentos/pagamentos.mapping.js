"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TRANSACTION_TYPES = exports.PROVIDERS = exports.ORIGENS = void 0;
exports.isOrigem = isOrigem;
exports.isPixCielo = isPixCielo;
exports.isProvider = isProvider;
exports.isTransactionType = isTransactionType;
exports.legacyCieloBodyToInput = legacyCieloBodyToInput;
exports.mapPagamentoToColumns = mapPagamentoToColumns;
exports.statusCodeDe = statusCodeDe;
exports.transactionTypeFromCieloPaymentCode = transactionTypeFromCieloPaymentCode;
exports.validarItensInput = validarItensInput;
exports.validarPagamentoInput = validarPagamentoInput;
/**
 * Mapeamento provider-agnóstico de "pagamento feito na maquineta" para as
 * colunas de CIELO_PAGAMENTOS (nome mantido; hoje é "pagamentos de maquineta").
 *
 * Funções puras — sem banco — para serem testadas com jest.
 */

const PROVIDERS = exports.PROVIDERS = ['CIELO', 'STONE'];
const ORIGENS = exports.ORIGENS = ['M', 'B', 'E'];
const TRANSACTION_TYPES = exports.TRANSACTION_TYPES = ['CREDIT', 'DEBIT', 'VOUCHER', 'INSTANT_PAYMENT'];
function isProvider(v) {
  return typeof v === 'string' && PROVIDERS.includes(v);
}
function isOrigem(v) {
  return typeof v === 'string' && ORIGENS.includes(v);
}
function isTransactionType(v) {
  return typeof v === 'string' && TRANSACTION_TYPES.includes(v);
}

/** Corpo de `POST /pagamentos` (e do `pagamento` dentro do PATCH de cobrança). */

/** Um item (ou fatia dele) coberto por um pagamento. `codItem` = MESAS_ITENS.CODIGO. */

/** Linha pronta para o INSERT em CIELO_PAGAMENTOS (sem ID/DATA_HORA). */

const cut = (v, max) => {
  if (v == null) return null;
  const s = String(v);
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
};

/**
 * Deriva o tipo normalizado a partir do `paymentCode` cru da Cielo
 * (`CREDITO_AVISTA`, `CREDITO_PARCELADO_LOJA`, `DEBITO_AVISTA`, `PIX`,
 * `VOUCHER_ALIMENTACAO`, `VOUCHER_REFEICAO`…).
 */
function transactionTypeFromCieloPaymentCode(paymentCode) {
  const code = String(paymentCode ?? '').toUpperCase();
  if (!code) return null;
  if (code.startsWith('CREDITO')) return 'CREDIT';
  if (code.startsWith('DEBITO')) return 'DEBIT';
  if (code.startsWith('PIX')) return 'INSTANT_PAYMENT';
  if (code.startsWith('VOUCHER')) return 'VOUCHER';
  return null;
}

/** Pagamento confirmado à mão pelo operador (`providerData.manual` / `rawResponse.manual`). */
function isManual(input) {
  const raw = input.rawResponse ?? {};
  return input.providerData?.manual === true || raw.manual === true;
}

/** `REFERENCIA`: `providerData.reference`, senão o que o provedor ecoou. */
function referenciaDe(input, ...fallbacks) {
  const candidatos = [input.providerData?.reference, ...fallbacks];
  for (const c of candidatos) {
    const v = cut(c, 60);
    if (v) return v;
  }
  return null;
}

/**
 * Pix na Cielo: `paymentCode` começa com PIX ou, quando ele não vem,
 * `paymentFields.primaryProductName` contém PIX (FAQ Cielo Smart). O app também
 * já sabe que pediu Pix (`transactionType`).
 */
function isPixCielo(paymentCode, primaryProductName, transactionType) {
  if (transactionTypeFromCieloPaymentCode(paymentCode) === 'INSTANT_PAYMENT') return true;
  if (String(primaryProductName ?? '').toUpperCase().includes('PIX')) return true;
  return transactionType === 'INSTANT_PAYMENT';
}

/**
 * STATUS_CODE no contrato com o PDV: '0' Pix aprovado, '1' cartão aprovado
 * ('2' = cancelado/negado, que a API não grava — o app só envia aprovados).
 * O statusCode cru do provedor fica em PAYLOAD_JSON.
 */
function statusCodeDe(tt) {
  return tt === 'INSTANT_PAYMENT' ? '0' : '1';
}

/** Cielo: o app manda `providerData.paymentCode` e o `cieloResponse` inteiro em `rawResponse`. */
function mapCielo(input) {
  const raw = input.rawResponse ?? {};
  const payment = raw.payments?.[0] ?? {};
  const fields = payment.paymentFields ?? {};
  const paymentCode = input.providerData?.paymentCode ?? payment.paymentCode ?? fields.paymentCode ?? '';

  // O que a maquineta de fato fez manda no tipo; o pedido do app é o fallback.
  const pix = isPixCielo(paymentCode, fields.primaryProductName, input.transactionType);
  const tt = pix ? 'INSTANT_PAYMENT' : transactionTypeFromCieloPaymentCode(paymentCode) ?? input.transactionType;
  const referencia = referenciaDe(input, raw.reference);
  const installments = Number(input.installments ?? payment.installments ?? 1) || 1;
  const valorPago = input.amountCents != null ? input.amountCents / 100 : Number(payment.amount ?? raw.paidAmount ?? 0) / 100;
  const valorTotal = input.totalCents != null ? input.totalCents / 100 : Number(raw.price ?? 0) / 100;
  return {
    COD_MESA: Number(input.codVenda),
    // Obrigatório para a proteção contra duplicidade (UK_CIELO_PAG_ORDER_EXPR):
    // order id da Cielo; sem ele (pagamento manual), a própria referência.
    CIELO_ORDER_ID: cut(raw.id ?? '', 50) ?? cut(referencia, 50),
    MEIO_PAGAMENTO: cut(paymentCode || (pix ? 'PIX' : tt), 40),
    BANDEIRA: cut(payment.brand ?? '', 30),
    VALOR_TOTAL: round2(valorTotal),
    VALOR_PAGO: round2(valorPago),
    PARCELAS: installments,
    // Pix: E2E ID de 32 chars — nunca truncar (coluna VARCHAR(40) após o Script23).
    AUTH_CODE: cut(payment.authCode ?? '', 40),
    CIELO_CODE: cut(payment.cieloCode ?? '', 40),
    NSU: cut(fields.paymentTransactionId ?? payment.externalId ?? '', 50),
    TERMINAL: cut(payment.terminal ?? '', 40),
    COD_EC: cut(payment.merchantCode ?? '', 30),
    MASK_CARTAO: cut(payment.mask ?? fields.pan ?? '', 25),
    PRODUTO_PRIMARIO: cut(fields.primaryProductName ?? '', 30),
    PROD_SECUNDARIO: cut(fields.secondaryProductName ?? '', 30),
    STATUS_CODE: statusCodeDe(tt),
    PAYLOAD_JSON: JSON.stringify(input.rawResponse ?? {}),
    PROVIDER: 'CIELO',
    ORIGEM: input.origem,
    TRANSACTION_TYPE: tt,
    ATK: null,
    COBRANCA_ID: input.cobrancaId ?? null,
    REFERENCIA: referencia,
    MANUAL: isManual(input) ? 'S' : 'N'
  };
}

/**
 * Stone (Deeplink): o app normaliza o retorno em `providerData`:
 * { atk, itk, authorizationCode, brand, panMasked, entryMode, installmentCount,
 *   transactionType, orderId }. `rawResponse` = query string/objeto cru do retorno.
 * Convenções: CIELO_CODE recebe o ITK (reuso do campo); NSU = authorizationCode.
 */
function mapStone(input) {
  const pd = input.providerData ?? {};
  const raw = input.rawResponse ?? {};
  const tt = input.transactionType ?? pd.transactionType;
  const installments = Number(input.installments ?? pd.installmentCount ?? 1) || 1;
  const authCode = pd.authorizationCode ?? raw.authorization_code ?? '';
  const atk = cut(pd.atk ?? raw.atk ?? '', 60);
  const referencia = referenciaDe(input, raw.order_id, pd.orderId);
  return {
    COD_MESA: Number(input.codVenda),
    // Stone não tem "order id" próprio: usa o order_id ecoado (= reference do
    // app), senão o ATK, senão a referência — nunca nulo quando há algo.
    CIELO_ORDER_ID: cut(pd.orderId ?? raw.order_id ?? pd.transactionId ?? '', 50) ?? cut(atk, 50) ?? cut(referencia, 50),
    MEIO_PAGAMENTO: cut(pd.transactionType ?? tt, 40),
    BANDEIRA: cut(pd.brand ?? raw.brand ?? '', 30),
    VALOR_TOTAL: round2((input.totalCents ?? input.amountCents) / 100),
    VALOR_PAGO: round2(input.amountCents / 100),
    PARCELAS: installments,
    AUTH_CODE: cut(authCode, 40),
    CIELO_CODE: cut(pd.itk ?? raw.itk ?? '', 40),
    NSU: cut(authCode, 50),
    TERMINAL: cut(input.terminalId ?? pd.terminalId ?? '', 40),
    COD_EC: null,
    MASK_CARTAO: cut(pd.panMasked ?? raw.pan ?? '', 25),
    PRODUTO_PRIMARIO: cut(pd.entryMode ?? raw.entry_mode ?? '', 30),
    PROD_SECUNDARIO: null,
    STATUS_CODE: statusCodeDe(tt),
    PAYLOAD_JSON: JSON.stringify(input.rawResponse ?? pd ?? {}),
    PROVIDER: 'STONE',
    ORIGEM: input.origem,
    TRANSACTION_TYPE: tt,
    ATK: atk,
    COBRANCA_ID: input.cobrancaId ?? null,
    REFERENCIA: referencia,
    MANUAL: isManual(input) ? 'S' : 'N'
  };
}
function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Ponto único de entrada: escolhe o mapeador pelo provider. */
function mapPagamentoToColumns(input) {
  switch (input.provider) {
    case 'CIELO':
      return mapCielo(input);
    case 'STONE':
      return mapStone(input);
    default:
      throw new Error(`Provider não suportado: ${String(input.provider)}`);
  }
}

/**
 * Valida o corpo de POST /pagamentos. Devolve mensagem de erro (pt-BR) ou null.
 * Preenche defaults (installments=1, totalCents=amountCents).
 */
function validarPagamentoInput(body) {
  if (!body || typeof body !== 'object') return {
    error: 'Corpo da requisição ausente.'
  };
  if (!isProvider(body.provider)) return {
    error: 'provider é obrigatório: CIELO | STONE.'
  };
  if (!isOrigem(body.origem)) return {
    error: 'origem é obrigatória: M | B | E.'
  };
  const codVenda = Number(body.codVenda);
  if (!Number.isInteger(codVenda) || codVenda <= 0) return {
    error: 'codVenda é obrigatório (inteiro > 0).'
  };
  if (!isTransactionType(body.transactionType)) {
    return {
      error: 'transactionType é obrigatório: CREDIT | DEBIT | VOUCHER | INSTANT_PAYMENT.'
    };
  }
  const amountCents = Number(body.amountCents);
  if (!Number.isInteger(amountCents) || amountCents <= 0) return {
    error: 'amountCents é obrigatório (inteiro em centavos > 0).'
  };
  const installments = body.installments == null ? 1 : Number(body.installments);
  if (!Number.isInteger(installments) || installments < 1) return {
    error: 'installments deve ser inteiro >= 1.'
  };
  const totalCents = body.totalCents == null ? amountCents : Number(body.totalCents);
  if (!Number.isInteger(totalCents) || totalCents < 0) return {
    error: 'totalCents deve ser inteiro em centavos.'
  };
  const itensResult = validarItensInput(body.itens);
  if (itensResult.error) return {
    error: itensResult.error
  };
  return {
    input: {
      provider: body.provider,
      origem: body.origem,
      codVenda,
      cobrancaId: body.cobrancaId ? String(body.cobrancaId).slice(0, 36) : null,
      transactionType: body.transactionType,
      installments,
      amountCents,
      totalCents,
      providerData: body.providerData && typeof body.providerData === 'object' ? body.providerData : null,
      rawResponse: body.rawResponse ?? null,
      terminalId: body.terminalId ? String(body.terminalId) : null,
      itens: itensResult.itens
    }
  };
}

/**
 * Valida `itens` de POST /pagamentos. Ausente/vazio → `itens: null` (sem erro).
 * Cada item: codItem inteiro > 0, qtde > 0, valor >= 0 (R$).
 */
function validarItensInput(raw) {
  if (raw == null) return {
    itens: null
  };
  if (!Array.isArray(raw)) return {
    itens: null,
    error: 'itens deve ser uma lista.'
  };
  if (raw.length === 0) return {
    itens: null
  };
  const itens = [];
  for (let i = 0; i < raw.length; i++) {
    const it = raw[i];
    if (!it || typeof it !== 'object') return {
      itens: null,
      error: `itens[${i}] inválido.`
    };
    const codItem = Number(it.codItem);
    const codConjuga = it.codConjuga == null ? 0 : Number(it.codConjuga);
    const qtde = Number(it.qtde);
    const valor = Number(it.valor);
    if (!Number.isInteger(codItem) || codItem <= 0) return {
      itens: null,
      error: `itens[${i}].codItem é obrigatório (inteiro > 0).`
    };
    if (!Number.isInteger(codConjuga) || codConjuga < 0) return {
      itens: null,
      error: `itens[${i}].codConjuga deve ser inteiro >= 0.`
    };
    if (!Number.isFinite(qtde) || qtde <= 0) return {
      itens: null,
      error: `itens[${i}].qtde deve ser > 0.`
    };
    if (!Number.isFinite(valor) || valor < 0) return {
      itens: null,
      error: `itens[${i}].valor deve ser >= 0.`
    };
    itens.push({
      codItem,
      codConjuga,
      qtde: Math.round(qtde * 1000) / 1000,
      valor: Math.round(valor * 100) / 100
    });
  }
  return {
    itens
  };
}

/**
 * Converte o corpo legado de `POST /cielo/pagamento`
 * `{ codMesa, paymentCode, cieloResponse }` para o corpo novo.
 */
function legacyCieloBodyToInput(body) {
  const {
    codMesa,
    paymentCode,
    cieloResponse
  } = body ?? {};
  if (!codMesa || !paymentCode || !cieloResponse) {
    return {
      error: 'codMesa, paymentCode e cieloResponse são obrigatórios.'
    };
  }
  const payment = cieloResponse.payments?.[0] ?? {};
  const transactionType = transactionTypeFromCieloPaymentCode(paymentCode) ?? (isPixCielo(paymentCode, payment.paymentFields?.primaryProductName) ? 'INSTANT_PAYMENT' : 'CREDIT');
  const amountCents = Math.round(Number(payment.amount ?? cieloResponse.paidAmount ?? 0));
  const totalCents = Math.round(Number(cieloResponse.price ?? amountCents));
  return {
    input: {
      provider: 'CIELO',
      origem: 'M',
      codVenda: Number(codMesa),
      cobrancaId: null,
      transactionType,
      installments: Number(payment.installments ?? 1) || 1,
      amountCents,
      totalCents,
      providerData: {
        paymentCode
      },
      rawResponse: cieloResponse,
      terminalId: null
    }
  };
}
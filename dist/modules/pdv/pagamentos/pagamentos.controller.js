"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.estornoManual = estornoManual;
exports.listar = listar;
exports.listarLegadoMesa = listarLegadoMesa;
exports.registrar = registrar;
exports.registrarLegadoCielo = registrarLegadoCielo;
var _pagamentos = require("./pagamentos.mapping");
var _pagamentos2 = _interopRequireWildcard(require("./pagamentos.service"));
var service = _pagamentos2;
var _pagamentosLog = require("../../../shared/utils/pagamentosLog");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
/** Campos do pagamento que vão para o log (sem o rawResponse inteiro). */
function resumoInput(input) {
  const raw = input.rawResponse ?? {};
  return {
    provider: input.provider,
    origem: input.origem,
    codVenda: input.codVenda,
    cobrancaId: input.cobrancaId ?? null,
    transactionType: input.transactionType,
    amountCents: input.amountCents,
    orderId: raw.id ?? input.providerData?.orderId ?? raw.order_id ?? null,
    reference: input.providerData?.reference ?? null,
    manual: input.providerData?.manual === true || raw.manual === true,
    itens: input.itens?.length ?? 0
  };
}

/**
 * POST /pagamentos
 * Body: { provider, origem, codVenda, cobrancaId?, transactionType, installments,
 *         amountCents, totalCents, providerData, rawResponse, itens? }
 * 201 { id, codVenda, duplicado:false } | 200 { id, codVenda, duplicado:true } | 422 { error }
 */
async function registrar(req, res) {
  const {
    input,
    error
  } = (0, _pagamentos.validarPagamentoInput)(req.body);
  if (error || !input) {
    (0, _pagamentosLog.logPagamento)('rejeitado', {
      rota: 'POST /pagamentos',
      status: 422,
      error,
      body: req.body
    });
    res.status(422).send({
      error
    });
    return;
  }
  try {
    const r = await service.registrarPagamento(input);
    (0, _pagamentosLog.logPagamento)(r.duplicado ? 'duplicado' : 'ok', {
      rota: 'POST /pagamentos',
      id: r.id,
      ...resumoInput(input)
    });
    res.status(r.duplicado ? 200 : 201).send({
      id: r.id,
      codVenda: input.codVenda,
      duplicado: r.duplicado
    });
  } catch (err) {
    console.error('[pagamentos] Erro ao registrar pagamento:', err);
    (0, _pagamentosLog.logPagamento)('erro', {
      rota: 'POST /pagamentos',
      status: 500,
      ...(0, _pagamentosLog.resumoErro)(err),
      body: req.body
    });
    res.status(500).send({
      error: 'Erro ao salvar pagamento no banco de dados.',
      detalhe: (0, _pagamentosLog.resumoErro)(err).mensagem
    });
  }
}

/**
 * POST /cielo/pagamento (legado — alias)
 * Body antigo: { codMesa, paymentCode, cieloResponse }
 * Grava com PROVIDER='CIELO', ORIGEM='M', TRANSACTION_TYPE derivado.
 */
async function registrarLegadoCielo(req, res) {
  const {
    input,
    error
  } = (0, _pagamentos.legacyCieloBodyToInput)(req.body);
  if (error || !input) {
    (0, _pagamentosLog.logPagamento)('rejeitado', {
      rota: 'POST /cielo/pagamento',
      status: 400,
      error,
      body: req.body
    });
    res.status(400).send({
      error
    });
    return;
  }
  try {
    const r = await service.registrarPagamento(input);
    (0, _pagamentosLog.logPagamento)(r.duplicado ? 'duplicado' : 'ok', {
      rota: 'POST /cielo/pagamento',
      id: r.id,
      ...resumoInput(input)
    });
    res.status(r.duplicado ? 200 : 201).send({
      id: r.id,
      codMesa: input.codVenda,
      duplicado: r.duplicado
    });
  } catch (err) {
    console.error('[cielo] Erro ao registrar pagamento:', err);
    (0, _pagamentosLog.logPagamento)('erro', {
      rota: 'POST /cielo/pagamento',
      status: 500,
      ...(0, _pagamentosLog.resumoErro)(err),
      body: req.body
    });
    res.status(500).send({
      error: 'Erro ao salvar pagamento no banco de dados.',
      detalhe: (0, _pagamentosLog.resumoErro)(err).mensagem
    });
  }
}

/** GET /pagamentos/:origem/:codVenda */
async function listar(req, res) {
  const origem = String(req.params.origem ?? '').toUpperCase();
  const codVenda = Number(req.params.codVenda);
  if (!(0, _pagamentos.isOrigem)(origem)) {
    res.status(400).send({
      error: 'origem inválida: M | B | E.'
    });
    return;
  }
  if (!codVenda) {
    res.status(400).send({
      error: 'codVenda inválido.'
    });
    return;
  }
  try {
    res.status(200).send(await service.listarPagamentos(origem, codVenda));
  } catch (err) {
    console.error('[pagamentos] Erro ao listar pagamentos:', err);
    res.status(500).send({
      error: 'Erro ao consultar pagamentos no banco de dados.'
    });
  }
}

/** GET /cielo/pagamentos/:codMesa (legado — alias de origem 'M'; resposta mantém `codMesa`). */
async function listarLegadoMesa(req, res) {
  const codMesa = Number(req.params.codMesa);
  if (!codMesa) {
    res.status(400).send({
      error: 'codMesa inválido.'
    });
    return;
  }
  try {
    const r = await service.listarPagamentos('M', codMesa);
    res.status(200).send({
      codMesa,
      codVenda: codMesa,
      totalPago: r.totalPago,
      pagamentos: r.pagamentos
    });
  } catch (err) {
    console.error('[cielo] Erro ao listar pagamentos da mesa:', err);
    res.status(500).send({
      error: 'Erro ao consultar pagamentos no banco de dados.'
    });
  }
}

/**
 * PATCH /pagamentos/:id/estorno-manual { motivo, usuario? }
 * 200 { id, estornadoPor:'MANUAL', estornadoEm } | 400 id | 422 motivo | 404 | 409 já estornado
 */
async function estornoManual(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).send({
      error: 'id inválido.'
    });
    return;
  }
  const motivo = String(req.body?.motivo ?? '').trim().slice(0, 200);
  if (!motivo) {
    res.status(422).send({
      error: 'motivo é obrigatório.'
    });
    return;
  }
  const usuarioRaw = req.body?.usuario;
  const usuario = usuarioRaw == null || String(usuarioRaw).trim() === '' ? null : String(usuarioRaw).trim().slice(0, 60);
  try {
    const r = await service.estornarManual(id, {
      usuario,
      motivo
    });
    (0, _pagamentosLog.logPagamento)('estorno_manual', {
      id,
      usuario,
      motivo
    });
    res.status(200).send(r);
  } catch (err) {
    if (err instanceof _pagamentos2.PagamentoError) {
      res.status(err.httpStatus).send({
        error: err.message,
        ...err.extra
      });
      return;
    }
    console.error('[pagamentos] Erro no estorno manual:', err);
    (0, _pagamentosLog.logPagamento)('erro', {
      rota: 'PATCH /pagamentos/:id/estorno-manual',
      id,
      ...(0, _pagamentosLog.resumoErro)(err)
    });
    res.status(500).send({
      error: 'Erro ao estornar pagamento no banco de dados.'
    });
  }
}
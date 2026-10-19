"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.cancelar = cancelar;
exports.cards = cards;
exports.claim = claim;
exports.desfecho = desfecho;
exports.logarCardsRecebidos = logarCardsRecebidos;
exports.obter = obter;
exports.pendentes = pendentes;
var _cobrancas = _interopRequireWildcard(require("./cobrancas.service"));
var service = _cobrancas;
var _pagamentos = require("../pagamentos/pagamentos.mapping");
var _pagamentosLog = require("../../../shared/utils/pagamentosLog");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function handleError(res, tag, err) {
  if (err instanceof _cobrancas.CobrancaError) {
    res.status(err.httpStatus).send({
      error: err.message,
      ...err.extra
    });
    return;
  }
  console.error(`[cobrancas] ${tag}:`, err);
  res.status(500).send({
    error: 'Erro ao acessar o banco de dados.'
  });
}
const idParam = req => String(req.params.id ?? '').trim().slice(0, 36);

/**
 * Cards que cada entregador já recebeu. O ERP grava a cobrança direto no banco,
 * então a primeira vez que a API a enxerga é quando o app do entregador a busca.
 * O app consulta em loop: só loga o card que aparece pela primeira vez.
 * Em memória — depois de reiniciar a API, os cards abertos são logados de novo.
 */
const cardsVistos = new Map();
function logarCardsRecebidos(entregador, lista) {
  const vistos = cardsVistos.get(entregador) ?? new Set();
  for (const c of lista) {
    if (vistos.has(c.id)) continue;
    console.log(`[cobrancas] ${new Date().toISOString()} card-recebido: entregador=${entregador} id=${c.id} ` + `origem=${c.origem} codVenda=${c.codVenda} valorCents=${c.valorCents} status=${c.status}`);
  }
  // Guarda só os abertos: o conjunto não cresce e um card encerrado sai dele.
  cardsVistos.set(entregador, new Set(lista.map(c => c.id)));
}

/** GET /cobrancas/pendentes?terminalId=X */
async function pendentes(req, res) {
  const terminalId = String(req.query.terminalId ?? '').trim();
  if (!terminalId) {
    res.status(400).send({
      error: 'terminalId é obrigatório.'
    });
    return;
  }
  try {
    res.status(200).send(await service.listarPendentes(terminalId));
  } catch (err) {
    handleError(res, 'pendentes', err);
  }
}

/** GET /cobrancas/cards?entregador=N | ?mesas=1 */
async function cards(req, res) {
  const entregadorRaw = req.query.entregador;
  const mesas = ['1', 'true', 'S'].includes(String(req.query.mesas ?? ''));
  const entregador = entregadorRaw != null && String(entregadorRaw) !== '' ? Number(entregadorRaw) : undefined;
  if (entregador !== undefined && !Number.isInteger(entregador)) {
    res.status(400).send({
      error: 'entregador inválido.'
    });
    return;
  }
  if (entregador === undefined && !mesas) {
    res.status(400).send({
      error: 'Informe entregador=N ou mesas=1.'
    });
    return;
  }
  try {
    const lista = await service.listarCards({
      entregador,
      mesas
    });
    if (entregador !== undefined) logarCardsRecebidos(entregador, lista);
    res.status(200).send(lista);
  } catch (err) {
    handleError(res, 'cards', err);
  }
}

/** GET /cobrancas/:id */
async function obter(req, res) {
  try {
    const dto = await service.obter(idParam(req));
    if (!dto) {
      res.status(404).send({
        error: 'Cobranca nao encontrada'
      });
      return;
    }
    res.status(200).send(dto);
  } catch (err) {
    handleError(res, 'obter', err);
  }
}

/** POST /cobrancas/:id/claim { terminalId, codEntregador? } */
async function claim(req, res) {
  const terminalId = String(req.body?.terminalId ?? '').trim();
  if (!terminalId) {
    res.status(400).send({
      error: 'terminalId é obrigatório.'
    });
    return;
  }

  // Opcional: quando vem, a API confere que o card é mesmo deste entregador.
  // Ausente = comportamento antigo (app instalado continua funcionando).
  const bruto = req.body?.codEntregador;
  let codEntregador = null;
  if (bruto != null && String(bruto).trim() !== '') {
    const n = Number(bruto);
    if (!Number.isInteger(n) || n <= 0) {
      res.status(422).send({
        error: 'codEntregador deve ser inteiro > 0.'
      });
      return;
    }
    codEntregador = n;
  }
  try {
    res.status(200).send(await service.claim(idParam(req), terminalId, codEntregador));
  } catch (err) {
    handleError(res, 'claim', err);
  }
}

/** PATCH /cobrancas/:id { terminalId, provider, status, motivoErro?, pagamento? } */
async function desfecho(req, res) {
  const body = req.body ?? {};
  const terminalId = String(body.terminalId ?? '').trim();
  if (!terminalId) {
    res.status(400).send({
      error: 'terminalId é obrigatório.'
    });
    return;
  }
  if (!(0, _pagamentos.isProvider)(body.provider)) {
    res.status(422).send({
      error: 'provider é obrigatório: CIELO | STONE.'
    });
    return;
  }
  const status = String(body.status ?? '');
  if (!['approved', 'declined', 'canceled', 'error'].includes(status)) {
    res.status(422).send({
      error: 'status deve ser approved | declined | canceled | error.'
    });
    return;
  }
  let pagamento = null;
  if (body.pagamento) {
    const p = body.pagamento;
    if (!(0, _pagamentos.isTransactionType)(p.transactionType)) {
      res.status(422).send({
        error: 'pagamento.transactionType inválido.'
      });
      return;
    }
    const amountCents = Number(p.amountCents);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      res.status(422).send({
        error: 'pagamento.amountCents deve ser inteiro em centavos > 0.'
      });
      return;
    }
    pagamento = {
      transactionType: p.transactionType,
      installments: Number(p.installments ?? 1) || 1,
      amountCents,
      providerData: p.providerData && typeof p.providerData === 'object' ? p.providerData : null,
      rawResponse: p.rawResponse ?? null
    };
  }
  const id = idParam(req);
  try {
    const dto = await service.registrarDesfecho(id, {
      terminalId,
      provider: body.provider,
      status: status,
      motivoErro: body.motivoErro ?? null,
      pagamento
    });
    (0, _pagamentosLog.logPagamento)('desfecho_ok', {
      cobrancaId: id,
      terminalId,
      provider: body.provider,
      status,
      resultado: dto.status,
      pagamentoId: dto.pagamentoId,
      amountCents: pagamento?.amountCents ?? null,
      reference: pagamento?.providerData?.reference ?? null
    });
    res.status(200).send(dto);
  } catch (err) {
    const httpStatus = err instanceof _cobrancas.CobrancaError ? err.httpStatus : 500;
    (0, _pagamentosLog.logPagamento)('desfecho_erro', {
      cobrancaId: id,
      terminalId,
      provider: body.provider,
      status,
      httpStatus,
      ...(0, _pagamentosLog.resumoErro)(err),
      body
    });
    handleError(res, 'desfecho', err);
  }
}

/** POST /cobrancas/:id/cancelar */
async function cancelar(req, res) {
  try {
    const {
      httpStatus,
      cobranca
    } = await service.cancelar(idParam(req));
    res.status(httpStatus).send(cobranca);
  } catch (err) {
    handleError(res, 'cancelar', err);
  }
}
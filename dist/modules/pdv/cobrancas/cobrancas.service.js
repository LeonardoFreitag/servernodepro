"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CobrancaError = void 0;
exports.cancelar = cancelar;
exports.claim = claim;
exports.expirarPendentes = expirarPendentes;
exports.listarCards = listarCards;
exports.listarPendentes = listarPendentes;
exports.obter = obter;
exports.registrarDesfecho = registrarDesfecho;
var _fb = require("../../../shared/database/fb");
var _cobrancas = require("./cobrancas.dto");
var _pagamentos = require("../pagamentos/pagamentos.service");
/** Erro de negócio com status HTTP. */
class CobrancaError extends Error {
  constructor(httpStatus, message, extra = {}) {
    super(message);
    this.httpStatus = httpStatus;
    this.extra = extra;
  }
}

/**
 * Marca `expired` os `pending` vencidos (nunca `sent_to_terminal`).
 * Tolerante a erro: só loga (chamado antes das listagens e pelo job de 30 s).
 */
exports.CobrancaError = CobrancaError;
async function expirarPendentes() {
  try {
    const r = await (0, _fb.fbQuery)('EXECUTE PROCEDURE P_COBRANCAS_EXPIRAR');
    return Number(r?.QTDE ?? 0);
  } catch (err) {
    console.error('[cobrancas] Erro ao expirar cobranças pendentes:', err?.message ?? err);
    return 0;
  }
}
async function obter(id, ex) {
  const run = e => e.query(`${_cobrancas.SELECT_COBRANCA} WHERE C.ID = ?`, [id]);
  const rows = ex ? await run(ex) : await (0, _fb.withDb)(run);
  return rows?.[0] ? (0, _cobrancas.rowToDTO)(rows[0]) : null;
}

/** Modo attended: no máximo 1 cobrança `pending` para o terminal, mais antiga primeiro. */
async function listarPendentes(terminalId) {
  await expirarPendentes();
  const rows = await (0, _fb.fbQuery)(`${_cobrancas.SELECT_COBRANCA.replace(/^\s*SELECT /, 'SELECT FIRST 1 ')}
      WHERE C.MODO = 'A' AND C.TERMINAL_ID = ? AND C.STATUS = 'pending'
        AND COALESCE(C.CANAL, 'L') = 'L'
      ORDER BY C.CRIADO_EM, C.ID`, [terminalId]);
  return rows.map(_cobrancas.rowToDTO);
}

/** Cards (detached): `pending` e `sent_to_terminal`. */
async function listarCards(filtro) {
  await expirarPendentes();
  // CANAL 'A' é do canal automax-api (o Frente mesmo executa); a API só vê 'L'.
  const where = [`C.MODO = 'D'`, `C.STATUS IN ('pending', 'sent_to_terminal')`, `COALESCE(C.CANAL, 'L') = 'L'`];
  const params = [];
  if (filtro.entregador != null) {
    where.push('C.COD_ENTREGADOR = ?');
    params.push(filtro.entregador);
  }
  if (filtro.mesas) {
    where.push(`C.ORIGEM = 'M'`);
  }
  const rows = await (0, _fb.fbQuery)(`${_cobrancas.SELECT_COBRANCA} WHERE ${where.join(' AND ')} ORDER BY C.CRIADO_EM, C.ID`, params);
  return rows.map(_cobrancas.rowToDTO);
}

/** Lê a linha bruta com lock pessimista (dentro de uma transação). */
async function lerComLock(tr, id) {
  const rows = await tr.query(`SELECT ID, STATUS, MODO, OPERACAO, TERMINAL_ID, ORIGEM, COD_VENDA, ALVO_PAGAMENTO_ID,
            CANCEL_REQUESTED, COD_ENTREGADOR
       FROM COBRANCAS_TERMINAL WHERE ID = ? WITH LOCK`, [id]);
  return rows?.[0] ?? null;
}
const s = v => v == null ? null : String(v).trim();

/**
 * POST /cobrancas/:id/claim — app marca que vai cobrar.
 * `pending` → `sent_to_terminal` (TERMINAL_ID = COALESCE(TERMINAL_ID, :terminalId)).
 * Já `sent_to_terminal` pelo MESMO terminal → idempotente (200).
 * Qualquer outro caso → 409 com o status atual.
 *
 * `codEntregador` é opcional e funciona como segunda barreira: quando o aparelho
 * se identifica e o card tem dono, um entregador não consegue cobrar o card de
 * outro — caso real de um card reatribuído pelo caixa que ficou no cache offline
 * do aparelho antigo. Sem o campo, o comportamento é exatamente o de antes, para
 * não quebrar o app já instalado.
 */
async function claim(id, terminalId, codEntregador) {
  await (0, _fb.withTransaction)(async tr => {
    const row = await lerComLock(tr, id);
    if (!row) throw new CobrancaError(404, 'Cobranca nao encontrada');
    const status = s(row.STATUS);

    // Dentro da mesma transação e do mesmo WITH LOCK do claim — fora daqui não valeria sob concorrência.
    const donoDoCard = row.COD_ENTREGADOR == null ? null : Number(row.COD_ENTREGADOR);
    if (codEntregador != null && donoDoCard != null && donoDoCard !== codEntregador) {
      throw new CobrancaError(409, 'Esta cobranca e de outro entregador', {
        status
      });
    }
    if (status === 'pending') {
      await tr.query(`UPDATE COBRANCAS_TERMINAL
            SET STATUS = 'sent_to_terminal',
                TERMINAL_ID = COALESCE(TERMINAL_ID, ?),
                ATUALIZADO_EM = CURRENT_TIMESTAMP
          WHERE ID = ? AND STATUS = 'pending'`, [terminalId, id]);
      return;
    }
    if (status === 'sent_to_terminal' && s(row.TERMINAL_ID) === terminalId) {
      return; // app reiniciou — idempotente
    }
    throw new CobrancaError(409, 'Cobranca ja esta sendo atendida ou foi encerrada', {
      status
    });
  });
  return await obter(id);
}
/** Insere em CIELO_PAGAMENTOS o pagamento de um desfecho `approved` (OPERACAO='P'). */
async function inserirPagamentoDoDesfecho(ex, id, row, input) {
  const p = input.pagamento;
  const gravado = await (0, _pagamentos.inserirPagamento)(ex, {
    provider: input.provider,
    origem: s(row.ORIGEM),
    codVenda: Number(row.COD_VENDA),
    cobrancaId: id,
    transactionType: p.transactionType,
    installments: p.installments ?? 1,
    amountCents: p.amountCents,
    totalCents: p.amountCents,
    providerData: p.providerData ?? null,
    rawResponse: p.rawResponse ?? null,
    terminalId: input.terminalId
  });
  return gravado.id;
}

/**
 * Desfecho que chega depois de a cobrança já estar num status final.
 *
 * O caso comum é a fila offline do app reenviando um desfecho já gravado, e aí
 * não se faz nada. Mas um `approved` sobre uma cobrança `canceled` ou `expired`
 * é outra coisa: o aparelho cobrou de fato (estava sem rede) antes de saber que
 * o caixa havia encerrado o card — o dinheiro existe na maquineta e não pode
 * sumir do sistema. Nesse caso o pagamento é gravado assim mesmo, o status
 * final é preservado como registro do que aconteceu e o MOTIVO_ERRO explica,
 * para o caixa enxergar o pagamento a mais no recebimento e decidir o que fazer.
 *
 * A atualização da própria cobrança é best-effort: se o trigger BU0 recusar
 * mexer numa linha encerrada, o pagamento já está gravado, que é o que importa.
 */
async function resgatarDesfechoTardio(tr, id, row, input, operacao, status) {
  if (input.status !== 'approved') return;
  const aviso = `Confirmado pela maquineta depois de a cobranca ser encerrada (${status}); lancado assim mesmo`.slice(0, 200);

  /** Anota na cobrança encerrada o que chegou atrasado. Best-effort: o que importa já foi gravado. */
  async function anotarNaCobranca(pagamentoId) {
    try {
      await tr.query(pagamentoId == null ? 'UPDATE COBRANCAS_TERMINAL SET PROVIDER = ?, MOTIVO_ERRO = ? WHERE ID = ?' : 'UPDATE COBRANCAS_TERMINAL SET PROVIDER = ?, MOTIVO_ERRO = ?, PAGAMENTO_ID = ? WHERE ID = ?', pagamentoId == null ? [input.provider, aviso, id] : [input.provider, aviso, pagamentoId, id]);
    } catch (err) {
      console.error('[cobrancas] Nao foi possivel anotar o desfecho tardio na cobranca:', err?.message ?? err);
    }
  }
  if (operacao === 'P') {
    if (!input.pagamento) return;
    const ja = await tr.query('SELECT COUNT(*) AS N FROM CIELO_PAGAMENTOS WHERE COBRANCA_ID = ?', [id]);
    if (Number(ja?.[0]?.N ?? 0) > 0) return; // repetição normal da fila offline
    await anotarNaCobranca(await inserirPagamentoDoDesfecho(tr, id, row, input));
    return;
  }

  // Estorno aprovado fora de hora: marca o alvo se ninguém marcou ainda.
  const alvoId = row.ALVO_PAGAMENTO_ID;
  if (alvoId == null) return;
  const alvo = await tr.query('SELECT ESTORNADO_POR FROM CIELO_PAGAMENTOS WHERE ID = ?', [Number(alvoId)]);
  if (!alvo?.[0] || s(alvo[0].ESTORNADO_POR)) return;
  await tr.query('UPDATE CIELO_PAGAMENTOS SET ESTORNADO_POR = ?, ESTORNADO_EM = CURRENT_TIMESTAMP WHERE ID = ?', [id, Number(alvoId)]);
  await anotarNaCobranca(null);
}

/**
 * PATCH /cobrancas/:id — desfecho idempotente, numa única transação.
 * Se o status já é final, devolve o DTO atual sem alterar nada (repetição da
 * fila offline do app nunca é erro).
 */
async function registrarDesfecho(id, input) {
  await (0, _fb.withTransaction)(async tr => {
    const row = await lerComLock(tr, id);
    if (!row) throw new CobrancaError(404, 'Cobranca nao encontrada');
    const status = s(row.STATUS);
    const operacaoRow = s(row.OPERACAO) ?? 'P';
    if ((0, _cobrancas.isStatusFinal)(status)) {
      // Não é simplesmente "ignorar": um approved atrasado ainda precisa virar pagamento.
      await resgatarDesfechoTardio(tr, id, row, input, operacaoRow, status);
      return;
    }
    const modo = s(row.MODO);
    const terminalAtual = s(row.TERMINAL_ID);
    if (modo === 'A' && terminalAtual && terminalAtual !== input.terminalId) {
      throw new CobrancaError(409, 'Cobranca pertence a outro terminal', {
        status,
        terminalId: terminalAtual
      });
    }
    const operacao = operacaoRow;
    const motivo = input.motivoErro ? String(input.motivoErro).slice(0, 200) : null;
    if (input.status === 'approved' && operacao === 'P') {
      if (!input.pagamento) throw new CobrancaError(422, 'pagamento e obrigatorio quando status=approved');
      const pagamentoId = await inserirPagamentoDoDesfecho(tr, id, row, input);
      await tr.query(`UPDATE COBRANCAS_TERMINAL
            SET STATUS = 'approved', PROVIDER = ?, PAGAMENTO_ID = ?, MOTIVO_ERRO = NULL,
                TERMINAL_ID = COALESCE(TERMINAL_ID, ?), ATUALIZADO_EM = CURRENT_TIMESTAMP
          WHERE ID = ?`, [input.provider, pagamentoId, input.terminalId, id]);
      return;
    }
    if (input.status === 'approved' && operacao === 'C') {
      const alvoId = row.ALVO_PAGAMENTO_ID;
      if (alvoId == null) throw new CobrancaError(422, 'Cobranca de estorno sem ALVO_PAGAMENTO_ID');
      await tr.query(`UPDATE CIELO_PAGAMENTOS SET ESTORNADO_POR = ?, ESTORNADO_EM = CURRENT_TIMESTAMP WHERE ID = ?`, [id, Number(alvoId)]);
      await tr.query(`UPDATE COBRANCAS_TERMINAL
            SET STATUS = 'approved', PROVIDER = ?, MOTIVO_ERRO = NULL,
                TERMINAL_ID = COALESCE(TERMINAL_ID, ?), ATUALIZADO_EM = CURRENT_TIMESTAMP
          WHERE ID = ?`, [input.provider, input.terminalId, id]);
      return;
    }

    // declined | canceled | error
    await tr.query(`UPDATE COBRANCAS_TERMINAL
          SET STATUS = ?, PROVIDER = ?, MOTIVO_ERRO = ?,
              TERMINAL_ID = COALESCE(TERMINAL_ID, ?), ATUALIZADO_EM = CURRENT_TIMESTAMP
        WHERE ID = ?`, [input.status, input.provider, motivo, input.terminalId, id]);
  });
  return await obter(id);
}

/**
 * POST /cobrancas/:id/cancelar
 * `pending` → `canceled` (200); `sent_to_terminal` → CANCEL_REQUESTED='S' (202); final → 409.
 */
async function cancelar(id) {
  const httpStatus = await (0, _fb.withTransaction)(async tr => {
    const row = await lerComLock(tr, id);
    if (!row) throw new CobrancaError(404, 'Cobranca nao encontrada');
    const status = s(row.STATUS);
    if (status === 'pending') {
      await tr.query(`UPDATE COBRANCAS_TERMINAL SET STATUS = 'canceled', ATUALIZADO_EM = CURRENT_TIMESTAMP
          WHERE ID = ? AND STATUS = 'pending'`, [id]);
      return 200;
    }
    if (status === 'sent_to_terminal') {
      await tr.query(`UPDATE COBRANCAS_TERMINAL SET CANCEL_REQUESTED = 'S', ATUALIZADO_EM = CURRENT_TIMESTAMP
          WHERE ID = ?`, [id]);
      return 202;
    }
    throw new CobrancaError(409, 'Cobranca ja encerrada', {
      status
    });
  });
  return {
    httpStatus,
    cobranca: await obter(id)
  };
}
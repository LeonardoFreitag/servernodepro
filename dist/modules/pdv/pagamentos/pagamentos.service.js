"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PagamentoError = void 0;
exports.estornarManual = estornarManual;
exports.inserirPagamento = inserirPagamento;
exports.listarPagamentos = listarPagamentos;
exports.registrarPagamento = registrarPagamento;
var _fb = require("../../../shared/database/fb");
var _pagamentos = require("./pagamentos.mapping");
/** Erro de negócio com status HTTP (404 inexistente, 409 já estornado…). */
class PagamentoError extends Error {
  constructor(httpStatus, message, extra = {}) {
    super(message);
    this.httpStatus = httpStatus;
    this.extra = extra;
  }
}
exports.PagamentoError = PagamentoError;
/**
 * Idempotência: `(PROVIDER, CIELO_ORDER_ID)` — garantido no banco pelo índice
 * UK_CIELO_PAG_ORDER_EXPR — e, na falta de order id, `(PROVIDER, REFERENCIA)`
 * (pagamento manual, por exemplo). Devolve o ID existente ou null.
 */
async function buscarExistente(ex, c) {
  if (c.CIELO_ORDER_ID) {
    const rows = await ex.query('SELECT FIRST 1 ID FROM CIELO_PAGAMENTOS WHERE PROVIDER = ? AND CIELO_ORDER_ID = ? ORDER BY ID', [c.PROVIDER, c.CIELO_ORDER_ID]);
    if (rows?.[0]?.ID != null) return Number(rows[0].ID);
  }
  if (c.REFERENCIA) {
    const rows = await ex.query('SELECT FIRST 1 ID FROM CIELO_PAGAMENTOS WHERE PROVIDER = ? AND REFERENCIA = ? ORDER BY ID', [c.PROVIDER, c.REFERENCIA]);
    if (rows?.[0]?.ID != null) return Number(rows[0].ID);
  }
  return null;
}

/**
 * Insere um pagamento de maquineta em CIELO_PAGAMENTOS (idempotente).
 * Recebe o executor (auto-commit ou transação) para poder participar da
 * transação do desfecho de cobrança.
 *
 * O ID vem SEMPRE de G_CIELO_PAGAMENTOS: o Frente (Delphi) também insere nesta
 * tabela com o mesmo generator — nunca MAX(ID)+1 nem sequência própria.
 */
async function inserirPagamento(ex, input) {
  const c = (0, _pagamentos.mapPagamentoToColumns)(input);
  const existente = await buscarExistente(ex, c);
  if (existente != null) return {
    id: existente,
    duplicado: true
  };
  const gen = await ex.query('SELECT GEN_ID(G_CIELO_PAGAMENTOS, 1) AS ID FROM RDB$DATABASE');
  const id = Number(gen[0].ID);
  try {
    await ex.query(`INSERT INTO CIELO_PAGAMENTOS (
         ID, COD_MESA, CIELO_ORDER_ID, DATA_HORA, MEIO_PAGAMENTO, BANDEIRA,
         VALOR_TOTAL, VALOR_PAGO, PARCELAS,
         AUTH_CODE, CIELO_CODE, NSU, TERMINAL, COD_EC, MASK_CARTAO,
         PRODUTO_PRIMARIO, PROD_SECUNDARIO, STATUS_CODE, PAYLOAD_JSON,
         PROVIDER, ORIGEM, TRANSACTION_TYPE, ATK, COBRANCA_ID,
         REFERENCIA, MANUAL
       ) VALUES (
         ?, ?, ?, CURRENT_TIMESTAMP, ?, ?,
         ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?
       )`, [id, c.COD_MESA, c.CIELO_ORDER_ID, c.MEIO_PAGAMENTO, c.BANDEIRA, c.VALOR_TOTAL, c.VALOR_PAGO, c.PARCELAS, c.AUTH_CODE, c.CIELO_CODE, c.NSU, c.TERMINAL, c.COD_EC, c.MASK_CARTAO, c.PRODUTO_PRIMARIO, c.PROD_SECUNDARIO, c.STATUS_CODE, c.PAYLOAD_JSON, c.PROVIDER, c.ORIGEM, c.TRANSACTION_TYPE, c.ATK, c.COBRANCA_ID, c.REFERENCIA, c.MANUAL]);
  } catch (err) {
    // Corrida entre dois POSTs iguais: o outro gravou primeiro → devolve o dele.
    if ((0, _fb.isViolacaoUnica)(err)) {
      const vencedor = await buscarExistente(ex, c);
      if (vencedor != null) return {
        id: vencedor,
        duplicado: true
      };
    }
    throw err;
  }
  if (input.itens && input.itens.length) {
    await inserirPagamentoItens(ex, id, c.COD_MESA, input.itens);
  }
  return {
    id,
    duplicado: false
  };
}

/**
 * Grava em CIELO_PAGAMENTOS_ITENS os itens cobertos por um pagamento
 * (mesmo executor → mesma transação do pagamento).
 */
async function inserirPagamentoItens(ex, pagamentoId, codMesa, itens) {
  for (const it of itens) {
    const gen = await ex.query('SELECT GEN_ID(G_CIELO_PAGAMENTOS_ITENS, 1) AS ID FROM RDB$DATABASE');
    await ex.query(`INSERT INTO CIELO_PAGAMENTOS_ITENS
         (ID, PAGAMENTO_ID, COD_MESA, COD_ITEM, COD_CONJUGA, QTDE, VALOR)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [Number(gen[0].ID), pagamentoId, codMesa, it.codItem, it.codConjuga ?? 0, it.qtde, it.valor]);
  }
}

/** Versão em transação própria (usada por POST /pagamentos). */
function registrarPagamento(input) {
  return (0, _fb.withTransaction)(tr => inserirPagamento(tr, input));
}

/** Quanto de um item da venda já foi coberto por pagamentos válidos (soma por item). */

/**
 * Filtro IDÊNTICO ao do PDV (`sqlCieloPendentes` do Frente): assim o
 * "já pago" do app e os "pendentes para importar" do caixa são o mesmo conjunto.
 * STATUS_CODE sem COALESCE de propósito — linha com status nulo é invisível
 * para o caixa e, portanto, tem de ser invisível para o app também.
 */
const FILTRO_PDV = `
        WHERE P.COD_MESA = ?
          AND COALESCE(P.ORIGEM, 'M') = ?
          AND P.STATUS_CODE IN ('0', '1')
          AND P.ESTORNADO_POR IS NULL`;

/**
 * Lista os pagamentos aprovados de uma venda, excluindo os estornados.
 * Usado pelo app para restaurar pagamentos parciais e decidir `fullyPaid`.
 */
async function listarPagamentos(origem, codVenda) {
  const {
    rows,
    itemRows
  } = await (0, _fb.withDb)(async db => {
    const rows = await db.query(`SELECT P.ID, P.PROVIDER, P.TRANSACTION_TYPE, P.MEIO_PAGAMENTO, P.BANDEIRA, P.VALOR_PAGO,
              P.AUTH_CODE, P.NSU, P.ESTORNADO_POR, P.CONSUMIDO, P.MANUAL
         FROM CIELO_PAGAMENTOS P${FILTRO_PDV}
        ORDER BY P.ID`, [codVenda, origem]);
    // Mesmos filtros do pagamento: estorno libera os itens automaticamente.
    const itemRows = await db.query(`SELECT I.COD_ITEM, I.COD_CONJUGA, SUM(I.QTDE) AS QTDE, SUM(I.VALOR) AS VALOR
         FROM CIELO_PAGAMENTOS_ITENS I
         JOIN CIELO_PAGAMENTOS P ON P.ID = I.PAGAMENTO_ID${FILTRO_PDV}
        GROUP BY I.COD_ITEM, I.COD_CONJUGA`, [codVenda, origem]);
    return {
      rows,
      itemRows
    };
  });
  const flag = v => String(v ?? '').trim() === 'S';
  const pagamentos = rows.map(r => ({
    id: r.ID,
    provider: r.PROVIDER ?? 'CIELO',
    transactionType: r.TRANSACTION_TYPE ?? '',
    meioPagamento: r.MEIO_PAGAMENTO ?? '',
    bandeira: r.BANDEIRA ?? '',
    valorPago: Number(r.VALOR_PAGO ?? 0),
    authCode: r.AUTH_CODE ?? '',
    nsu: r.NSU ?? '',
    estornado: false,
    consumido: flag(r.CONSUMIDO),
    manual: flag(r.MANUAL)
  }));
  const totalPago = Math.round(pagamentos.reduce((sum, p) => sum + p.valorPago, 0) * 100) / 100;
  const itensPagos = itemRows.map(r => ({
    codItem: Number(r.COD_ITEM),
    codConjuga: Number(r.COD_CONJUGA ?? 0),
    qtde: Number(r.QTDE ?? 0),
    valor: Math.round(Number(r.VALOR ?? 0) * 100) / 100
  }));
  return {
    codVenda,
    totalPago,
    pagamentos,
    itensPagos
  };
}
/**
 * Lê o PAYLOAD_JSON como texto via CAST (até 32000 chars; o maior payload Cielo
 * visto tem ~3 KB), em auto-commit e FORA da transação de estorno.
 *
 * Por que não ler o BLOB "de verdade": o node-firebird 0.9.9 devolve colunas
 * BLOB como uma função de leitura preguiçosa que abre transação própria e falha
 * com "invalid BLOB ID" tanto dentro de `WITH LOCK` quanto depois do auto-commit
 * (achado no smoke de 19/10/2026). `undefined` = não foi possível ler (payload
 * maior que o CAST ou banco fora) — o estorno segue sem anotar no payload.
 */
async function lerPayloadJson(id) {
  try {
    return await (0, _fb.withDb)(async db => {
      const rows = await db.query('SELECT CAST(PAYLOAD_JSON AS VARCHAR(32000)) AS P FROM CIELO_PAGAMENTOS WHERE ID = ?', [id]);
      if (!rows?.[0]) return null;
      return (0, _fb.blobToString)(rows[0].P);
    });
  } catch (err) {
    console.error('[pagamentos] Nao foi possivel ler PAYLOAD_JSON para anotar o estorno manual:', err?.message ?? err);
    return undefined;
  }
}

/** Mescla `{ estornoManual }` no JSON cru sem perder a resposta do provedor. */
function mesclarEstornoManual(payloadStr, nota) {
  let payload;
  try {
    payload = payloadStr ? JSON.parse(payloadStr) : {};
  } catch {
    payload = {
      raw: payloadStr
    };
  }
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) payload = {
    raw: payload
  };
  payload.estornoManual = nota;
  return JSON.stringify(payload);
}

/**
 * PATCH /pagamentos/:id/estorno-manual — Pix devolvido no portal/app da Cielo,
 * fora da maquineta. Marca ESTORNADO_POR='MANUAL' e ESTORNADO_EM; o PDV já
 * exclui `ESTORNADO_POR IS NOT NULL` de todas as somas, então o efeito no caixa
 * é imediato. Usuário/motivo vão MESCLADOS no PAYLOAD_JSON (chave
 * `estornoManual`), preservando a resposta bruta do provedor — best-effort: se o
 * BLOB não puder ser lido, o estorno é gravado assim mesmo e o motivo fica só no
 * log em arquivo. REFERENCIA não é tocada: é chave de idempotência do app.
 */
async function estornarManual(id, dados) {
  const payloadStr = await lerPayloadJson(id);
  return (0, _fb.withTransaction)(async tr => {
    const rows = await tr.query('SELECT ID, ESTORNADO_POR FROM CIELO_PAGAMENTOS WHERE ID = ? WITH LOCK', [id]);
    const row = rows?.[0];
    if (!row) throw new PagamentoError(404, 'Pagamento nao encontrado');
    const estornadoPor = String(row.ESTORNADO_POR ?? '').trim();
    if (estornadoPor) throw new PagamentoError(409, 'Pagamento ja estornado', {
      estornadoPor
    });
    const em = new Date().toISOString();
    if (payloadStr !== undefined) {
      const novoPayload = mesclarEstornoManual(payloadStr, {
        usuario: dados.usuario ?? null,
        motivo: dados.motivo,
        em
      });
      await tr.query(`UPDATE CIELO_PAGAMENTOS
            SET ESTORNADO_POR = 'MANUAL', ESTORNADO_EM = CURRENT_TIMESTAMP, PAYLOAD_JSON = ?
          WHERE ID = ?`, [novoPayload, id]);
    } else {
      await tr.query(`UPDATE CIELO_PAGAMENTOS SET ESTORNADO_POR = 'MANUAL', ESTORNADO_EM = CURRENT_TIMESTAMP WHERE ID = ?`, [id]);
    }
    return {
      id,
      estornadoPor: 'MANUAL',
      estornadoEm: em
    };
  });
}
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SCRIPT_MINIMO = void 0;
exports.healthHandler = healthHandler;
exports.lerScriptAtual = lerScriptAtual;
exports.obterVersaoDb = obterVersaoDb;
exports.requireDbVersion = requireDbVersion;
exports.resetVersaoDbCache = resetVersaoDbCache;
var _fb = require("./fb");
/**
 * Versão do schema do banco (tabela VERSAO_SCRIPTS, criada pelo Script23 da
 * equipe Delphi). A API exige um mínimo para gravar pagamentos: um app novo
 * contra um banco sem as colunas perderia pagamentos em silêncio (caso de 17/10).
 *
 * `GET /health` expõe `{ db: { scriptAtual, scriptMinimo, ok } }`; o middleware
 * `requireDbVersion` responde 503 `BANCO_DESATUALIZADO` nas rotas de escrita.
 * O valor fica em cache (60 s) para não consultar o banco a cada requisição.
 */

const SCRIPT_MINIMO = exports.SCRIPT_MINIMO = 23;
const TTL_MS = 60_000;
const TTL_ERRO_MS = 10_000;
let cache = null;
let cacheValidoAte = 0;
let emCurso = null;

/** Só para testes. */
function resetVersaoDbCache() {
  cache = null;
  cacheValidoAte = 0;
  emCurso = null;
}
async function lerScriptAtual() {
  try {
    const rows = await (0, _fb.fbQuery)('SELECT MAX(NUMERO) AS N FROM VERSAO_SCRIPTS');
    return Number(rows?.[0]?.N ?? 0) || 0;
  } catch (err) {
    if ((0, _fb.isTabelaInexistente)(err)) return 0;
    throw err;
  }
}
async function obterVersaoDb(force = false) {
  if (!force && cache && Date.now() < cacheValidoAte) return cache;
  if (emCurso) return emCurso;
  emCurso = (async () => {
    try {
      const n = await lerScriptAtual();
      cache = {
        scriptAtual: n,
        scriptMinimo: SCRIPT_MINIMO,
        ok: n >= SCRIPT_MINIMO,
        verificadoEm: new Date().toISOString()
      };
      cacheValidoAte = Date.now() + TTL_MS;
    } catch (err) {
      const erro = err?.message ?? String(err);
      // Banco fora do ar: mantém o último valor conhecido (não bloqueia quem já estava ok).
      cache = cache ? {
        ...cache,
        erro
      } : {
        scriptAtual: null,
        scriptMinimo: SCRIPT_MINIMO,
        ok: false,
        verificadoEm: null,
        erro
      };
      cacheValidoAte = Date.now() + TTL_ERRO_MS;
    } finally {
      emCurso = null;
    }
    return cache;
  })();
  return emCurso;
}

/** 503 quando o banco não tem o Script mínimo (ou está inacessível e nunca foi lido). */
function requireDbVersion(req, res, next) {
  obterVersaoDb().then(v => {
    if (v.ok) return next();
    if (v.scriptAtual == null) {
      res.status(503).send({
        erro: 'BANCO_INDISPONIVEL',
        scriptMinimo: v.scriptMinimo,
        detalhe: v.erro
      });
      return;
    }
    res.status(503).send({
      erro: 'BANCO_DESATUALIZADO',
      scriptAtual: v.scriptAtual,
      scriptMinimo: v.scriptMinimo
    });
  }).catch(next);
}

/**
 * GET /health[?force=1]
 * Sempre 200: o corpo diz se está ok. (503 aqui faria o app confundir
 * "banco desatualizado" com "API fora do ar".)
 */
async function healthHandler(req, res) {
  const db = await obterVersaoDb(String(req.query.force ?? '') === '1');
  res.status(200).send({
    status: db.ok ? 'ok' : 'degraded',
    uptimeSeconds: Math.round(process.uptime()),
    db
  });
}
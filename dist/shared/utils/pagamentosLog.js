"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.logPagamento = logPagamento;
exports.resumoErro = resumoErro;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
/**
 * Log em arquivo dos pagamentos de maquineta (JSON por linha), no padrão de
 * `restauranteEventos.ts`. Serve para auditar o que a API recebeu quando o
 * caixa diz que "o pagamento não apareceu". Nunca lança.
 */

// Fora de src/dist para sobreviver a rebuilds (pasta /logs está no .gitignore).
const LOG_FILE = _path.default.join(process.cwd(), 'logs', 'pagamentos.jsonl');
function logPagamento(evento, dados = {}) {
  try {
    const linha = {
      timestamp: new Date().toISOString(),
      evento,
      ...dados
    };
    _fs.default.mkdirSync(_path.default.dirname(LOG_FILE), {
      recursive: true
    });
    _fs.default.appendFileSync(LOG_FILE, JSON.stringify(linha) + '\n');
  } catch {
    /* log nunca derruba a requisição */
  }
}

/** Resumo do erro para o log (mensagem + gdscode do Firebird, se houver). */
function resumoErro(err) {
  const mensagem = err?.message ?? String(err);
  const code = err?.gdscode;
  return typeof code === 'number' ? {
    mensagem,
    gdscode: code
  } : {
    mensagem
  };
}
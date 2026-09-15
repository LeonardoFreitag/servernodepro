"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.listarEventosRestaurante = listarEventosRestaurante;
exports.registrarEventoRestaurante = registrarEventoRestaurante;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// Persistido fora de src/dist para sobreviver a rebuilds
const EVENTOS_FILE = _path.default.join(process.cwd(), 'logs', 'restaurante-eventos.jsonl');
function registrarEventoRestaurante(idProvider, tipo, origem) {
  const evento = {
    timestamp: new Date().toISOString(),
    idProvider,
    tipo,
    origem
  };
  _fs.default.mkdirSync(_path.default.dirname(EVENTOS_FILE), {
    recursive: true
  });
  _fs.default.appendFileSync(EVENTOS_FILE, JSON.stringify(evento) + '\n');
}
function listarEventosRestaurante(limit = 200) {
  if (!_fs.default.existsSync(EVENTOS_FILE)) return [];
  const linhas = _fs.default.readFileSync(EVENTOS_FILE, 'utf-8').split('\n').filter(Boolean);
  const eventos = linhas.map(linha => JSON.parse(linha));
  return eventos.reverse().slice(0, limit);
}
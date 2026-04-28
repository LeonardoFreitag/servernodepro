"use strict";

var _app = _interopRequireDefault(require("../app"));
var _http = _interopRequireDefault(require("http"));
var _debug = _interopRequireDefault(require("debug"));
var _config = _interopRequireDefault(require("../config"));
var requests = _interopRequireWildcard(require("../modules/digital/requests/requests.service"));
var providers = _interopRequireWildcard(require("../modules/digital/providers/providers.service"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const log = (0, _debug.default)('nodestr:server');
const port = normalizePort(process.env.PORT || _config.default.port);
_app.default.set('port', port);
const server = _http.default.createServer(_app.default);
let idProvider = '';
providers.getProviderId(result => {
  console.log(result);
  idProvider = result;
});
setInterval(() => {
  requests.getNewRequests(idProvider);
}, 15000);
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
console.log('API rodando na porta ' + port);
function normalizePort(val) {
  const portNum = parseInt(String(val), 10);
  if (isNaN(portNum)) return val;
  if (portNum >= 0) return portNum;
  return false;
}
function onError(error) {
  if (error.syscall !== 'listen') throw error;
  const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requer privilégios elevados!');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' está em uso!');
      process.exit(1);
      break;
    default:
      throw error;
  }
}
function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr?.port;
  log('Listening on ' + bind);
}
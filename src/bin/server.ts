import app from '../app';
import http from 'http';
import debug from 'debug';
import config from '../config';
import * as requests from '../modules/digital/requests/requests.service';
import * as providers from '../modules/digital/providers/providers.service';
import { startWatchdog } from '../modules/digital/providers/heartbeat.service';
import { expirarPendentes } from '../modules/pdv/cobrancas/cobrancas.service';
import { obterVersaoDb } from '../shared/database/dbVersion';

const log = debug('nodestr:server');

const port = normalizePort(process.env.PORT || config.port);
app.set('port', port);

const server = http.createServer(app);

let idProvider = '';

providers.getProviderId((result: string) => {
  console.log(result);
  idProvider = result;
});

setInterval(() => {
  requests.getNewRequests(idProvider);
}, 15000);

startWatchdog();

// Cobranças de maquineta: expira `pending` vencidas (nunca `sent_to_terminal`).
// Tolerante a erro de conexão (só loga).
setInterval(() => { expirarPendentes(); }, 30000);

// Autoverificação do schema na subida (o mesmo que GET /health devolve).
obterVersaoDb(true).then((v) => {
  if (v.ok) console.log(`[db] VERSAO_SCRIPTS = ${v.scriptAtual} (mínimo ${v.scriptMinimo}) — ok`);
  else if (v.scriptAtual == null) console.error(`[db] Banco inacessível na subida: ${v.erro}`);
  else console.error(`[db] BANCO_DESATUALIZADO: script ${v.scriptAtual} < mínimo ${v.scriptMinimo}. Rode o Script23 antes de usar /pagamentos e /cobrancas.`);
});

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
console.log('API rodando na porta ' + port);

function normalizePort(val: string | number): number | string | false {
  const portNum = parseInt(String(val), 10);
  if (isNaN(portNum)) return val;
  if (portNum >= 0) return portNum;
  return false;
}

function onError(error: NodeJS.ErrnoException): void {
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

function onListening(): void {
  const addr = server.address();
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr?.port;
  log('Listening on ' + bind);
}

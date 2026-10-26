import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';

// PDV
import configRoutes from './modules/pdv/config/config.routes';
import funcRoutes from './modules/pdv/func/func.routes';
import gruposRoutes from './modules/pdv/grupos/grupos.routes';
import subgruposRoutes from './modules/pdv/subgrupos/subgrupos.routes';
import obsRoutes from './modules/pdv/obs/obs.routes';
import mesasRoutes from './modules/pdv/mesas/mesas.routes';
import itensRoutes from './modules/pdv/itens/itens.routes';
import cieloRoutes from './modules/pdv/cielo/cielo.routes';
import pagamentosRoutes from './modules/pdv/pagamentos/pagamentos.routes';
import cobrancasRoutes from './modules/pdv/cobrancas/cobrancas.routes';
import nfceRoutes from './modules/pdv/nfce/nfce.routes';
import { healthHandler, requireDbVersion } from './shared/database/dbVersion';
import config from './config';

// Digital
import cardapioRoutes from './modules/digital/cardapio/cardapio.routes';
import productManagerRoutes from './modules/digital/cardapio/productManager.routes';
import providersRoutes from './modules/digital/providers/providers.routes';
import neighborhoodRoutes from './modules/digital/neighborhood/neighborhood.routes';
import paymentRoutes from './modules/digital/payment/payment.routes';
import requestsRoutes from './modules/digital/requests/requests.routes';
import entregasRoutes from './modules/digital/entregas/entregas.routes';
import deliveryRoutes from './modules/digital/delivery/delivery.routes';
import restauranteRoutes from './modules/digital/restaurante/restaurante.routes';

const app = express();

app.use(cors());
// Respostas da API nunca podem ser guardadas por intermediários (proxy da rede do
// terminal, cache HTTP do Android): o app lê estado vivo (mesas, pagamentos, fila).
// Caso real (26/10/2026): maquineta recebia /mesas e /pagamentos antigos enquanto
// o celular, na mesma API, recebia o atual.
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.set('etag', false);
// Log de acesso no console: método, rota, status, origem — para ver se o pedido
// do aparelho chega mesmo à API (LOG_REQUESTS=false desliga).
if (process.env.LOG_REQUESTS !== 'false') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const inicio = Date.now();
    res.on('finish', () => {
      const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
      console.log(`[http] ${new Date().toISOString()} ${req.method} ${req.originalUrl} -> ${res.statusCode} ${Date.now() - inicio}ms de ${ip.replace('::ffff:', '')}`);
    });
    next();
  });
}
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'images')));
app.use(express.static(path.join(__dirname, 'views')));

app.get('/', (req: Request, res: Response) => {
  res.status(200).send({ title: config.isAutoMax ? 'AutoMax API' : 'Mettre API', version: '0.0.2', modo: config.modo });
});

// Versão do schema do banco (VERSAO_SCRIPTS). O app lê na abertura e bloqueia
// "Pagar na maquininha" quando `db.ok` é false.
app.get('/health', healthHandler);

// Comum aos dois sistemas: login do app (V_FUNC), credenciais Cielo, fila de maquineta.
app.use('/config', configRoutes);
app.use('/func', funcRoutes);
// Pagamentos de maquineta: 503 BANCO_DESATUALIZADO se o banco não tem o Script23
// (no AutoMax, o Script_AutoMax_Maquininha_v1 — mesmo NUMERO 23 em VERSAO_SCRIPTS).
app.use('/cielo', requireDbVersion, cieloRoutes); // legado — alias de /pagamentos
app.use('/pagamentos', requireDbVersion, pagamentosRoutes);
app.use('/cobrancas', requireDbVersion, cobrancasRoutes);

if (!config.isAutoMax) {
  // PDV Mettre (comandas)
  app.use('/grupos', gruposRoutes);
  app.use('/subgrupos', subgruposRoutes);
  app.use('/obs', obsRoutes);
  app.use('/mesas', mesasRoutes);
  app.use('/itens', itensRoutes);
  app.use('/nfce', nfceRoutes);

  // Digital
  app.use('/products', cardapioRoutes);
  app.use('/productManager', productManagerRoutes);
  app.use('/providers', providersRoutes);
  app.use('/neighborhood', neighborhoodRoutes);
  app.use('/payment', paymentRoutes);
  app.use('/request', requestsRoutes);
  app.use('/entregas', entregasRoutes);
  app.use('/delivery', deliveryRoutes);
  app.use('/restaurante', restauranteRoutes);
}

export default app;

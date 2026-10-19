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
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'images')));
app.use(express.static(path.join(__dirname, 'views')));

app.get('/', (req: Request, res: Response) => {
  res.status(200).send({ title: 'Mettre API', version: '0.0.2' });
});

// Versão do schema do banco (VERSAO_SCRIPTS). O app lê na abertura e bloqueia
// "Pagar na maquininha" quando `db.ok` é false.
app.get('/health', healthHandler);

// PDV
app.use('/config', configRoutes);
app.use('/func', funcRoutes);
app.use('/grupos', gruposRoutes);
app.use('/subgrupos', subgruposRoutes);
app.use('/obs', obsRoutes);
app.use('/mesas', mesasRoutes);
app.use('/itens', itensRoutes);
// Pagamentos de maquineta: 503 BANCO_DESATUALIZADO se o banco não tem o Script23.
app.use('/cielo', requireDbVersion, cieloRoutes); // legado — alias de /pagamentos
app.use('/pagamentos', requireDbVersion, pagamentosRoutes);
app.use('/cobrancas', requireDbVersion, cobrancasRoutes);
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

export default app;

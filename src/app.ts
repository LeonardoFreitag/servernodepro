import express, { Request, Response, NextFunction } from 'express';
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

// Digital
import cardapioRoutes from './modules/digital/cardapio/cardapio.routes';
import productManagerRoutes from './modules/digital/cardapio/productManager.routes';
import providersRoutes from './modules/digital/providers/providers.routes';
import neighborhoodRoutes from './modules/digital/neighborhood/neighborhood.routes';
import paymentRoutes from './modules/digital/payment/payment.routes';
import requestsRoutes from './modules/digital/requests/requests.routes';
import entregasRoutes from './modules/digital/entregas/entregas.routes';

const app = express();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'images')));

app.get('/', (req: Request, res: Response) => {
  res.status(200).send({ title: 'Mettre API', version: '0.0.2' });
});

// PDV
app.use('/config', configRoutes);
app.use('/func', funcRoutes);
app.use('/grupos', gruposRoutes);
app.use('/subgrupos', subgruposRoutes);
app.use('/obs', obsRoutes);
app.use('/mesas', mesasRoutes);
app.use('/itens', itensRoutes);

// Digital
app.use('/products', cardapioRoutes);
app.use('/productManager', productManagerRoutes);
app.use('/providers', providersRoutes);
app.use('/neighborhood', neighborhoodRoutes);
app.use('/payment', paymentRoutes);
app.use('/request', requestsRoutes);
app.use('/entregas', entregasRoutes);

export default app;

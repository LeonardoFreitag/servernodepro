import { Router } from 'express';
import * as controller from './providers.controller';
import { heartbeat } from './heartbeat.controller';
import { status } from './status.controller';

const router = Router();

// Consulta somente leitura usada pelo PDV (Frente de Caixa) — mesma
// exposição das demais rotas de /providers, o PDV envia apenas o id.
router.get('/status', status);

router.get('/', controller.get);
router.post('/', controller.post);
router.put('/', controller.put);
router.delete('/', controller.del);
router.post('/heartbeat', heartbeat);

export default router;

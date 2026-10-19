import { Router } from 'express';
import { requireApiKey } from '../../../shared/middlewares/apiKey';
import * as controller from './cobrancas.controller';

const router = Router();

router.use(requireApiKey);

// Rotas fixas antes das parametrizadas.
router.get('/pendentes', controller.pendentes);
router.get('/cards', controller.cards);
router.get('/:id', controller.obter);
router.post('/:id/claim', controller.claim);
router.patch('/:id', controller.desfecho);
router.post('/:id/cancelar', controller.cancelar);

export default router;

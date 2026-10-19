import { Router } from 'express';
import { requireApiKey } from '../../../shared/middlewares/apiKey';
import * as controller from './pagamentos.controller';

const router = Router();

// Exige X-Api-Key quando config.apiKey está definida.
router.post('/', requireApiKey, controller.registrar);
router.patch('/:id/estorno-manual', requireApiKey, controller.estornoManual);
router.get('/:origem/:codVenda', controller.listar);

export default router;

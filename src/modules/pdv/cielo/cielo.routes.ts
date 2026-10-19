import { Router } from 'express';
import * as controller from '../pagamentos/pagamentos.controller';

/**
 * Rotas legadas — mantidas como alias do módulo `pagamentos`.
 * Continuam SEM exigir X-Api-Key (compatibilidade com instalações antigas).
 */
const router = Router();

router.post('/pagamento', controller.registrarLegadoCielo);
router.get('/pagamentos/:codMesa', controller.listarLegadoMesa);

export default router;

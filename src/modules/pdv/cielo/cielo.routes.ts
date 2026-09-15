import { Router } from 'express';
import * as controller from './cielo.controller';

const router = Router();

router.post('/pagamento', controller.registrarPagamento);
router.get('/pagamentos/:codMesa', controller.listarPagamentosMesa);

export default router;

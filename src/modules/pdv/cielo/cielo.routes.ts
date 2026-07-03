import { Router } from 'express';
import * as controller from './cielo.controller';

const router = Router();

router.post('/pagamento', controller.registrarPagamento);

export default router;

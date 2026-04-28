import { Router } from 'express';
import * as controller from './mesas.controller';

const router = Router();

router.get('/', controller.get);
router.put('/', controller.insereComanda);
router.post('/fechaConta', controller.fechaConta);
router.delete('/', controller.del);

export default router;

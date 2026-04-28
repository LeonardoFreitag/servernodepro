import { Router } from 'express';
import * as controller from './itens.controller';

const router = Router();

router.get('/:codigo', controller.get);
router.put('/', controller.put);
router.delete('/', controller.del);

export default router;

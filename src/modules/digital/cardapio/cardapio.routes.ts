import { Router } from 'express';
import * as controller from './cardapio.controller';

const router = Router();

router.get('/', controller.getEstoque);
router.post('/', controller.post);
router.put('/:id', controller.put);
router.post('/delete', controller.del);
router.post('/clearProducts', controller.clearProducts);

export default router;

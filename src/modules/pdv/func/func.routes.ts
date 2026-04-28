import { Router } from 'express';
import * as controller from './func.controller';

const router = Router();

router.get('/', controller.get);
router.post('/', controller.post);
router.put('/:id', controller.put);
router.delete('/', controller.del);

export default router;

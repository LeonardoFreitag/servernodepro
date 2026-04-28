import { Router } from 'express';
import * as controller from './providers.controller';

const router = Router();

router.get('/', controller.get);
router.post('/', controller.post);
router.put('/', controller.put);
router.delete('/', controller.del);

export default router;

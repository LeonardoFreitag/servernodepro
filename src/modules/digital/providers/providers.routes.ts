import { Router } from 'express';
import * as controller from './providers.controller';
import { heartbeat } from './heartbeat.controller';

const router = Router();

router.get('/', controller.get);
router.post('/', controller.post);
router.put('/', controller.put);
router.delete('/', controller.del);
router.post('/heartbeat', heartbeat);

export default router;

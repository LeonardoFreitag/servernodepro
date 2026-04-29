import { Router } from 'express';
import * as controller from './delivery.controller';

const router = Router();

router.get('/fee', controller.getFee);
router.post('/sync', controller.sync);

export default router;

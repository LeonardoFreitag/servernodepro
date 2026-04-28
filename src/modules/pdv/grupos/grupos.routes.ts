import { Router } from 'express';
import * as controller from './grupos.controller';

const router = Router();

router.get('/', controller.get);

export default router;

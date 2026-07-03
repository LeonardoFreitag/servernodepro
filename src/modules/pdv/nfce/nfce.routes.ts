import { Router } from 'express';
import { solicitar, status } from './nfce.controller';

const router = Router();

router.post('/solicitar', solicitar);
router.get('/status/:id', status);

export default router;

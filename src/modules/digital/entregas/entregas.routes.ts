import { Router } from 'express';
import * as controller from './entregas.controller';

const router = Router();

router.post('/enviar-link', controller.enviarLink);

export default router;

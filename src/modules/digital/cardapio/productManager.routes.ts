import { Router } from 'express';
import * as controller from './cardapio.controller';

const router = Router();

router.get('/', controller.getCardapio);

export default router;

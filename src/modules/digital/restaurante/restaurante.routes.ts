import { Router } from 'express';
import { abrirRestaurante, fecharRestaurante } from './restaurante.controller';

const router = Router();

router.post('/abrir', abrirRestaurante);
router.post('/fechar', fecharRestaurante);

export default router;

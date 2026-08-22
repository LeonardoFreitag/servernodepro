import { Router } from 'express';
import { abrirRestaurante, fecharRestaurante, listarEventos } from './restaurante.controller';

const router = Router();

router.post('/abrir', abrirRestaurante);
router.post('/fechar', fecharRestaurante);
router.get('/eventos', listarEventos);

export default router;

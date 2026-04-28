import { Request, Response, NextFunction } from 'express';
import config from '../../../config';
import { gerarToken, enviarWhatsApp } from './entregas.service';

export async function enviarLink(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { idProvider, entregador_code, entregador_name, entregador_fone } = req.body;
  const ts = new Date().toISOString();

  try {
    const token = gerarToken({ idProvider, entregador_code, entregador_name });
    const link = `${config.frontendUrl}/entregas?token=${token}`;

    console.log(`[${ts}] enviarLink — idProvider=${idProvider} entregador=${entregador_code}`);

    await enviarWhatsApp(entregador_fone, link);

    res.status(200).json({ sucesso: true, link });
  } catch (err: any) {
    console.error(`[${ts}] enviarLink — erro:`, err.message);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
}

import { Request, Response } from 'express';
import { handleHeartbeat } from './heartbeat.service';

export async function heartbeat(req: Request, res: Response): Promise<void> {
  const { id } = req.body ?? {};

  if (!id || typeof id !== 'string') {
    res.status(400).send({ ok: false, erro: 'id é obrigatório' });
    return;
  }

  try {
    const result = await handleHeartbeat(id);

    if (result.status === 'unknown') {
      res.status(404).send({ ok: false });
      return;
    }

    res.status(200).send({ ok: true, open: result.open });
  } catch (err: any) {
    console.error(`[heartbeat] erro ao processar heartbeat de ${id}`, err);
    res.status(500).send({ ok: false, erro: err.message });
  }
}

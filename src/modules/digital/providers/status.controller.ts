import { Request, Response } from 'express';
import createDebug from 'debug';
import { getProviderStatus } from './status.service';

const log = createDebug('providers:status');

/**
 * GET /providers/status?id=<WEB_KEY>
 *
 * Somente leitura e idempotente: o PDV usa para exibir o indicador de vendas
 * on-line na barra de título das telas de venda. Sem log por requisição.
 */
export async function status(req: Request, res: Response): Promise<void> {
  const raw = req.query?.id;
  const id = typeof raw === 'string' ? raw.trim() : '';

  if (!id) {
    res.status(400).send({ erro: 'id é obrigatório' });
    return;
  }

  try {
    const result = await getProviderStatus(id);

    res.set('Cache-Control', 'no-store');

    if (result.status === 'unknown') {
      log('id desconhecido: %s', id);
      res.status(404).send({ erro: 'provider não encontrado' });
      return;
    }

    log('%s open=%s source=%s', id, result.data.open, result.data.source);
    res.status(200).json(result.data);
  } catch (err: any) {
    console.error(`[providers/status] erro ao consultar ${id}`, err);
    res.status(500).send({ erro: err.message });
  }
}

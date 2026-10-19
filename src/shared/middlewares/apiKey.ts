import { Request, Response, NextFunction } from 'express';
import config from '../../config';

/**
 * Exige o header `X-Api-Key` igual a `config.apiKey`.
 * Quando `config.apiKey` está vazio (instalações antigas), não exige nada.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const expected = (config.apiKey ?? '').trim();
  if (!expected) return next();

  const received = String(req.header('x-api-key') ?? '').trim();
  if (received && received === expected) return next();

  res.status(401).send({ error: 'X-Api-Key ausente ou inválida.' });
}

import { Request, Response, NextFunction } from 'express';
import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';

export function get(req: Request, res: Response, next: NextFunction): void {
  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) throw err;

    db.query('SELECT V_LIMITE_PEDACOS, V_COBR_SERVICO, V_PER_SERVICO FROM config', (err, result) => {
      const row = result?.[0] ?? {};
      res.status(200).send({
        vLimitePedacos:   row.V_LIMITE_PEDACOS  ?? null,
        cieloClientId:    process.env.CIELO_CLIENT_ID    ?? '',
        cieloAccessToken: process.env.CIELO_ACCESS_TOKEN ?? '',
        cobrServico:      (row.V_COBR_SERVICO ?? 'N').toString().trim(),
        perServico:       row.V_PER_SERVICO  ?? 0,
      });
      db.detach();
    });
  });
}

export function post(req: Request, res: Response, next: NextFunction): void {
  res.status(201).send(req.body);
}

export function put(req: Request, res: Response, next: NextFunction): void {
  const id = req.params.id;
  res.status(201).send({ id, title: req.body.title, cost: req.body.cost });
}

export function del(req: Request, res: Response, next: NextFunction): void {
  res.status(200).send(req.body);
}

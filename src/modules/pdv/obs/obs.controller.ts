import { Request, Response, NextFunction } from 'express';
import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';

export function get(req: Request, res: Response, next: NextFunction): void {
  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) throw err;

    db.query('SELECT * FROM v_obs', (err, result) => {
      const dataResult = result.map((item: any) => ({
        codigo: item.CODIGO,
        observacao: item.OBS,
        grupo: item.GRUPO,
      }));
      res.status(200).send(dataResult);
      db.detach();
    });
  });
}

export function post(req: Request, res: Response, next: NextFunction): void {
  res.status(201).send(req.body);
}

export function put(req: Request, res: Response, next: NextFunction): void {
  res.status(201).send({ id: req.params.id, item: req.body });
}

export function del(req: Request, res: Response, next: NextFunction): void {
  res.status(200).send(req.body);
}

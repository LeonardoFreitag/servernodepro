import { Request, Response, NextFunction } from 'express';
import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';

export function get(req: Request, res: Response, next: NextFunction): void {
  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) throw err;

    db.query('SELECT V_LIMITE_PEDACOS FROM config', (err, result) => {
      res.status(200).send(result);
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

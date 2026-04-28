import { Request, Response, NextFunction } from 'express';
import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';

export function get(req: Request, res: Response, next: NextFunction): void {
  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) throw err;

    db.query('SELECT * FROM V_ANDROID_SUBGRUPOS', (err, result) => {
      const dataResult = result.map((item: any) => ({ nome: item.NOME }));
      res.status(200).send(dataResult);
      db.detach();
    });
  });
}

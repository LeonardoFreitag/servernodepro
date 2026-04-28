import { Request, Response, NextFunction } from 'express';
import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';

export function get(req: Request, res: Response, next: NextFunction): void {
  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) throw err;

    db.query('SELECT * FROM V_ANDROID_GRUPOS', (err, result) => {
      const dataResult = result.map((item: any) => ({
        codigo: item.CODIGO,
        nome: item.NOME,
        combinado: item.COMBINADO,
        sabores: item.SABORES,
      }));
      res.status(200).send(dataResult);
      db.detach();
    });
  });
}

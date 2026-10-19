import { Request, Response, NextFunction } from 'express';
import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';

/** GET /func — vendedores/funcionários ativos com senha (view V_FUNC; Mettre e AutoMax). */
export function get(req: Request, res: Response, next: NextFunction): void {
  Firebird.attach(firebirdOptions, (err, db) => {
    // Nunca `throw` dentro do callback: derruba o processo (ou, com a guarda
    // global de uncaughtException, deixa a requisição pendurada sem resposta).
    if (err) return next(err);

    db.query('SELECT CODIGO, NOME, SENHA FROM V_FUNC', (err, result) => {
      db.detach();
      if (err) {
        console.error(`[func] GET /func: ${err.message}`);
        res.status(500).send({ error: `Falha ao ler V_FUNC: ${err.message}` });
        return;
      }
      const dataResult = (result ?? []).map((item: any) => ({
        codigo: String(item.CODIGO ?? '').trim(),
        nome: String(item.NOME ?? '').trim(),
        senha: String(item.SENHA ?? '').trim(),
      }));
      res.status(200).send(dataResult);
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

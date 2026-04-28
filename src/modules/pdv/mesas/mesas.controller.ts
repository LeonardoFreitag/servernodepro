import { Request, Response, NextFunction } from 'express';
import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';

function getPrintCaixaGroupId(): Promise<any> {
  return new Promise((resolve, reject) => {
    Firebird.attach(firebirdOptions, (err, db) => {
      if (err) throw err;
      db.query('select gen_id(g_print_group_caixa, 1) as id from rdb$database', (err, result) => {
        if (err) reject(err);
        else resolve(result[0].ID);
        db.detach();
      });
    });
  });
}

function insertImpressaoCaixa(printGroupId: any, codMesa: string, destino: string): Promise<any> {
  return new Promise((resolve, reject) => {
    Firebird.attach(firebirdOptions, (err, db) => {
      if (err) throw err;
      db.query(
        'insert into impressoes_caixa(id, id_computador, id_origem, origem, destino) values(?, ?, ?, ?, ?)',
        [printGroupId, 'MOBILE', codMesa, 'M', destino],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
          db.detach();
        }
      );
    });
  });
}

function updateStatusConta(codigo: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    Firebird.attach(firebirdOptions, (err, db) => {
      if (err) throw err;
      db.query(
        "update mesas_abertas set status=? where codigo=?",
        ['F', codigo],
        (err) => {
          if (err) reject(false);
          else resolve(true);
          db.detach();
        }
      );
    });
  });
}

export function get(req: Request, res: Response, next: NextFunction): void {
  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) throw err;

    db.query('SELECT * FROM v_mesas', (err, result) => {
      const dataResult = result.map((item: any) => ({
        codigo: item.CODIGO,
        comanda: item.MESA,
        subtotal: item.SUBTOTAL,
        total: item.TOTAL,
        status: item.STATUS,
        ordem: item.ORDEM,
      }));
      res.status(200).send(dataResult);
      db.detach();
    });
  });
}

export function post(req: Request, res: Response, next: NextFunction): void {
  res.status(201).send(req.body);
}

export function insereComanda(req: Request, res: Response, next: NextFunction): void {
  const mesa = req.body.mesa;
  const mesaDestino = req.body.mesaDestino;
  const mesaChanged = String(Number(mesa));
  const atende = req.body.codAtendente;

  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) throw err;

    db.query(
      'SELECT oretorno FROM POCKET_INSERT_MESA(?, ?, ?)',
      [atende, mesaChanged, mesaDestino],
      (err, result) => {
        if (err) { res.status(400).send(err); return; }
        const dataResult = result.map((item: any) => ({ oretorno: item.ORETORNO }));
        res.status(200).send(dataResult);
        db.detach();
      }
    );
  });
}

export function del(req: Request, res: Response, next: NextFunction): void {
  res.status(200).send(req.body);
}

export async function fechaConta(req: Request, res: Response): Promise<void> {
  const printGroupId = await getPrintCaixaGroupId();
  let fechouConta = false;
  const { codigo, destino } = req.body;

  if (destino === 'F') {
    fechouConta = await updateStatusConta(codigo);
  }

  await insertImpressaoCaixa(printGroupId, codigo, destino);
  res.status(200).send({ fechouConta });
}

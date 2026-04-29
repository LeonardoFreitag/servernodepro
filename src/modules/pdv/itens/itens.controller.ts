import { Request, Response, NextFunction } from 'express';
import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';

function getConjugaList(codMesa: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Firebird.attach(firebirdOptions, (err, db) => {
      if (err) throw err;
      db.query(
        'select distinct(cod_conjuga) from mesas_itens where cod_mesas_abertas=? and cod_conjuga<>?',
        [codMesa, 0],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
          db.detach();
        }
      );
    });
  });
}

function getCodConjuga(): Promise<any> {
  return new Promise((resolve, reject) => {
    Firebird.attach(firebirdOptions, (err, db) => {
      if (err) throw err;
      db.query(
        'select gen_id(g_cod_conjuga_mesas, 1) as id from rdb$database',
        (err, result) => {
          if (err) reject(err);
          else resolve(result[0].ID);
          db.detach();
        }
      );
    });
  });
}

function getPrintGroupId(): Promise<any> {
  return new Promise((resolve, reject) => {
    Firebird.attach(firebirdOptions, (err, db) => {
      if (err) throw err;
      db.query(
        'select gen_id(g_print_group, 1) as id from rdb$database',
        (err, result) => {
          if (err) reject(err);
          else resolve(result[0].ID);
          db.detach();
        }
      );
    });
  });
}

function queryInTransaction(transaction: any, sql: string, params: any[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    transaction.query(sql, params, (err: any, result: any) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// Insere todos os itens e o registro de impressão em uma única transação atômica.
// O monitor Delphi só enxerga a entrada em `impressoes` após todos os itens
// estarem commitados, eliminando a race condition.
async function insertAllItemsAtomically(
  dataItems: any[],
  printGroupId: any,
  combinadoCodes: Map<number, any>
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Firebird.attach(firebirdOptions, (err, db) => {
      if (err) return reject(err);

      db.transaction(Firebird.ISOLATION_READ_COMMITED, (errt, transaction) => {
        if (errt) { db.detach(); return reject(errt); }

        const execute = async () => {
          const dataRetorno: any[] = [];
          let combinadoIndex = 0;

          for (const item of dataItems) {
            if (item.combinado) {
              const codCombineMesa = combinadoCodes.get(combinadoIndex++);
              for (const flavor of item.flavors) {
                const result = await queryInTransaction(
                  transaction,
                  'SELECT oretorno FROM POCKET_INSERT_PRODUTO_COMBINE(?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [flavor.codMesa, flavor.codProduto, flavor.qtde, flavor.obs, flavor.codAtendente, flavor.destino, flavor.mobileId, printGroupId, codCombineMesa]
                );
                dataRetorno.push({ mobileId: flavor.mobileId, retorno: result[0].ORETORNO });
              }
            } else {
              const result = await queryInTransaction(
                transaction,
                'SELECT oretorno FROM POCKET_INSERT_PRODUTO(?, ?, ?, ?, ?, ?, ?, ?)',
                [item.codMesa, item.codProduto, item.qtde, item.obs, item.codAtendente, item.destino, item.mobileId, printGroupId]
              );
              dataRetorno.push({ mobileId: item.mobileId, retorno: result[0].ORETORNO });
            }
          }

          const codMesa = dataItems[0].codMesa;
          await queryInTransaction(
            transaction,
            'insert into impressoes(id, id_computador, id_origem, origem) values(?, ?, ?, ?)',
            [printGroupId, 'MOBILE', codMesa, 'M']
          );

          return dataRetorno;
        };

        execute()
          .then((dataRetorno) => {
            transaction.commit((errf) => {
              if (errf) { transaction.rollback(); db.detach(); return reject(errf); }
              db.detach();
              resolve(dataRetorno);
            });
          })
          .catch((error) => {
            transaction.rollback();
            db.detach();
            reject(error);
          });
      });
    });
  });
}

export function get(req: Request, res: Response, next: NextFunction): void {
  const codigo = String(req.params.codigo);
  const dataResult: any[] = [];

  getConjugaList(codigo).then((resp) => {
    Firebird.attach(firebirdOptions, (err, db) => {
      if (err) throw err;

      db.query('SELECT * FROM v_itens where codmesa=?', [codigo], (err, result) => {
        resp.forEach((itemCodConjuga: any) => {
          const conjugaFiltered = result.filter(
            (opt: any) => opt.COD_CONJUGA === itemCodConjuga.COD_CONJUGA
          );
          let totalFlavors = 0;
          const flavors = conjugaFiltered.map((flavor: any) => {
            totalFlavors += flavor.TOTAL;
            return {
              mobileId: '',
              codigo: flavor.CODIGO,
              comandaCodigo: flavor.CODMESA,
              fuincionarioCodigo: flavor.CODFUNC,
              produtoCodigo: flavor.CODPROD,
              descricao: flavor.DESCRICAO,
              unidade: flavor.UNIDADE,
              quantidade: flavor.QUANTIDADE,
              unitario: flavor.UNITARIO,
              total: flavor.TOTAL,
              hora: flavor.HORA,
              grupo: flavor.GRUPO,
              subgrupo: flavor.SUBGRUPO,
              impresso: flavor.IMPRESSO,
              obs: flavor.OBS,
              codCombinado: flavor.COD_CONJUGA,
              flavors: [],
            };
          });
          const configItem = flavors[0];
          dataResult.push({
            mobileId: '',
            codigo: configItem.codigo,
            comandaCodigo: configItem.comandaCodigo,
            funcionarioCodigo: configItem.fuincionarioCodigo,
            produtoCodigo: configItem.produtoCodigo,
            descricao: configItem.grupo,
            unidade: configItem.unidade,
            quantidade: 1,
            unitario: configItem.unitario,
            total: totalFlavors,
            hora: configItem.hora,
            grupo: configItem.grupo,
            subgrupo: configItem.subgrupo,
            impresso: configItem.impresso,
            obs: '',
            enviado: 'S',
            combinado: true,
            codCombinado: configItem.codCombinado,
            flavors,
          });
        });

        const dataSimple = result.filter((opt: any) => opt.COD_CONJUGA === 0);
        dataSimple.forEach((item: any) => {
          dataResult.push({
            codigo: item.CODIGO,
            comandaCodigo: item.CODMESA,
            funcionarioCodigo: item.CODFUNC,
            produtoCodigo: item.CODPROD,
            descricao: item.DESCRICAO,
            unidade: item.UNIDADE,
            quantidade: item.QUANTIDADE,
            unitario: item.UNITARIO,
            total: item.TOTAL,
            hora: item.HORA,
            grupo: item.GRUPO,
            subgrupo: item.SUBGRUPO,
            impresso: item.IMPRESSO,
            obs: item.OBS,
            enviado: 'S',
            combinado: false,
            codCombinado: item.COD_CONJUGA,
            flavors: [],
          });
        });

        res.status(200).send(dataResult);
        db.detach();
      });
    });
  });
}

export function post(req: Request, res: Response, next: NextFunction): void {
  res.status(201).send(req.body);
}

export async function put(req: Request, res: Response): Promise<void> {
  const printGroupId = await getPrintGroupId();
  const dataItems: any[] = req.body;

  // Gera os códigos de conjuga antes da transação principal (generators são
  // independentes de transação no Firebird, não precisam estar no mesmo contexto)
  const combinadoCodes = new Map<number, any>();
  let combinadoIndex = 0;
  for (const item of dataItems) {
    if (item.combinado) {
      combinadoCodes.set(combinadoIndex++, await getCodConjuga());
    }
  }

  try {
    await insertAllItemsAtomically(dataItems, printGroupId, combinadoCodes);
    res.status(200).send();
  } catch (error) {
    console.log(error);
    res.status(400).send();
  }
}

export function del(req: Request, res: Response, next: NextFunction): void {
  res.status(200).send(req.body);
}

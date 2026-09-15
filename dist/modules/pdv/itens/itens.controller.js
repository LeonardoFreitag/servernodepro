"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.del = del;
exports.get = get;
exports.post = post;
exports.put = put;
var _nodeFirebird = _interopRequireDefault(require("node-firebird"));
var _firebird = _interopRequireDefault(require("../../../shared/database/firebird"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function getConjugaList(codMesa) {
  return new Promise((resolve, reject) => {
    _nodeFirebird.default.attach(_firebird.default, (err, db) => {
      if (err) throw err;
      db.query('select distinct(cod_conjuga) from mesas_itens where cod_mesas_abertas=? and cod_conjuga<>?', [codMesa, 0], (err, result) => {
        if (err) reject(err);else resolve(result);
        db.detach();
      });
    });
  });
}
function getCodConjuga() {
  return new Promise((resolve, reject) => {
    _nodeFirebird.default.attach(_firebird.default, (err, db) => {
      if (err) throw err;
      db.query('select gen_id(g_cod_conjuga_mesas, 1) as id from rdb$database', (err, result) => {
        if (err) reject(err);else resolve(result[0].ID);
        db.detach();
      });
    });
  });
}
function getPrintGroupId() {
  return new Promise((resolve, reject) => {
    _nodeFirebird.default.attach(_firebird.default, (err, db) => {
      if (err) throw err;
      db.query('select gen_id(g_print_group, 1) as id from rdb$database', (err, result) => {
        if (err) reject(err);else resolve(result[0].ID);
        db.detach();
      });
    });
  });
}
function queryInTransaction(transaction, sql, params) {
  return new Promise((resolve, reject) => {
    transaction.query(sql, params, (err, result) => {
      if (err) reject(err);else resolve(result);
    });
  });
}

// Insere todos os itens e o registro de impressão em uma única transação atômica.
// O monitor Delphi só enxerga a entrada em `impressoes` após todos os itens
// estarem commitados, eliminando a race condition.
async function insertAllItemsAtomically(dataItems, printGroupId, combinadoCodes) {
  return new Promise((resolve, reject) => {
    _nodeFirebird.default.attach(_firebird.default, (err, db) => {
      if (err) return reject(err);
      db.transaction(_nodeFirebird.default.ISOLATION_READ_COMMITED, (errt, transaction) => {
        if (errt) {
          db.detach();
          return reject(errt);
        }
        const execute = async () => {
          const dataRetorno = [];
          let combinadoIndex = 0;
          for (const item of dataItems) {
            if (item.combinado) {
              const codCombineMesa = combinadoCodes.get(combinadoIndex++);
              for (const flavor of item.flavors) {
                const result = await queryInTransaction(transaction, 'SELECT oretorno FROM POCKET_INSERT_PRODUTO_COMBINE(?, ?, ?, ?, ?, ?, ?, ?, ?)', [flavor.codMesa, flavor.codProduto, flavor.qtde, flavor.obs, flavor.codAtendente, flavor.destino, flavor.mobileId, printGroupId, codCombineMesa]);
                dataRetorno.push({
                  mobileId: flavor.mobileId,
                  retorno: result[0].ORETORNO
                });
              }
            } else {
              const result = await queryInTransaction(transaction, 'SELECT oretorno FROM POCKET_INSERT_PRODUTO(?, ?, ?, ?, ?, ?, ?, ?)', [item.codMesa ?? item.comandaCodigo, item.codProduto ?? item.produtoCodigo, item.qtde ?? item.quantidade, item.obs, item.codAtendente ?? item.funcionarioCodigo, item.destino, item.mobileId, printGroupId]);
              dataRetorno.push({
                mobileId: item.mobileId,
                retorno: result[0].ORETORNO
              });
            }
          }
          const firstItem = dataItems[0];
          const codMesa = firstItem.codMesa ?? firstItem.comandaCodigo ?? firstItem.flavors?.[0]?.codMesa;
          await queryInTransaction(transaction, 'insert into impressoes(id, id_computador, id_origem, origem) values(?, ?, ?, ?)', [printGroupId, 'MOBILE', codMesa, 'M']);
          return dataRetorno;
        };
        execute().then(dataRetorno => {
          transaction.commit(errf => {
            if (errf) {
              transaction.rollback();
              db.detach();
              return reject(errf);
            }
            db.detach();
            resolve(dataRetorno);
          });
        }).catch(error => {
          transaction.rollback();
          db.detach();
          reject(error);
        });
      });
    });
  });
}
function get(req, res, next) {
  const codigo = String(req.params.codigo);
  const dataResult = [];
  getConjugaList(codigo).then(resp => {
    _nodeFirebird.default.attach(_firebird.default, (err, db) => {
      if (err) throw err;
      db.query('SELECT * FROM v_itens where codmesa=?', [codigo], (err, result) => {
        resp.forEach(itemCodConjuga => {
          const conjugaFiltered = result.filter(opt => opt.COD_CONJUGA === itemCodConjuga.COD_CONJUGA);
          let totalFlavors = 0;
          let servicoFlavors = 0;
          const flavors = conjugaFiltered.map(flavor => {
            totalFlavors += flavor.TOTAL;
            servicoFlavors += Number(flavor.SERVICO ?? 0);
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
              servico: Number(flavor.SERVICO ?? 0),
              hora: flavor.HORA,
              grupo: flavor.GRUPO,
              subgrupo: flavor.SUBGRUPO,
              impresso: flavor.IMPRESSO,
              obs: flavor.OBS,
              codCombinado: flavor.COD_CONJUGA,
              flavors: []
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
            servico: servicoFlavors,
            hora: configItem.hora,
            grupo: configItem.grupo,
            subgrupo: configItem.subgrupo,
            impresso: configItem.impresso,
            obs: '',
            enviado: 'S',
            combinado: true,
            codCombinado: configItem.codCombinado,
            flavors
          });
        });
        const dataSimple = result.filter(opt => opt.COD_CONJUGA === 0);
        dataSimple.forEach(item => {
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
            servico: Number(item.SERVICO ?? 0),
            hora: item.HORA,
            grupo: item.GRUPO,
            subgrupo: item.SUBGRUPO,
            impresso: item.IMPRESSO,
            obs: item.OBS,
            enviado: 'S',
            combinado: false,
            codCombinado: item.COD_CONJUGA,
            flavors: []
          });
        });
        res.status(200).send(dataResult);
        db.detach();
      });
    });
  });
}
function post(req, res, next) {
  res.status(201).send(req.body);
}
async function put(req, res) {
  const printGroupId = await getPrintGroupId();
  const dataItems = req.body;

  // Gera os códigos de conjuga antes da transação principal (generators são
  // independentes de transação no Firebird, não precisam estar no mesmo contexto)
  const combinadoCodes = new Map();
  let combinadoIndex = 0;
  for (const item of dataItems) {
    if (item.combinado) {
      combinadoCodes.set(combinadoIndex++, await getCodConjuga());
    }
  }
  try {
    const retorno = await insertAllItemsAtomically(dataItems, printGroupId, combinadoCodes);
    res.status(200).send(retorno);
  } catch (error) {
    console.log(error);
    res.status(400).send();
  }
}
function del(req, res, next) {
  res.status(200).send(req.body);
}
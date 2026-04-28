"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.del = del;
exports.get = get;
exports.post = post;
exports.put = put;
var _nodeFirebird = _interopRequireDefault(require("node-firebird"));
var _firebird = _interopRequireDefault(require("../database/firebird"));
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
function insertImpressao(printGroupId, codMesa) {
  return new Promise((resolve, reject) => {
    _nodeFirebird.default.attach(_firebird.default, (err, db) => {
      if (err) throw err;
      db.query('insert into impressoes(id, id_computador, id_origem, origem) values(?, ?, ?, ?)', [printGroupId, 'MOBILE', codMesa, 'M'], (err, result) => {
        if (err) reject(err);else resolve(result);
        db.detach();
      });
    });
  });
}
function insertItem(data, printGroupId) {
  return new Promise((resolve, reject) => {
    _nodeFirebird.default.attach(_firebird.default, (err, db) => {
      if (err) throw err;
      db.transaction(_nodeFirebird.default.ISOLATION_READ_COMMITED, (errt, transaction) => {
        transaction.query('SELECT oretorno FROM POCKET_INSERT_PRODUTO(?, ?, ?, ?, ?, ?, ?, ?)', [data.codMesa, data.codProduto, data.qtde, data.obs, data.codAtendente, data.destino, data.mobileId, printGroupId], (errq, result) => {
          if (errq) {
            transaction.rollback();
            return reject(errq);
          }
          transaction.commit(errf => {
            if (errf) {
              transaction.rollback();
              return reject(errf);
            }
            db.detach();
            resolve(result);
          });
        });
      });
    });
  });
}
function insertItemCombined(data, printGroupId, codCombineMesa) {
  return new Promise((resolve, reject) => {
    _nodeFirebird.default.attach(_firebird.default, (err, db) => {
      if (err) throw err;
      db.transaction(_nodeFirebird.default.ISOLATION_READ_COMMITED, (errt, transaction) => {
        transaction.query('SELECT oretorno FROM POCKET_INSERT_PRODUTO_COMBINE(?, ?, ?, ?, ?, ?, ?, ?, ?)', [data.codMesa, data.codProduto, data.qtde, data.obs, data.codAtendente, data.destino, data.mobileId, printGroupId, codCombineMesa], (errq, result) => {
          if (errq) {
            transaction.rollback();
            return reject(errq);
          }
          transaction.commit(errf => {
            if (errf) {
              transaction.rollback();
              return reject(errf);
            }
            db.detach();
            resolve(result);
          });
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
          const flavors = conjugaFiltered.map(flavor => {
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
  const dataRetorno = [];
  for (let i = 0; i < dataItems.length; ++i) {
    const item = dataItems[i];
    if (item.combinado) {
      const codCombineMesa = await getCodConjuga();
      for (const flavor of item.flavors) {
        try {
          const result = await insertItemCombined(flavor, printGroupId, codCombineMesa);
          dataRetorno.push({
            mobileId: flavor.mobileId,
            retorno: result[0].ORETORNO
          });
        } catch (error) {
          console.log(error);
          res.status(400).send();
          return;
        }
      }
    } else {
      try {
        const result = await insertItem(item, printGroupId);
        dataRetorno.push({
          mobileId: item.mobileId,
          retorno: result[0].ORETORNO
        });
      } catch (error) {
        console.log(error);
        res.status(400).send();
        return;
      }
    }
    if (i === dataItems.length - 1) {
      await insertImpressao(printGroupId, item.codMesa);
      res.status(200).send();
    }
  }
}
function del(req, res, next) {
  res.status(200).send(req.body);
}
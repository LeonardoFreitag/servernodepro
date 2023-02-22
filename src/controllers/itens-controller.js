"use strict";
const Firebird = require("node-firebird");
const config = require("../config");
var options = {};
options.host = config.host;
options.port = 3050;
options.database = config.connectionString;
options.user = "SYSDBA";
options.password = "masterkey";
options.lowercase_keys = false;
options.role = null;
options.pageSize = 4096;

const getConjugaList = (codMesa) => {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, function (err, db) {
      if (err) throw err;
      db.query(
        "select distinct(cod_conjuga) from mesas_itens where cod_mesas_abertas=? and cod_conjuga<>?",
        [codMesa, 0],
        function (err, result) {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
          db.detach();
        }
      );
    });
  });
};

exports.get = (req, res, next) => {
  const codigo = req.params.codigo;
  let dataResult = [];

  getConjugaList(codigo).then((resp) => {
    Firebird.attach(options, function (err, db) {
      if (err) throw err;

      // db = DATABASE
      db.query(
        "SELECT * FROM v_itens where codmesa=?",
        [codigo],
        function (err, result) {
          // IMPORTANT: close the connection
          resp.forEach((itemCodConjuga) => {
            const conjugaFiltered = result.filter(
              (opt) => opt.COD_CONJUGA === itemCodConjuga.COD_CONJUGA
            );
            let totalFlavors = 0;
            const flavors = conjugaFiltered.map((flavor) => {
              totalFlavors = totalFlavors + flavor.TOTAL;
              return {
                mobileId: "",
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
              mobileId: "",
              codigo: configItem.codigo,
              comandaCodigo: configItem.codMesa,
              funcionarioCodigo: configItem.codFunc,
              produtoCodigo: configItem.codProd,
              descricao: configItem.grupo,
              unidade: configItem.unidade,
              quantidade: 1,
              unitario: configItem.unitario,
              total: totalFlavors,
              hora: configItem.hora,
              grupo: configItem.grupo,
              subgrupo: configItem.subgrupo,
              impresso: configItem.impresso,
              obs: "",
              enviado: "S",
              combinado: true,
              codCombinado: configItem.cod_conjuga,
              flavors: flavors,
            });
          });
          const dataSimple = result.filter((opt) => opt.COD_CONJUGA === 0);
          const dataSimpleLowerCase = dataSimple.map((item) => {
            return {
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
              enviado: "S",
              combinado: false,
              codCombinado: item.COD_CONJUGA,
              flavors: [],
            };
          });
          dataSimpleLowerCase.forEach((dataSimpleItem) => {
            dataResult.push(dataSimpleItem);
          });
          res.status(200).send(dataResult);
          db.detach();
        }
      );
    });
  });
};

exports.post = (req, res, next) => {
  res.status(201).send(req.body);
};

const getCodConjuga = () => {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, function (err, db) {
      if (err) throw err;
      db.query(
        "select gen_id(g_cod_conjuga_mesas, 1) as id from rdb$database",
        function (err, result) {
          if (err) {
            reject(err);
          } else {
            resolve(result[0].ID);
          }
          db.detach();
        }
      );
    });
  });
};

const getPrintGroupId = () => {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, function (err, db) {
      if (err) throw err;
      db.query(
        "select gen_id(g_print_group, 1) as id from rdb$database",
        function (err, result) {
          if (err) {
            reject(err);
          } else {
            resolve(result[0].ID);
          }
          db.detach();
        }
      );
    });
  });
};

const insertImpressao = (printGroupId, codMesa) => {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, function (err, db) {
      if (err) throw err;
      db.query(
        "insert into impressoes(id, id_computador, id_origem, origem) values(?, ?, ?, ?)",
        [printGroupId, "MOBILE", codMesa, "M"],
        function (err, result) {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
          db.detach();
        }
      );
    });
  });
};

const insertItem = (data, printGroupId) => {
  return new Promise((resolve, reject) => {
    const codMesa = data.codMesa;
    const codProduto = data.codProduto;
    const qtde = data.qtde;
    const obs = data.obs;
    const atende = data.codAtendente;
    const destino = data.destino;
    const mobileId = data.mobileId;
    const printGroup = printGroupId;

    Firebird.attach(options, function (err1, db) {
      if (err1) throw err1;

      // db = DATABASE
      db.transaction(
        Firebird.ISOLATION_READ_COMMITED,
        function (errt, transaction) {
          transaction.query(
            "SELECT oretorno FROM POCKET_INSERT_PRODUTO(?, ?, ?, ?, ?, ?, ?, ?)",
            [
              codMesa,
              codProduto,
              qtde,
              obs,
              atende,
              destino,
              mobileId,
              printGroup,
            ],
            function (errq, result) {
              if (errq) {
                transaction.rollback();
                reject(errq);
                return;
              }

              transaction.commit(function (errf) {
                if (errf) {
                  transaction.rollback();
                  reject(errf);
                } else {
                  db.detach();
                  resolve(result);
                }
              });
            }
          );
        }
      );
    });
  });
};

const insertItemCombined = (data, printGroupId, codCombineMesa) => {
  return new Promise((resolve, reject) => {
    const codMesa = data.codMesa;
    const codProduto = data.codProduto;
    const qtde = data.qtde;
    const obs = data.obs;
    const atende = data.codAtendente;
    const destino = data.destino;
    const mobileId = data.mobileId;
    const printGroup = printGroupId;
    const codCombined = codCombineMesa;

    Firebird.attach(options, function (err1, db) {
      if (err1) throw err1;

      // db = DATABASE
      db.transaction(
        Firebird.ISOLATION_READ_COMMITED,
        function (errt, transaction) {
          transaction.query(
            "SELECT oretorno FROM POCKET_INSERT_PRODUTO_COMBINE(?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              codMesa,
              codProduto,
              qtde,
              obs,
              atende,
              destino,
              mobileId,
              printGroup,
              codCombined,
            ],
            function (errq, result) {
              if (errq) {
                transaction.rollback();
                reject(errq);
                return;
              }

              transaction.commit(function (errf) {
                if (errf) {
                  transaction.rollback();
                  reject(errf);
                } else {
                  db.detach();
                  resolve(result);
                }
              });
            }
          );
        }
      );
    });
  });
};

// exports.put = (req, res) => {
//   getPrintGroupId().then(async (printGroupId) => {
//     const dataItems = req.body;
//     const dataRetorno = [];
//     dataItems.forEach(async (item, index) => {
//       if (item.combinado) {
//         getCodConjuga().then(async (codCombineMesa) => {
//           item.flavors.forEach(async (flavor) => {
//             insertItemCombined(flavor, printGroupId, codCombineMesa)
//               .then(async (result) => {
//                 const { ORETORNO } = result[0];
//                 dataRetorno.push({
//                   mobileId: flavor.mobileId,
//                   retorno: ORETORNO,
//                 });
//               })
//               .catch((error) => {
//                 console.log(error);
//                 res.status(400).send();
//               });
//           });
//         });
//       } else {
//         insertItem(item, printGroupId)
//           .then((result) => {
//             console.log("inseriu item ", item);
//             const { ORETORNO } = result[0];
//             dataRetorno.push({
//               mobileId: item.mobileId,
//               retorno: ORETORNO,
//             });
//           })
//           .catch((error) => {
//             console.log(error);
//             res.status(400).send();
//           });
//       }
//       if (index === dataItems.length - 1) {
//         insertImpressao(printGroupId, item.codMesa).then(() => {
//           res.status(200).send();
//         });
//       }
//     });
//   });
// };

exports.put = (req, res) => {
  getPrintGroupId().then(async (printGroupId) => {
    const dataItems = req.body;
    const dataRetorno = [];
    for (let i = 0; i < dataItems.length; ++i) {
      const item = dataItems[i];
      if (item.combinado) {
        getCodConjuga().then(async (codCombineMesa) => {
          for (let j = 0; j < item.flavors.length; ++j) {
            const flavor = item.flavors[j];
            insertItemCombined(flavor, printGroupId, codCombineMesa)
              .then(async (result) => {
                const { ORETORNO } = result[0];
                dataRetorno.push({
                  mobileId: flavor.mobileId,
                  retorno: ORETORNO,
                });
              })
              .catch((error) => {
                console.log(error);
                res.status(400).send();
              });
          }
        });
      } else {
        insertItem(item, printGroupId)
          .then((result) => {
            const { ORETORNO } = result[0];
            dataRetorno.push({
              mobileId: item.mobileId,
              retorno: ORETORNO,
            });
          })
          .catch((error) => {
            console.log(error);
            res.status(400).send();
          });
      }
      if (i === dataItems.length - 1) {
        insertImpressao(printGroupId, item.codMesa).then(() => {
          res.status(200).send();
        });
      }
    }
  });
};

exports.insertItens = (req, res) => {
  getPrintGroupId((printGroupId) => {
    const data = req.body.data;

    data.array.forEach((item) => {
      let codMesa = item.codMesa;
      let codProduto = item.codProduto;
      let qtde = item.qtde;
      let obs = item.obs;
      let atende = item.codAtendente;
      let codCombine = item.codCombine;
      let destino = item.destino;
      if (Number(codCombine) !== 0) {
        Firebird.attach(options, function (err1, db) {
          if (err1) throw err1;

          // db = DATABASE
          db.transaction(
            Firebird.ISOLATION_READ_COMMITED,
            function (errt, transaction) {
              transaction.query(
                "SELECT oretorno FROM POCKET_INSERT_PRODUTO_COMBINE(?, ?, ?, ?, ?, ?, ?)",
                [codMesa, codProduto, qtde, obs, atende, codCombine, destino],
                function (errq, result) {
                  if (errq) {
                    transaction.rollback();
                    return;
                  }

                  transaction.commit(function (errf) {
                    if (errf) {
                      transaction.rollback();
                      res.status(400).send(err);
                    } else {
                      db.detach();
                      res.status(200).send(result);
                    }
                  });
                }
              );
            }
          );
        });
      } else {
        Firebird.attach(options, function (err1, db) {
          if (err1) throw err1;

          // db = DATABASE
          db.transaction(
            Firebird.ISOLATION_READ_COMMITED,
            function (errt, transaction) {
              transaction.query(
                "SELECT oretorno FROM POCKET_INSERT_PRODUTO_COMBINE(?, ?, ?, ?, ?, ?, ?)",
                [codMesa, codProduto, qtde, obs, atende, codCombine, destino],
                function (errq, result) {
                  if (errq) {
                    transaction.rollback();
                    return;
                  }

                  transaction.commit(function (errf) {
                    if (errf) {
                      transaction.rollback();
                      res.status(400).send(err);
                    } else {
                      db.detach();
                      res.status(200).send(result);
                    }
                  });
                }
              );
            }
          );
        });
      }
    });
  });
};

exports.delete = (req, res, next) => {
  res.status(200).send(req.body);
};

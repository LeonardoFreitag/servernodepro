"use strict";
const Firebird = require("node-firebird");
const config = require("../config");
const rm = require("../utils/removeEmoji");
var options = {};
options.host = config.host;
options.port = 3050;
options.database = config.connectionString;
options.user = "SYSDBA";
options.password = "masterkey";
options.lowercase_keys = false;
options.role = null;
options.pageSize = 4096;

const firebase = require("../services/firebaseConfig");

const fb = firebase.firebase;

const date = require("date-and-time");

exports.getNewRequests = (idProvider) => {
  fb.firestore()
    .collection("requests")
    .where("idProvider", "==", idProvider)
    .where("read", "==", false)
    .get()
    .then((result) => {
      result.forEach((item) => {
        handleSave(item);
      });
    })
    .catch((erro) => {
      console.log(erro);
    });
};

const handleSave = function (req) {
  saveRequest(req, function (idRequest) {
    let items = req.data().items;
    items.forEach((prod) => {
      if (prod.combined === "S") {
        const codeCombined = Math.floor(Math.random() * (100000 - 1) + 1);
        prod.flavors.forEach((flavor) => {
          let f = {
            id: codeCombined,
            idRequest: flavor.idRequest,
            code: flavor.code,
            description: `${flavor.description} ${flavor.edge}`,
            unity: flavor.unity,
            amount: flavor.amount.toFixed(3),
            price: flavor.price + flavor.priceEdge,
            total: flavor.totalFlavor + flavor.totalEdge,
            comments: flavor.comments,
            conjuga: codeCombined,
            idEntrega: idRequest,
          };
          saveFlavors(f, idRequest, function (ok) {
            console.log("insert flavor " + ok);
          });
        });
      } else {
        saveItems(prod, idRequest, function (ok) {
          console.log("insert item " + ok);
        });
      }
    });
  });
};

const saveRequest = (request, callback) => {
  console.log(request.data());
  let data = request.data();
  let comeGet = "";
  if (data.comeGet) {
    comeGet = "S";
  } else {
    comeGet = "N";
  }

  let newDate = date
    .format(new Date(data.dateRequest), "DD/MM/YYYY")
    .toString();

  // d_streetname, d_streetnumber, d_neighborhood, d_complement,
  // d_latitude, d_longitude, d_zipcode, d_city, d_state
  Firebird.attach(options, function (err, db) {
    if (err) throw err;
    db.query(
      "SELECT oretorno FROM WEB_ENTREGA(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        data.id,
        data.idCustomer,
        data.idProvider,
        newDate,
        data.totalProducts,
        data.feeDelivery,
        data.totalRequest,
        data.status,
        rm.remove(data.address),
        rm.remove(data.dataCustomer.number),
        data.neigh,
        data.idNeigh,
        rm.remove(data.complement),
        data.formPayment,
        data.dataCustomer.whats,
        rm.remove(data.dataCustomer.name),
        rm.remove(data.comments),
        comeGet,
        data.change,
        rm.remove(data.dataCustomer.address),
        rm.remove(data.dataCustomer.number),
        data.dataCustomer.neigh,
        rm.remove(data.dataCustomer.complement),
        data.dataCustomer.latitude,
        data.dataCustomer.longitude,
        rm.remove(data.dataCustomer.zipcode),
        rm.remove(data.dataCustomer.city),
        data.dataCustomer.state,
      ],
      function (err, result) {
        if (err) {
          console.log("save request " + err);
        } else {
          callback(result[0].ORETORNO);
          fb.firestore().collection("requests").doc(data.id).update({
            read: true,
          });
        }
        db.detach();
      }
    );
  });
};

const saveFlavors = (request, idRequest, callback) => {
  let flavor = request;
  // console.log('Insert flavor ' + flavor.description);
  // console.log(flavor);

  Firebird.attach(options, function (err1, db) {
    if (err1) throw err1;

    // db = DATABASE
    db.transaction(
      Firebird.ISOLATION_READ_COMMITED,
      function (errt, transaction) {
        db.query(
          "SELECT oretorno FROM WEB_ITEMS_COMBINED(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            flavor.id,
            flavor.idRequest,
            flavor.code,
            flavor.description,
            flavor.unity,
            flavor.amount,
            flavor.price,
            flavor.total,
            rm.remove(flavor.comments),
            flavor.idEntrega,
            flavor.conjuga,
          ],
          function (errq, result) {
            if (errq) {
              transaction.rollback();
              callback("0");
            }
            transaction.commit(function (errf) {
              if (errf) {
                transaction.rollback();
                callback("0");
              } else {
                db.detach();
                callback(result[0].ORETORNO);
              }
            });
          }
        );
      }
    );
  });
};

const saveItems = (request, idRequest, callback) => {
  let data = request;
  let dataId = data.id;
  let dataIdRequest = data.idRequest;
  let dataCode = data.code;
  let dataDescription = data.description;
  let dataUnity = data.unity;
  let dataAmount = parseFloat(data.amount);
  let dataPrice = parseFloat(data.price);
  let dataTotal = parseFloat(data.total);
  let dataComments = data.comments;
  // console.log("Insert item " + data.description);

  Firebird.attach(options, function (err1, db) {
    if (err1) throw err1;

    // db = DATABASE
    db.transaction(
      Firebird.ISOLATION_READ_COMMITED,
      function (errt, transaction) {
        transaction.query(
          "SELECT oretorno FROM WEB_ITEMS(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            dataId,
            dataIdRequest,
            dataCode,
            dataDescription,
            dataUnity,
            dataAmount,
            dataPrice,
            dataTotal,
            rm.remove(dataComments),
            idRequest,
          ],
          function (errq, result) {
            if (errq) {
              transaction.rollback();
              // console.log("save itens " + errq);
              callback("0");
            }
            transaction.commit(function (errf) {
              if (errf) {
                console.log(errf);
                transaction.rollback();
                callback("0");
              } else {
                console.log("retorno do firebird");
                callback(result[0].ORETORNO);
              }
            });
            db.detach();
          }
        );
      }
    );
  });
};

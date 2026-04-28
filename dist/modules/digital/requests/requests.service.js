"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getNewRequests = getNewRequests;
var _nodeFirebird = _interopRequireDefault(require("node-firebird"));
var _firebird = _interopRequireDefault(require("../../../shared/database/firebird"));
var _firebase = require("../../../shared/firebase/firebase.config");
var rm = _interopRequireWildcard(require("../../../shared/utils/removeEmoji"));
var _dateAndTime = _interopRequireDefault(require("date-and-time"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const fb = _firebase.firebase;
function getNewRequests(idProvider) {
  fb.firestore().collection('requests').where('idProvider', '==', idProvider).where('read', '==', false).get().then(result => {
    result.forEach(item => handleSave(item));
  }).catch(erro => console.log(erro));
}
function handleSave(req) {
  saveRequest(req, idRequest => {
    const items = req.data().items;
    items.forEach(prod => {
      if (prod.combined === 'S') {
        const codeCombined = Math.floor(Math.random() * (100000 - 1) + 1);
        prod.flavors.forEach(flavor => {
          const f = {
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
            idEntrega: idRequest
          };
          saveFlavors(f, idRequest, ok => console.log('insert flavor ' + ok));
        });
      } else {
        saveItems(prod, idRequest, ok => console.log('insert item ' + ok));
      }
    });
  });
}
function saveRequest(request, callback) {
  const data = request.data();
  const comeGet = data.comeGet ? 'S' : 'N';
  const newDate = _dateAndTime.default.format(new Date(data.dateRequest), 'DD/MM/YYYY').toString();
  _nodeFirebird.default.attach(_firebird.default, (err, db) => {
    if (err) throw err;
    db.query('SELECT oretorno FROM WEB_ENTREGA(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [data.id, data.idCustomer, data.idProvider, newDate, data.totalProducts, data.feeDelivery, data.totalRequest, data.status, rm.remove(data.address), rm.remove(data.dataCustomer.number), data.neigh, data.idNeigh, rm.remove(data.complement), data.formPayment, data.dataCustomer.whats, rm.remove(data.dataCustomer.name), rm.remove(data.comments), comeGet, data.change, rm.remove(data.dataCustomer.address), rm.remove(data.dataCustomer.number), data.dataCustomer.neigh, rm.remove(data.dataCustomer.complement), data.dataCustomer.latitude, data.dataCustomer.longitude, rm.remove(data.dataCustomer.zipcode), rm.remove(data.dataCustomer.city), data.dataCustomer.state], (err, result) => {
      if (err) {
        console.log('save request ' + err);
      } else {
        callback(result[0].ORETORNO);
        fb.firestore().collection('requests').doc(data.id).update({
          read: true
        });
      }
      db.detach();
    });
  });
}
function saveFlavors(flavor, idRequest, callback) {
  _nodeFirebird.default.attach(_firebird.default, (err, db) => {
    if (err) throw err;
    db.transaction(_nodeFirebird.default.ISOLATION_READ_COMMITED, (errt, transaction) => {
      db.query('SELECT oretorno FROM WEB_ITEMS_COMBINED(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [flavor.id, flavor.idRequest, flavor.code, flavor.description, flavor.unity, flavor.amount, flavor.price, flavor.total, rm.remove(flavor.comments), flavor.idEntrega, flavor.conjuga], (errq, result) => {
        if (errq) {
          transaction.rollback();
          return callback('0');
        }
        transaction.commit(errf => {
          if (errf) {
            transaction.rollback();
            callback('0');
          } else {
            db.detach();
            callback(result[0].ORETORNO);
          }
        });
      });
    });
  });
}
function saveItems(item, idRequest, callback) {
  _nodeFirebird.default.attach(_firebird.default, (err, db) => {
    if (err) throw err;
    db.transaction(_nodeFirebird.default.ISOLATION_READ_COMMITED, (errt, transaction) => {
      transaction.query('SELECT oretorno FROM WEB_ITEMS(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [item.id, item.idRequest, item.code, item.description, item.unity, parseFloat(String(item.amount)), parseFloat(String(item.price)), parseFloat(String(item.total)), rm.remove(item.comments), idRequest], (errq, result) => {
        if (errq) {
          transaction.rollback();
          return callback('0');
        }
        transaction.commit(errf => {
          if (errf) {
            console.log(errf);
            transaction.rollback();
            callback('0');
          } else {
            console.log('retorno do firebird');
            callback(result[0].ORETORNO);
          }
        });
        db.detach();
      });
    });
  });
}
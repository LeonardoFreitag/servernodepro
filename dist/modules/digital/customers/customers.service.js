"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getNewCustomers = getNewCustomers;
var _nodeFirebird = _interopRequireDefault(require("node-firebird"));
var _firebird = _interopRequireDefault(require("../../../shared/database/firebird"));
var _firebase = require("../../../shared/firebase/firebase.config");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const fb = _firebase.firebase;
function getNewCustomers(idProvider) {
  fb.firestore().collection('customers').where('idProvider', '==', idProvider).where('read', '==', false).get().then(result => {
    result.forEach(item => saveCustomer(item.data()));
  }).catch(erro => console.log(erro));
}
function saveCustomer(customer) {
  const data = customer;
  _nodeFirebird.default.attach(_firebird.default, (err, db) => {
    if (err) throw err;
    db.query('SELECT oretorno FROM WEB_CLIENTES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [data.id, data.email, data.password, data.name, data.cpf, data.zipcode, data.address, data.number, data.neigh, data.feeDelivery, data.complement, data.city, data.uf, data.ibge, data.whats, data.comments], (err, result) => {
      if (err) console.log('erro cadastro ' + err);else console.log(result);
      db.detach();
    });
  });
  fb.firestore().collection('customers').doc(data.id).update({
    read: true
  });
}
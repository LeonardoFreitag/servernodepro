"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.del = del;
exports.get = get;
exports.post = post;
exports.put = put;
var _firebaseConfig = require("../services/firebaseConfig");
const fb = _firebaseConfig.firebase;
function get(req, res, next) {
  const idProvider = req.body.idProvider;
  if (!idProvider) {
    throw new Error('Id Provider is required!');
  }
  const products = [];
  fb.firestore().collection('products').where('idProvider', '==', idProvider).orderBy('description').get().then(result => {
    result.forEach(item => {
      const d = item.data();
      products.push({
        id: d.id,
        idProvider: d.idProvider,
        code: d.code,
        description: d.description,
        unity: d.unity,
        group: d.group,
        subgroup: d.subgroup,
        price: d.price,
        active: d.active,
        fractioned: d.fractioned,
        fractions: d.fractions,
        edge: d.edge,
        additional: d.additional,
        portionSize: d.portionSize
      });
    });
    res.status(200).send(products);
  });
}
function post(req, res, next) {
  res.status(201).send();
}
function put(req, res, next) {
  res.status(201).send();
}
function del(req, res, next) {
  res.status(200).send();
}
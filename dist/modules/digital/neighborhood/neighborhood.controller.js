"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.del = del;
exports.get = get;
exports.post = post;
exports.put = put;
var _firebase = require("../../../shared/firebase/firebase.config");
const fb = _firebase.firebase;
function get(req, res, next) {
  res.status(200).send([]);
}
async function post(req, res, next) {
  const data = req.body;
  const id = data.id || fb.firestore().collection('neighborhood').doc().id;
  let user = fb.auth().currentUser;
  const payload = {
    idProvider: data.idProvider,
    id,
    code: data.code,
    name: data.name,
    feeDelivery: data.feeDelivery,
    city: data.city,
    uf: data.uf,
    ibge: data.ibge,
    active: data.active
  };
  const save = () => fb.firestore().collection('neighborhood').doc(id).set(payload).then(() => res.status(201).send({
    id
  })).catch(erro => {
    res.status(400).send(erro);
    console.log(erro);
  });
  if (user == null) {
    await fb.auth().signInWithEmailAndPassword(data.email, data.password);
    save();
  } else {
    save();
  }
}
function put(req, res, next) {
  res.status(201).send({
    id: req.params.id,
    title: req.body.title,
    cost: req.body.cost
  });
}
function del(req, res, next) {
  res.status(200).send(req.body);
}
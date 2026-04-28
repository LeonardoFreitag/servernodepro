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
  let user = fb.auth().currentUser;
  const save = () => {
    const ref = fb.firestore().collection('formPayment').doc();
    ref.set({
      idProvider: data.idProvider,
      id: ref.id,
      code: data.code,
      formPayment: data.formPayment,
      change: data.change
    }).then(() => res.status(201).send({
      id: ref.id
    })).catch(erro => {
      res.status(400).send(erro);
      console.log(erro);
    });
  };
  if (user == null) {
    await fb.auth().signInWithEmailAndPassword(data.email, data.password);
    save();
  } else {
    save();
  }
}
async function put(req, res, next) {
  const data = req.body;
  let user = fb.auth().currentUser;
  const deleteAll = () => fb.firestore().collection('formPayment').orderBy('formPayment').where('idProvider', '==', data.idProvider).get().then(async result => {
    const allForms = [];
    result.forEach(item => allForms.push(item.data()));
    for (const d of allForms) {
      await fb.firestore().collection('formPayment').doc(d.id).delete();
    }
    res.status(200).send({
      status: 'ok'
    });
  }).catch(erro => res.status(400).send(erro.code));
  if (user == null) {
    fb.auth().signInWithEmailAndPassword(data.email, data.password).then(deleteAll).catch(erro => res.status(400).send(erro.code));
  } else {
    deleteAll();
  }
}
function del(req, res, next) {
  res.status(200).send();
}
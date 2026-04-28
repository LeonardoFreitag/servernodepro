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
  const data = req.body;
  fb.auth().signInWithEmailAndPassword(data.email, data.password).then(() => {
    const uid = fb.auth().currentUser?.uid;
    res.status(200).send({
      id: uid
    });
  }).catch(erro => {
    res.status(400).send({
      id: erro.code
    });
  });
}
function post(req, res, next) {
  const data = req.body;
  const providerPayload = {
    id: '',
    name: data.name,
    fantasy: data.fantasy,
    cnpj: data.cnpj,
    phone: data.phone,
    cellphone: data.cellphone,
    email: data.email,
    password: data.password,
    logo: data.logo,
    feeDelivery: data.feeDelivery,
    ray: data.ray,
    feeDeliveryMode: data.feeDeliveryMode,
    singleEdge: data.singleEdge
  };
  if (data.id === '0' || data.id == null) {
    fb.auth().createUserWithEmailAndPassword(data.email, data.password).then(() => {
      const uid = fb.auth().currentUser.uid;
      fb.firestore().collection('providers').doc(uid).set({
        ...providerPayload,
        id: uid
      }).then(() => res.status(200).send({
        id: uid
      })).catch(erro => {
        res.status(400).send(erro.code);
        console.log(erro);
      });
    }).catch(erro => {
      res.status(400).send(erro.code);
      console.log(erro);
    });
  } else {
    fb.auth().signInWithEmailAndPassword(data.email, data.password).then(() => {
      fb.firestore().collection('providers').doc(data.id).set({
        ...providerPayload,
        id: data.id
      }).then(() => res.status(200).send({
        id: data.id
      })).catch(erro => {
        res.status(400).send(erro);
        console.log(erro);
      });
    }).catch(erro => {
      res.status(400).send(erro);
      console.log(erro);
    });
  }
}
function put(req, res, next) {
  const data = req.body;
  fb.auth().signInWithEmailAndPassword(data.email, data.password).then(() => {
    fb.firestore().collection('providers').doc(data.id).update({
      open: data.open
    }).then(() => res.status(200).send({
      id: data.id
    })).catch(erro => {
      res.status(400).send(erro);
      console.log(erro);
    });
  }).catch(erro => res.status(400).send(erro));
}
function del(req, res, next) {
  res.status(200).send();
}
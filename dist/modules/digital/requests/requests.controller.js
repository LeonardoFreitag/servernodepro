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
function post(req, res, next) {
  const data = req.body;
  fb.firestore().collection('requests').doc(data.id).update({
    ticket: data.file
  }).then(() => res.status(200).send(data)).catch(erro => res.status(400).send({
    erro: erro.code
  }));
}
function put(req, res, next) {
  const data = req.body;
  fb.firestore().collection('requests').doc(data.id).update({
    status: data.status,
    reason: data.reason
  }).then(() => res.status(200).send(data)).catch(erro => res.status(400).send({
    erro: erro.code
  }));
}
function del(req, res, next) {
  res.status(200).send([]);
}
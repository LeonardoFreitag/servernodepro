'use strict';

const firebase = require("../services/firebaseConfig");

const fb = firebase.firebase;

exports.get = (req, res, next) => {
  res.status(200).send(res);
};

exports.post = (req, res, next) => {
  let data = req.body;
  fb.firestore().collection("requests").doc(data.id).update({
    ticket: data.file
  }).then(() => {
    res.status(200).send(data);
  }).catch(erro => {
    res.status(400).send({
      erro: erro.code
    });
  });
};

exports.put = (req, res, next) => {
  let data = req.body;
  fb.firestore().collection("requests").doc(data.id).update({
    status: data.status,
    reason: data.reason
  }).then(() => {
    res.status(200).send(data);
  }).catch(erro => {
    res.status(400).send({
      erro: erro.code
    });
  });
};

exports.delete = (req, res, next) => {
  res.status(200).send(res);
};
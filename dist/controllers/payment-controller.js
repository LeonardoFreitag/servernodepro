'use strict';

const firebase = require("../services/firebaseConfig");

const fb = firebase.firebase;

exports.get = (req, res, next) => {};

exports.post = (req, res, next) => {
  let data = req.body;
  let user = fb.auth().currentUser;

  if (user == null) {
    fb.auth().signInWithEmailAndPassword(data.email, data.password).then(async () => {
      user = fb.auth().currentUser;
      let ref = fb.firestore().collection("formPayment").doc();
      ref.set({
        idProvider: data.idProvider,
        id: ref.id,
        code: data.code,
        formPayment: data.formPayment,
        change: data.change
      }).then(() => {
        let r = {
          id: ref.id
        };
        res.status(201).send(r);
      }).catch(erro => {
        res.status(400).send(erro);
        console.log(erro);
      });
    });
  } else {
    user = fb.auth().currentUser;
    let ref = fb.firestore().collection("formPayment").doc();
    ref.set({
      idProvider: data.idProvider,
      id: ref.id,
      code: data.code,
      formPayment: data.formPayment,
      change: data.change
    }).then(() => {
      let r = {
        id: ref.id
      };
      res.status(201).send(r);
    }).catch(erro => {
      res.status(400).send(erro);
      console.log(erro);
    });
  }
};

exports.put = (req, res, next) => {
  let data = req.body;
  console.log(data);
  let user = fb.auth().currentUser;

  if (user == null) {
    fb.auth().signInWithEmailAndPassword(data.email, data.password).then(async () => {
      // faz a leitura da coleção
      let allFoms = [];
      fb.firestore().collection("formPayment").orderBy("formPayment").where("idProvider", "==", data.idProvider).get().then(async result => {
        result.forEach(item => {
          allFoms.push(item.data());
        });
        allFoms.forEach(async d => {
          await fb.firestore().collection("formPayment").doc(d.id).delete();
        });
        res.status(200).send({
          status: 'ok'
        });
      });
    }).catch(erro => {
      res.status(400).send(erro.code);
    });
  } else {
    let allFoms = [];
    fb.firestore().collection("formPayment").orderBy("formPayment").where("idProvider", "==", data.idProvider).get().then(async result => {
      result.forEach(item => {
        allFoms.push(item.data());
      });
      allFoms.forEach(async d => {
        await fb.firestore().collection("formPayment").doc(d.id).delete();
      });
      res.status(200).send({
        status: 'ok'
      });
    }).catch(erro => {
      res.status(400).send(erro.code);
    });
  }
};

exports.delete = (req, res, next) => {};
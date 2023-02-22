'use strict';

const firebase = require("../services/firebaseConfig");

const fb = firebase.firebase;

exports.get = (req, res, next) => {};

exports.post = (req, res, next) => {
  let data = req.body; // console.log(data);

  let id = '';

  if (data.id == '' || data.id == null) {
    let ref = fb.firestore().collection('products').doc();
    id = ref.id;
  } else {
    id = data.id;
  }

  let user = fb.auth().currentUser;

  if (user == null) {
    fb.auth().signInWithEmailAndPassword(data.email, data.password).then(async () => {
      user = fb.auth().currentUser;
      fb.firestore().collection('neighborhood').doc(id).set({
        idProvider: data.idProvider,
        id: id,
        code: data.code,
        name: data.name,
        feeDelivery: data.feeDelivery,
        city: data.city,
        uf: data.uf,
        ibge: data.ibge,
        active: data.active
      }).then(() => {
        let r = {
          id: id
        };
        res.status(201).send(r);
      }).catch(erro => {
        res.status(400).send(erro);
        console.log(erro);
      });
    });
  } else {
    fb.firestore().collection('neighborhood').doc(id).set({
      idProvider: data.idProvider,
      id: id,
      code: data.code,
      name: data.name,
      feeDelivery: data.feeDelivery,
      city: data.city,
      uf: data.uf,
      ibge: data.ibge,
      active: data.active
    }).then(() => {
      let r = {
        id: id
      };
      res.status(201).send(r);
    }).catch(erro => {
      res.status(400).send(erro);
      console.log(erro);
    });
  }
};

exports.put = (req, res, next) => {
  const id = req.params.id;
  let result = {
    id: id,
    title: req.body.title,
    cost: req.body.cost
  };
  res.status(201).send(result);
};

exports.delete = (req, res, next) => {
  res.status(200).send(req.body);
};
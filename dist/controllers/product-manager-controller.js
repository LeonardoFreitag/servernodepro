"use strict";

const firebase = require("../services/firebaseConfig");

const fb = firebase.firebase;

exports.get = (req, res, next) => {
  const idProvider = req.body.idProvider;

  if (!idProvider) {
    throw new Error('Id Provider is required!');
  }

  let products = [];
  fb.firestore().collection('products').where('idProvider', '==', idProvider).orderBy('description').get().then(result => {
    result.forEach(item => {
      let p = {
        id: item.data().id,
        idProvider: item.data().idProvider,
        code: item.data().code,
        description: item.data().description,
        unity: item.data().unity,
        group: item.data().group,
        subgroup: item.data().subgroup,
        price: item.data().price,
        active: item.data().active,
        fractioned: item.data().fractioned,
        fractions: item.data().fractions,
        edge: item.data().edge,
        additional: item.data().additional,
        portionSize: item.data().portionSize
      };
      products.push(p);
    }); // delete products.web_img_64;

    res.status(200).send(products);
  });
};

exports.post = (req, res, next) => {};

exports.put = (req, res, next) => {};

exports.delete = (req, res, next) => {};
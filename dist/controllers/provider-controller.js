'use strict';

const firebase = require("../services/firebaseConfig");

const fb = firebase.firebase;

exports.get = (req, res, next) => {
  let data = req.body;
  let code = 200;
  fb.auth().signInWithEmailAndPassword(data.email, data.password).then(() => {
    let uid = fb.auth().currentUser.id;
    resp = {
      id: uid
    };
    code = 200;
  }).catch(erro => {
    resp = {
      id: erro.code
    };
    code = 400;
  });
  res.status(code).send(resp);
};

exports.post = (req, res, next) => {
  console.log('chamou a requisição');
  let data = req.body;
  let resp = {};
  let code = 200; // console.log(data);

  if (data.id == '0' || data.id == null) {
    // registra provider
    // cadastra na tavela de providers
    // retorno o id
    fb.auth().createUserWithEmailAndPassword(data.email, data.password).then(() => {
      let uid = fb.auth().currentUser.uid;
      fb.firestore().collection('providers').doc(uid).set({
        id: uid,
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
      }).then(() => {
        console.log(uid);
        resp = {
          id: uid
        };
        code = 200;
        res.status(code).send(resp);
      }).catch(erro => {
        code = 400;
        console.log(erro);
        res.status(code).send(erro.code);
      });
    }).catch(erro => {
      resp = {
        id: null
      };
      code = 400;
      console.log(erro);
      res.status(code).send(erro.code);
    });
  } else {
    // faz o cadastro de login e na tabela providers
    // console.log(data.email + '/' + data.password)
    fb.auth().signInWithEmailAndPassword(data.email, data.password).then(() => {
      // let uid = fb.auth().currentUser.id;
      // console.log(fb.auth().currentUser);
      fb.firestore().collection('providers').doc(data.id).set({
        id: data.id,
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
      }).then(() => {
        resp = {
          id: data.id
        };
        code = 200;
        res.status(code).send(resp);
      }).catch(erro => {
        code = 400;
        console.log(erro);
        res.status(code).send(erro);
      });
    }).catch(erro => {
      resp = {
        id: null
      };
      code = 400;
      console.log(erro);
      res.status(code).send(erro);
    });
  }
};

exports.put = (req, res, next) => {
  let data = req.body;
  let code = 0;
  let resp = {}; // console.log(data);
  // let user = fb.auth.currentUser;
  // console.log(user);

  fb.auth().signInWithEmailAndPassword(data.email, data.password).then(() => {
    // console.log('fez o login');
    // let uid = fb.auth().currentUser.id;
    // console.log(fb.auth().currentUser);
    fb.firestore().collection('providers').doc(data.id).update({
      open: data.open
    }).then(() => {
      resp = {
        id: data.id
      };
      code = 200;
      console.log('tudo certo');
      res.status(code).send(resp);
    }).catch(erro => {
      code = 400; // console.log(erro);

      console.log(erro);
      res.status(code).send(erro);
    });
  }).catch(erro => {
    resp = {
      id: null
    };
    code = 400; // console.log(erro);

    res.status(code).send(erro);
  });
};

exports.delete = (req, res, next) => {
  res.status(200).send(res);
};
"use strict";

const Firebird = require("node-firebird");

const config = require("../config");

const firebase = require("../services/firebaseConfig");

var options = {};
options.host = config.host;
options.port = 3050;
options.database = config.connectionString;
options.user = "SYSDBA";
options.password = "masterkey";
options.lowercase_keys = false;
options.role = null;
options.pageSize = 4096;
const fb = firebase.firebase;

exports.get = (req, res, next) => {
  Firebird.attach(options, function (err, db) {
    if (err) throw err; // db = DATABASE

    db.query("SELECT * FROM v_estoque", function (err, result) {
      // IMPORTANT: close the connection
      const dataResult = result.map(item => {
        return {
          codigo: item.CODIGO,
          nome: item.NOME,
          unidade: item.UNIDADE,
          preco: item.PRECO,
          grupo: item.GRUPO,
          subgrupo: item.SUBGRUPO,
          fracionado: item.FRACIONADO,
          impressao: item.IMPRESSO
        };
      });
      res.status(200).send(dataResult);
      db.detach();
    });
  });
};

exports.clearProducts = (request, response) => {
  const data = request.body; // console.log(request);

  let user = fb.auth().currentUser;

  if (user == null) {
    fb.auth().signInWithEmailAndPassword(data.email, data.password).then(async () => {
      user = fb.auth().currentUser;
      await fb.firestore().collection("products").where("idProvider", "==", data.idProvider).get().then(async result => {
        result.forEach(async item => {
          await fb.firestore().collection("products").doc(item.data().id).delete().then(() => {
            response.status(201).json({
              resp: "ok"
            });
          }).catch(erro => {
            response.status(400).json({
              resp: "error"
            });
            console.log(erro);
          });
        });
      });
    });
  } else {
    fb.firestore().collection("products").where("idProvider", "==", data.idProvider).get().then(async result => {
      result.forEach(async item => {
        await fb.firestore().collection("products").doc(item.data().id).delete().then(() => {
          response.status(201).json({
            resp: "ok"
          });
        }).catch(erro => {
          response.status(400).json({
            resp: "error"
          });
          console.log(erro);
        });
      });
    });
  }
};

exports.delete = (request, response) => {
  let data = request.body; // console.log(request);

  let user = fb.auth().currentUser;

  if (user == null) {
    fb.auth().signInWithEmailAndPassword(data.email, data.password).then(async () => {
      user = fb.auth().currentUser;
      fb.firestore().collection("products").doc(data.id).delete().then(() => {
        response.status(201).json({
          resp: "ok"
        });
      }).catch(erro => {
        response.status(400).json({
          resp: "error"
        });
        console.log(erro);
      });
    });
  } else {
    fb.firestore().collection("products").doc(data.id).delete().then(() => {
      response.status(201).json({
        resp: "ok"
      });
    }).catch(erro => {
      response.status(400).json({
        resp: "error"
      });
      console.log(erro);
    });
  }
};

exports.post = (req, res, next) => {
  let data = req.body; // console.log(data);

  let id = "";

  if (data.id == "" || data.id == null) {
    let ref = fb.firestore().collection("products").doc();
    id = ref.id;
  } else {
    id = data.id;
  }

  let user = fb.auth().currentUser;

  if (user == null) {
    fb.auth().signInWithEmailAndPassword(data.email, data.password).then(async () => {
      user = fb.auth().currentUser;
      fb.firestore().collection("products").doc(id).set({
        idProvider: data.idProvider,
        id: id,
        code: data.code,
        description: data.description,
        unity: data.unity,
        group: data.group,
        subgroup: data.subgroup,
        price: data.price,
        active: data.active,
        fractioned: data.fractioned,
        fractions: data.fractions,
        edge: data.edge,
        additional: data.additional,
        portionSize: data.portionSize,
        web_img_64: data.web_img_64,
        web_borda_subgrupo: data.web_borda_subgrupo,
        monday: data.monday,
        monday_start: data.monday_start,
        monday_stop: data.monday_stop,
        tuesday: data.tuesday,
        tuesday_start: data.tuesday_start,
        tuesday_stop: data.tuesday_stop,
        wednesday: data.wednesday,
        wednesday_start: data.wednesday_start,
        wednesday_stop: data.wednesday_stop,
        thursday: data.thursday,
        thursday_start: data.thursday_start,
        thursday_stop: data.thursday_stop,
        friday: data.friday,
        friday_start: data.friday_start,
        friday_stop: data.friday_stop,
        saturday: data.saturday,
        saturday_start: data.saturday_start,
        saturday_stop: data.saturday_stop,
        sunday: data.sunday,
        sunday_start: data.sunday_start,
        sunday_stop: data.sunday_stop
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
    fb.firestore().collection("products").doc(id).set({
      idProvider: data.idProvider,
      id: id,
      code: data.code,
      description: data.description,
      unity: data.unity,
      group: data.group,
      subgroup: data.subgroup,
      price: data.price,
      active: data.active,
      fractioned: data.fractioned,
      fractions: data.fractions,
      edge: data.edge,
      additional: data.additional,
      portionSize: data.portionSize,
      web_img_64: data.web_img_64,
      web_borda_subgrupo: data.web_borda_subgrupo,
      monday: data.monday,
      monday_start: data.monday_start,
      monday_stop: data.monday_stop,
      tuesday: data.tuesday,
      tuesday_start: data.tuesday_start,
      tuesday_stop: data.tuesday_stop,
      wednesday: data.wednesday,
      wednesday_start: data.wednesday_start,
      wednesday_stop: data.wednesday_stop,
      thursday: data.thursday,
      thursday_start: data.thursday_start,
      thursday_stop: data.thursday_stop,
      friday: data.friday,
      friday_start: data.friday_start,
      friday_stop: data.friday_stop,
      saturday: data.saturday,
      saturday_start: data.saturday_start,
      saturday_stop: data.saturday_stop,
      sunday: data.sunday,
      sunday_start: data.sunday_start,
      sunday_stop: data.sunday_stop
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
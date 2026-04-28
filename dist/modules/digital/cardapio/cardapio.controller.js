"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.clearProducts = clearProducts;
exports.del = del;
exports.getCardapio = getCardapio;
exports.getEstoque = getEstoque;
exports.post = post;
exports.put = put;
var _nodeFirebird = _interopRequireDefault(require("node-firebird"));
var _firebird = _interopRequireDefault(require("../../../shared/database/firebird"));
var _firebase = require("../../../shared/firebase/firebase.config");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const fb = _firebase.firebase;
function getEstoque(req, res, next) {
  _nodeFirebird.default.attach(_firebird.default, (err, db) => {
    if (err) throw err;
    db.query('SELECT * FROM v_estoque', (err, result) => {
      const dataResult = result.map(item => ({
        codigo: item.CODIGO,
        nome: item.NOME,
        unidade: item.UNIDADE,
        preco: item.PRECO,
        grupo: item.GRUPO,
        subgrupo: item.SUBGRUPO,
        fracionado: item.FRACIONADO,
        impressao: item.IMPRESSO
      }));
      res.status(200).send(dataResult);
      db.detach();
    });
  });
}
function getCardapio(req, res, next) {
  const idProvider = req.body.idProvider;
  if (!idProvider) {
    throw new Error('Id Provider is required!');
  }
  const products = [];
  fb.firestore().collection('products').where('idProvider', '==', idProvider).orderBy('description').get().then(result => {
    result.forEach(item => {
      const d = item.data();
      products.push({
        id: d.id,
        idProvider: d.idProvider,
        code: d.code,
        description: d.description,
        unity: d.unity,
        group: d.group,
        subgroup: d.subgroup,
        price: d.price,
        active: d.active,
        fractioned: d.fractioned,
        fractions: d.fractions,
        edge: d.edge,
        additional: d.additional,
        portionSize: d.portionSize
      });
    });
    res.status(200).send(products);
  });
}
async function post(req, res) {
  const data = req.body;
  const id = data.id || fb.firestore().collection('products').doc().id;
  let user = fb.auth().currentUser;
  const payload = {
    idProvider: data.idProvider,
    id,
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
  };
  const save = () => fb.firestore().collection('products').doc(id).set(payload).then(() => res.status(201).send({
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
async function del(req, res) {
  const data = req.body;
  let user = fb.auth().currentUser;
  const remove = () => fb.firestore().collection('products').doc(data.id).delete().then(() => res.status(201).json({
    resp: 'ok'
  })).catch(erro => {
    res.status(400).json({
      resp: 'error'
    });
    console.log(erro);
  });
  if (user == null) {
    await fb.auth().signInWithEmailAndPassword(data.email, data.password);
    remove();
  } else {
    remove();
  }
}
async function clearProducts(req, res) {
  const data = req.body;
  let user = fb.auth().currentUser;
  const clear = async () => {
    const result = await fb.firestore().collection('products').where('idProvider', '==', data.idProvider).get();
    for (const item of result) {
      await fb.firestore().collection('products').doc(item.data().id).delete().then(() => res.status(201).json({
        resp: 'ok'
      })).catch(erro => {
        res.status(400).json({
          resp: 'error'
        });
        console.log(erro);
      });
    }
  };
  if (user == null) {
    await fb.auth().signInWithEmailAndPassword(data.email, data.password);
    clear();
  } else {
    clear();
  }
}
function put(req, res, next) {
  res.status(201).send({
    id: req.params.id,
    title: req.body.title,
    cost: req.body.cost
  });
}
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.del = del;
exports.get = get;
exports.getByDeliveryMan = getByDeliveryMan;
exports.post = post;
exports.put = put;
var _firebase = require("../../../shared/firebase/firebase.config");
var rm = _interopRequireWildcard(require("../../../shared/utils/removeEmoji"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const fb = _firebase.firebase;
function get(req, res, next) {
  res.status(200).send([]);
}
function post(req, res, next) {
  const data = req.body;
  const ticket = data.file ? rm.remove(data.file) : data.file;
  fb.firestore().collection('requests').doc(data.id).update({
    ticket
  }).then(() => res.status(200).send(data)).catch(erro => res.status(400).send({
    erro: erro.code
  }));
}
function put(req, res, next) {
  const data = req.body;
  const payload = {
    status: data.status,
    reason: data.reason
  };
  if (data.deliveryMan?.code) {
    payload.deliveryMan = {
      code: data.deliveryMan.code,
      name: data.deliveryMan.name,
      phone: data.deliveryMan.phone
    };
  }
  fb.firestore().collection('requests').doc(data.id).update(payload).then(() => res.status(200).send(data)).catch(erro => res.status(400).send({
    erro: erro.code
  }));
}
function getByDeliveryMan(req, res, next) {
  const {
    code
  } = req.params;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  fb.firestore().collection('requests').where('deliveryMan.code', '==', code).where('dateRequest', '>=', since.toISOString()).orderBy('dateRequest', 'desc').get().then(snapshot => {
    const result = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.status(200).send(result);
  }).catch(erro => res.status(400).send({
    erro: erro.code
  }));
}
function del(req, res, next) {
  res.status(200).send([]);
}
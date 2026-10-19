"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _express = require("express");
var _apiKey = require("../../../shared/middlewares/apiKey");
var controller = _interopRequireWildcard(require("./pagamentos.controller"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const router = (0, _express.Router)();

// Exige X-Api-Key quando config.apiKey está definida.
router.post('/', _apiKey.requireApiKey, controller.registrar);
router.patch('/:id/estorno-manual', _apiKey.requireApiKey, controller.estornoManual);
router.get('/:origem/:codVenda', controller.listar);
var _default = exports.default = router;
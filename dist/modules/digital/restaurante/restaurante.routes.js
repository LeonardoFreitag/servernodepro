"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _express = require("express");
var _restaurante = require("./restaurante.controller");
const router = (0, _express.Router)();
router.post('/abrir', _restaurante.abrirRestaurante);
router.post('/fechar', _restaurante.fecharRestaurante);
router.get('/eventos', _restaurante.listarEventos);
var _default = exports.default = router;
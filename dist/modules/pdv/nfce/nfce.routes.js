"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _express = require("express");
var _nfce = require("./nfce.controller");
const router = (0, _express.Router)();
router.post('/solicitar', _nfce.solicitar);
router.get('/status/:id', _nfce.status);
var _default = exports.default = router;
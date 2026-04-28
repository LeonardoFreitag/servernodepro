"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _express = require("express");
const router = (0, _express.Router)();
router.get('/', (req, res, next) => {
  res.status(200).send({
    title: 'Mettre API',
    version: '0.0.2'
  });
});
var _default = exports.default = router;
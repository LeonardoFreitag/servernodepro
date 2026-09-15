"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.authJWT = authJWT;
var _express = require("express");
var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));
var _config = _interopRequireDefault(require("../../config"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function authJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      erro: 'Token inválido'
    });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = _jsonwebtoken.default.verify(token, _config.default.jwtSecret);
    req.entregador = payload;
    next();
  } catch {
    res.status(401).json({
      erro: 'Token inválido'
    });
  }
}
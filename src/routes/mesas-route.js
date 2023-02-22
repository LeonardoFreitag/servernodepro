"use strict";

const express = require("express");
const router = express.Router();
const controllerMesas = require("../controllers/mesas-controller");

router.get("/", controllerMesas.get);
router.put("/", controllerMesas.insereComanda);
router.post("/fechaConta", controllerMesas.fechaConta);
router.delete("/", controllerMesas.delete);

module.exports = router;

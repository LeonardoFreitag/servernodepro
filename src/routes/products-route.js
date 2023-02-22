"use strict";

const express = require("express");
const router = express.Router();
const controllerProducts = require("../controllers/products-controller");

router.get("/", controllerProducts.get);
router.post("/", controllerProducts.post);
router.put("/:id", controllerProducts.put);
router.post("/delete", controllerProducts.delete);
router.post("/clearProducts", controllerProducts.clearProducts);

module.exports = router;

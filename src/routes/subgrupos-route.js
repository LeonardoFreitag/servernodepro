"use strict";

const express = require("express");
const router = express.Router();
const controllerSubgrupos = require("../controllers/subgrupos-controller");

router.get("/", controllerSubgrupos.get);

module.exports = router;

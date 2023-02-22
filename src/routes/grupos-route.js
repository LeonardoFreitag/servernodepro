'use strict'

const express = require('express');
const router = express.Router();
const controllerGrupos = require('../controllers/grupos-controller');

router.get('/', controllerGrupos.get);

module.exports = router;

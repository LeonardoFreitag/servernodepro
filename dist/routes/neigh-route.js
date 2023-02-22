'use strict';

const express = require('express');

const router = express.Router();

const controllerNeigth = require("../controllers/neigh-controller");

router.get('/', controllerNeigth.get);
router.post('/', controllerNeigth.post);
router.put('/:id', controllerNeigth.put);
router.delete('/', controllerNeigth.delete);
module.exports = router;
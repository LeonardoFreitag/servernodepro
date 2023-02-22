'use strict';

const express = require('express');

const router = express.Router();

const controllerRequest = require("../controllers/request-controller");

router.get('/', controllerRequest.get);
router.post('/', controllerRequest.post);
router.put('/', controllerRequest.put);
router.delete('/', controllerRequest.delete);
module.exports = router;
'use strict'

const express = require('express');
const router = express.Router();
const controllerProviders = require('../controllers/provider-controller');

router.get('/', controllerProviders.get);
router.post('/', controllerProviders.post);
router.put('/', controllerProviders.put);
router.delete('/', controllerProviders.delete);


module.exports = router;

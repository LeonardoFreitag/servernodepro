'use strict'

const express = require('express');
const router = express.Router();
const productManager = require('../controllers/product-manager-controller');

router.get('/', productManager.get);
router.post('/', productManager.post);
router.put('/', productManager.put);
router.delete('/', productManager.delete);


module.exports = router;

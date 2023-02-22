'use strict'

const express = require('express');
const router = express.Router();
const controllerPayment = require('../controllers/payment-controller');

router.get('/', controllerPayment.get);
router.post('/', controllerPayment.post);
router.put('/', controllerPayment.put);
router.delete('/', controllerPayment.delete);


module.exports = router;

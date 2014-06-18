'use strict';

var express = require('express');
var users = require('../controllers/users');
var promiseResponse = require('../lib/promise-response');

var router = new express.Router();

router.get('/user/:username', promiseResponse.html(users.homepage));

module.exports = router;
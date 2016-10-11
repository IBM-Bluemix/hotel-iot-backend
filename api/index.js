var router = require('express').Router();
var Account = require('../models/account');
var Request = require('request');
var Recommendations = require('../controllers/recommendations');

// GET Recommendations =========================================================
router.get('/twitter/:username', Recommendations.getTweets);

module.exports = router;

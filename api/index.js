var router = require('express').Router();
var Account = require('../models/account');
var Request = require('request');
var Recommendations = require('../controllers/recommendations');
var Recommendation = require('../controllers/recommendation');


// GET Recommendations =========================================================
router.get('/twitter/:username', Recommendations.getTweets);
router.post('/recommendation', Recommendation.getRecommendations);

module.exports = router;

/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

var mongoose = require('mongoose');
var fs = require('fs');

var Account = require('./models/account');

// Config
var configDB = require('./config/database.js');
var iotAppConfig = require('./config/iot.js');

var Client = require('ibmiotf').IotfApplication;
var Recommendation = require('./controllers/recommendation.js');

mongoose.connect(configDB.url); // connect to our database
console.log(iotAppConfig);
var appClient = new Client(iotAppConfig);

appClient.connect();

appClient.on("connect", function () {
    console.log("subscribe to input events");
    appClient.subscribeToDeviceEvents("NUC-CIELO");
});

appClient.on("deviceEvent", function (deviceType, deviceId, eventType, format, payload) {
    //    if (eventType === 'motionSensor') {
    //        motionSensorData.motionPayload = JSON.parse(payload);
    //    } else {
    //        console.log('Got other events of ' + eventType + ' from ' + deviceId + ':' + JSON.stringify(payload));
    //    }

    appClient.publishDeviceCommand("NUCCIELO", "NUCCIELO", "blink", "json", {});

    var myData = {
        'DelaySeconds': 10
    };
    myData = JSON.stringify(myData);
    appClient.publishDeviceCommand("NUC-CIELO", deviceId, "blink", "json", 1);

    console.log(JSON.parse(payload));
});



// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express');
var bodyParser = require('body-parser');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// create a new express server
var app = express();

// require files from routes, controllers, etc...

// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({
    extended: true
}));

app.post('/login', function (req, res) {

    var details = req.body;

    var username = details.username;

    console.log(username);

    Account.findOne({
        'twitter.id': username
    }, function (err, user) {

        console.log('looking for account');

        if (err) {
            console.log(err);
        }

        if (user) {

            console.log('finding user');
            account = user;

        } else {

            console.log('creating user');

            account = new Account();
            account.twitter.id = username;

            account.save(function (err) {
                if (err) {
                    throw err;
                }
            })
        }

        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({
            account: account
        }, null, 3));
    });
});

app.get('/account', function (req, res) {

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
        outcome: 'failure'
    }, null, 3));
});

app.post('/newaccount', function (req, res) {
    var account = new Account();
    var claim = req.body;
});

app.post('/api/recommendations', Recommendation.getRecommendations);

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// ROUTER
// var api = require('./api');
// app.use('/api', api);
//
// module.exports = app;

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function () {
    // print a message when the server starts listening
    console.log("server starting on " + appEnv.url);
});

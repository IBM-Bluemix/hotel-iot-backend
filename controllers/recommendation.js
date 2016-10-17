// Services
var Yelp = require('yelp');
var Twitter = require('twitter');
var Promise = require('bluebird');
var Watson = require('watson-developer-cloud');

// Authentication / Config
var yelpAuth = require('../config/yelp.js');
var twitterAuth = require('../config/twitter.js');
var alchemyAuth = require('../config/alchemy.js');
var conversationAuth = require('../config/conversation.js');

Promise.promisifyAll(Twitter);

var yelp = new Yelp(yelpAuth);
var client = new Twitter(twitterAuth);
var alchemy = new Watson.alchemy_language(alchemyAuth);
var conversation = new Watson.conversation({
  username: conversationAuth.username,
  password: conversationAuth.password,
  version: 'v1',
  version_date: '2016-07-01'
});

exports.getRecommendations = function(req, res) {
  // GATHER POST DATA
  var username = req.body.username;
  var city = req.body.city;
  var state = req.body.state;
  var country = req.body.country;

  getTweets(username).then(function (tweets) {
    var promises = [];


    // Get Keywords from AlchemyAPI
    for (var i = 0; i < tweets.length; i++) {
      var alchemyPromise = getKeywords(tweets[i].text);
      promises.push(alchemyPromise);

      var conversationPromise = getEntities(tweets[i].text);
      promises.push(conversationPromise);
    }

    Promise.all(promises).then(function(promiseData) {
      var data = [];

      for (var j = 0; j < promiseData.length; j+=2) {
        data.push({
          tweet: promiseData[j].tweet,
          keywords: promiseData[j].keywords,
          concepts: promiseData[j].concepts,
          entities: promiseData[j+1]
        });
      }

      var scores = {};

      for (var k = 0; k < data.length; k++) {
        for(var l = 0; l < data[k].entities.length; l++) {
          if(!scores[data[k].entities[l].entity]) {
            scores[data[k].entities[l].entity] = {};
            scores[data[k].entities[l].entity][data[k].entities[l].value] = 1;
          } else {
            if(!scores[data[k].entities[l].entity][data[k].entities[l].value]) {
              scores[data[k].entities[l].entity][data[k].entities[l].value] = 1;
            } else {
              scores[data[k].entities[l].entity][data[k].entities[l].value] += 1;
            }
          }
        }
      }

      if(scores.food) {
        var keyword = Object.keys(scores.food).reduce(function(a, b) {
          return scores.food[a] > scores.food[b] ? a : b
        });

        var location = city + ', ' + (state ? state + ', ' + country : country);
        yelp.search({
          term: keyword,
          location: location
        }).then(function(recommendations) {
          var result = {
            recommendations: recommendations,
            data: data,
            scores: scores
          };

          res.json(result);
        }).catch(function(err) {
          res.send(err);
        });
      }
    }).catch(function(err) {
      res.send(err);
    });
  }).catch(function(err) {
    res.send(err);
  });
}

function getTweets(username) {
  return new Promise(function(resolve, reject) {
    client.get('statuses/user_timeline', {
      screen_name: username,
      count: 10
    }, function(error, tweets) {
      if (error) reject(error);
      else resolve(tweets);
    });
  });
}

function getKeywords(text) {
  return new Promise(function(resolve, reject) {
    var parameters = {
      extract: 'keywords, concepts',
      text: text,
      language: 'english'
    };

    alchemy.combined(parameters, function(error, data) {
      if (error) {
        reject(error);
      } else {
        var result = {
          tweet: parameters.text,
          keywords: data.keywords,
          concepts: []
        }

        for (var i = 0; i < data.concepts.length; i++) {
          var concept = {
            relevance: data.concepts[i].relevance,
            text: data.concepts[i].text
          }

          result.concepts.push(concept);
        }

        resolve(result);
      }
    });
  });
}

function getEntities(text) {
  return new Promise(function(resolve, reject) {
    conversation.message({
      workspace_id: conversationAuth['workspace-id'],
      input: {
        'text': text.trim().replace(/(\r\n|\n|\r)/gm," ")
      }
    }, function (error, response) {
      if (error) {
        reject(error);
      } else {
        var entities = [];
        for (var i = 0; i < response.entities.length; i++) {
          var entity = {
            entity: response.entities[i].entity,
            value: response.entities[i].value
          };

          entities.push(entity);
        }

        resolve(entities);
      }
    });
  });
}

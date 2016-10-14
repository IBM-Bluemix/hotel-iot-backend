var Twitter = require('twitter');
var Yelp = require('yelp');
var Watson = require('watson-developer-cloud');
var Promise = require('bluebird');

var twitterAuth = require('../config/twitter.js');
var yelpAuth = require('../config/yelp.js');
var alchemyAuth = require('../config/alchemy.js');
var conversationAuth = require('../config/conversation.js');


Promise.promisifyAll(Twitter);

var client = new Twitter({
  consumer_key: twitterAuth['consumer-key'],
  consumer_secret: twitterAuth['consumer-secret'],
  access_token_key: twitterAuth['access-token'],
  access_token_secret: twitterAuth['access-token-secret']
});

/*
module.exports = {
  'consumer-key': 'wYmvsQQKm51JumzsLV9_1A',
  'consumer-secret': 'arPUwqWJrkNtPLkJ3QWykJp8EdQ',
  'token': 'hS_StUAH2I1o1_F_n22baGeamJCNYXSA',
  'token-secret': '-yYJ6K6V4N5cDCvBuGEONXNSnrg'
}
*/

var yelp = new Yelp(yelpAuth);
var alchemy_language = new Watson.alchemy_language(alchemyAuth);

var conversation = Watson.conversation({
  username: conversationAuth['username'],
  password: conversationAuth['password'],
  version: 'v1',
  version_date: '2016-07-01'
});

module.exports.getTweets = function(req, res) {
  getTweets(req.params.username).then(function (data) {
    var promises = []

    // Get Keywords from AlchemyAPI
    for (var i = 0; i < data.length; i++) {
      var alchemyPromise = getKeywords(data[i].text);
      promises.push(alchemyPromise);

      var conversationPromise = getEntities(data[i].text);
      promises.push(conversationPromise);
    }

    Promise.all(promises)
    .then(function(data) {
      var recommendationsData = [];

      for (var j = 0; j < data.length; j+=2) {
        recommendationsData.push({
          tweet: data[j].tweet,
          keywords: data[j].keywords,
          concepts: data[j].concepts,
          entities: data[j+1]
        });
      }

      console.log("==========================================================");
      console.log("RECOMMENDATIONS");
      console.log(recommendationsData);
      console.log("==========================================================");

      var scores = {};

      for(var k = 0; k < recommendationsData.length; k++) {
        for(var l = 0; l < recommendationsData[k].entities.length; l++) {
          console.log(recommendationsData[k].entities[l]);
          if(!scores[recommendationsData[k].entities[l].entity]) {
            scores[recommendationsData[k].entities[l].entity] = {};
            scores[recommendationsData[k].entities[l].entity][recommendationsData[k].entities[l].value] = 1;
          } else {
            if(!scores[recommendationsData[k].entities[l].entity][recommendationsData[k].entities[l].value]) {
              scores[recommendationsData[k].entities[l].entity][recommendationsData[k].entities[l].value] = 1;
            } else {
              scores[recommendationsData[k].entities[l].entity][recommendationsData[k].entities[l].value] += 1;
            }
          }
        }
      }

      console.log(scores);
      console.log("==========================================================");
      if(scores.food) {
        var keyword = Object.keys(scores.food).reduce(function(a, b) {
          return scores.food[a] > scores.food[b] ? a : b
        });

        yelp.search({term: keyword, location: 'Las Vegas'})
        .then(function(data) {
          var result = {
            recommendations: recommendationsData,
            scores: scores,
            data: data
          }
          res.json(result);
        })
        .catch(function(err) {
          res.send(err);
        });
      }
    })
    .catch(function (e) {
      res.send(e);
    });
  }).catch(function(error) {
    res.json(error);
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
      extract: 'keywords,concepts',
      text: text,
      language: 'english'
    };

    alchemy_language.combined(parameters, function(error, data) {
      if(error) {
        console.log(parameters);
        console.log("Alchemy Error!");
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
      input: {'text': text.trim().replace(/(\r\n|\n|\r)/gm," ")}
    }, function(error, response) {
      if (error) {
        console.log("Conversation Error");
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

if (Meteor.isClient) {
  // Template.hello.greeting = function () {
  //   return "Welcome to tweetlang.";
  // };

  Template.usernameInput.result = function(){
    return JSON.stringify(Session.get('stats'));
  }

  function getRandColor(brightness){
    //6 levels of brightness from 0 to 5, 0 being the darkest
    var rgb = [Math.random() * 256, Math.random() * 256, Math.random() * 256];
    var mix = [brightness*51, brightness*51, brightness*51]; //51 => 255/5
    var mixedrgb = [rgb[0] + mix[0], rgb[1] + mix[1], rgb[2] + mix[2]].map(function(x){ return (x/2.0).round()})
    return "rgb(" + mixedrgb.join(",") + ")";
  }

  Template.usernameInput.events({
    'click input[type=button]': function () {
      // template data, if any, is available in 'this'
      var username = $('#username').val().replace(/@/g,"");
      history.pushState({username : username}, null, '/'+username);
      fetchStats( username );
    },
    'keypress input[type=text]' : function(e){
      if (!e) e = window.event;
      var keyCode = e.keyCode || e.which;
      if (keyCode == '13') {
        var username = $('#username').val().replace(/@/g,"");
        history.pushState({username : username}, null, '/'+username);
        fetchStats( username );
      }
    }
  });

  $(window).on('popstate',function(e){
    if (e.originalEvent.state) {
      var username = e.originalEvent.state.username
      $('input[type=text]').val(username);
      fetchStats(username);
    } else {
      $('input[type=text]').val('');
      ctx.clearRect(0,0,500,500);
    }
  });

  function fetchStats (username) {
    $('input[type=button]').addClass('disabled').val('Loading...');
    Meteor.call('getUserStats', username, function(err, result){
      $('input[type=button]').removeClass('disabled').val('Try again');

      if (result.error) {
        err = result.error;
      }
      if (err) {
        alert(err);
        return;
      }
      $('input[type=button]').removeClass('disabled').val('Gogogo!');

      var max = 0;
      var maxLang;

      var data = Object.keys(result).map(function(key){
        if (result[key] > max) {
          max = result[key];
          maxLang = key;
        }
        return {
          value : result[key],
          label : key,
          color: '#'+('00000'+(Math.random()*(1<<24)|0).toString(16)).slice(-6)
        }
      });
      Session.set('mostTweeted', maxLang);
      refreshCanvas(data);
    });
    Session.set('currentUsername', username);
  }

  Template.chart.legend = function(){
    return Session.get('legend');
  }

  Meteor.startup(function(){
    setupCanvas();
  });

  var chart, ctx;
  function setupCanvas(){
    ctx = $('#chart')[0].getContext('2d');
  }
  function refreshCanvas(data){
    if (chart) {
      chart.destroy();
    }
    chart = new Chart(ctx).Doughnut(data,{});
    Session.set('legend', chart.generateLegend());
    window.chart = chart;
  }

  Template.twitter.address = function() {
    return location.href+'/';
  }

  Template.twitter.text = function(){
    var mostLanguage = Session.get('mostTweeted');
    if (window.languages[mostLanguage]) {
      mostLanguage = window.languages[mostLanguage];
    }
    return '@'+Session.get('currentUsername')+' tweets in '+mostLanguage+' the most!';
  }

  Meteor.startup(function(){
    var username = location.pathname.replace(/\//g,'');
    if (username.length) {
      $('input[type=text]').val(username);
      fetchStats(username);
    }
  });
}

if (Meteor.isServer) {

  Meteor.startup(function () {
    // code to run on server at startup

    Request = Meteor.require('request');

    function getUserTweets (username, callback) {
      Request.get('https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name='+username+'&count=200', {
        'auth': {
          'bearer': 'AAAAAAAAAAAAAAAAAAAAAIBOZgAAAAAA4e7tdhm3PuxZz1elkPY5vF9amVo%3DFIiNL7FhJskKzqyLBGusrSBQcpMAziINVjZRN59LssmNZHP98M'
        }
      },
      function(err, response, body){
        if (err) {
          return callback(err);
        }
        var tweetsData;
        try {
          tweetsData = JSON.parse(body);
        }catch(e){
          return callback(e);
        }
        if((tweetsData.errors && tweetsData.errors[0])||tweetsData.error){
          callback(tweetsData.error || tweetsData.errors[0].message);
          return;
        }
        callback(null, tweetsData.map(function(tweet){
          return tweet.text;
        }));
      });
    }

    Async = Meteor.require('async');
    function detectLanguages (texts, callback) {

      function fetchLanguages (texts, callback){
        if (!texts || !texts.length) {
          callback(null, []);
          return;
        }
        var url = 'http://api.microsofttranslator.com/V2/Ajax.svc/DetectArray?appId=6E048DBAEE2BCE70051BE0D55A17101B5DC15DE6&texts='+encodeURIComponent(JSON.stringify(texts));
        Request.get(url,function (err, response, body) {
          if (err) {
            return callback(err);
          }
          // bing's api return BOM!!
          body = body.replace(/^\uFEFF/g, '');
          var languagesArray;
          try{
            languagesArray = JSON.parse(body);
          }catch(e){
            console.log(body);
            return callback('JSON Error '+e);
          }
          callback(null, languagesArray);
        });
      }

      // because microsoft says request cannot be too long
      var splitIntoParts = 20;
      var perPart = 200/splitIntoParts;
      var fetches = [];
      for (var i = 0; i < splitIntoParts; i++) {
        fetches[i] = (function(i){
          return function (callback) {
            fetchLanguages( texts.slice( i*perPart, (i+1)*perPart ), callback )
          }
        })(i);
      };
      Async.parallel(fetches, function (err, results) {
        if (err) {
          return callback(err);
        }
        var counts = {};
        results
        .reduce(function(prev, current){
          return prev.concat(current);
        },[])
        .forEach(function(language){
          if (!(language in counts)) {
            counts[language] = 1;
          } else {
            counts[language]++;
          }
        });
        callback(null, counts);
      });
    }

    Meteor.methods({
      getUserStats: function(username) {
        // load Future
        Future = Npm.require('fibers/future');
        var myFuture = new Future();

        getUserTweets(username, function(err, tweets){
          if (err) {
            myFuture.throw(err);
            return;
          }
          detectLanguages(tweets, function(err, counts){
            if (err) {
              return myFuture.throw(err);
            }
            myFuture.return(counts);
          });
        });
        var val;
        try{
          val = myFuture.wait();
          return val;
        }catch(e){
          return { error : e.message }
        }
      }
    });
  });
}

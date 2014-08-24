if (Meteor.isClient) {
  // Template.hello.greeting = function () {
  //   return "Welcome to tweetlang.";
  // };

  Template.usernameInput.events({
    'click input[type=button]': function () {
      // template data, if any, is available in 'this'
      if (typeof console !== 'undefined'){
        console.log("You pressed the button");
      }

      Meteor.call('getUserStats', $('#username').val(), function(err, result){
        console.log(arguments);
      });
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
        callback(null, tweetsData.map(function(tweet){
          return tweet.text;
        }));
      });
    }

    Meteor.methods({
      getUserStats: function(username) {
        // load Future
        Future = Npm.require('fibers/future');
        var myFuture = new Future();
        
        // // call the function and store its result
        // SomeAsynchronousFunction("foo", function (error,results){
        //   if(error){
        //     myFuture.throw(error);
        //   }else{
        //     myFuture.return(results);
        //   }
        // });
        getUserTweets(username, function(err, tweets){
          
        });

        setTimeout(function() {

          // Return the results
          myFuture.return("hello (delayed for 3 seconds)");

        }, 3 * 1000);
    
        return myFuture.wait();
      }
    });
  });
}

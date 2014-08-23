if (Meteor.isClient) {
  Template.hello.greeting = function () {
    return "Welcome to tweetlang.";
  };

  Template.hello.events({
    'click input': function () {
      // template data, if any, is available in 'this'
      if (typeof console !== 'undefined')
        console.log("You pressed the button");

      UI.insert( UI.render( Template.otherthing ), document.body )
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });

  fs = Npm.require('fs');
  console.log(fs);
}

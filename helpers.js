var events = require('events');
var eventEmitter = events.EventEmitter();

module.exports = {
  compareFunction: function(user1, user2){return (user1.geoDistance > user2.geoDistance) ? 1 : ((user1.geoDistance < user2.geoDistance) ? -1 : 0)},

  acceptListener: function(obj, callback){
    // TODO Send push notification to benefactor here.
    // if accept callback(accepted)
    // else callback(rejected)
  }
};

var express = require('express');
var geolib = require('geolib');
var events = require('events');
var sqlite3 = require('sqlite3').verbose();
var fcm = require('fcm-push');
//var sql = require('sql');
//var helpers = require('helpers');
//var promise = require('bluebird');
var core = express.Router();
//var sendRequest = promise.promisify(helpers.acceptListener);


var db = new sqlite3.Database('./hitchbikedb');

core.post('/putusers', function(req, res, next){
  console.log("New user request called with ", req.body);
  ret = [];
  db.serialize(function(){
    var stmt = db.prepare('SELECT credits, availability FROM user WHERE id=?', req.body.id);
    stmt.get(function(err, row){
      if (row != undefined){
        console.log("User already exists with this ID.");
        res.send(JSON.stringify(row));
      } else {
        stmt = db.prepare("INSERT INTO user VALUES(?,?,?,?,?,?)");
        stmt.run(req.body.username,req.body.id,req.body.email,req.body.phone,"0","10");
        stmt.finalize();

        stmt = db.prepare('SELECT credits, availability FROM user WHERE id=?', req.body.id);
        stmt.get(function(err, row){
          console.log("New user created!");
          res.status(200).send(JSON.stringify(row));
        })
      }
    });
  });
});

core.get('/getusers', function(req, res, next){
  console.log("Sending all users to client.");
  ret = [];
  db.serialize(function(){
    db.each("SELECT name, availability FROM user", function(err, row){
      ret.push(row);
    }, function(err, rows){
      console.log("Fetched "+ rows +  " rows");
      res.status(200).send(JSON.stringify(ret));
    });
  });
});

core.post('/toggleavailability', function(req, res, next){
  console.log("Updating availability for",req.body.id);
  db.serialize(function(){
    var availability = (req.body.availability == "true")? 1:0;
    db.run("UPDATE user SET availability = ? WHERE id = ?",availability, req.body.id, function(err){
      if (err != "null"){
        if (availability == 1){
          stmt = db.prepare("INSERT INTO geolocation VALUES(?,null,null)");
        } else {
          stmt = db.prepare("DELETE FROM geolocation WHERE id = ?");
        }
        stmt.run(req.body.id);
        stmt.finalize();
        console.log("Toggled for", req.body.id);
        res.status(200).json({"Status":"Success"});
      };
    });
  });
});

core.post('/updateposition', function(req, res, next){
  console.log("Updating position for ", req.body);
  var params = [req.body.latitude, req.body.longitude, req.body.id];
  db.serialize(function(){
    db.run("UPDATE geolocation SET latitude = ?, longitude = ? WHERE id = ?", params, function(err){
      if (err != "null"){
      res.status(200).json({"Status":"Success"});
      }
    })
  })
});
// TODO Implement using spatial data type in mssql-server
core.post('/sendpickrequest', function(req, res, next){
  console.log("Find nearest available benefactor for " + req.body);
  ret = [];
  db.serialize(function(){
    db.each("SELECT name, location FROM geolocation", function(err, row){
      ret.push(row);
    },
    function(err, rows){
      console.log("Fetched "+ rows +  " rows");
      var freeloaderpos = {
        'latitude': req.body.latitude,
        'longitude': req.body.longitude
      };

      for (let key in ret){
        let benefactorpos = {
          'latitude': ret[key].latitude,
          'longitude': ret[key].longitude
        }
        ret[key].geoDistance = geolib.getDistance(freeloaderpos, benefactorpos);
      };

      ret.sort(helpers.compareFunction);


      res.send(JSON.stringify(ret));
    });
  });
});


core.get('/home',function(req, res, next){
  res.send("¯\\_(ツ)_/¯");
});

core.post('')

module.exports = core;

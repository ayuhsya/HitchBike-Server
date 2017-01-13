var express = require('express');
var promise = require('bluebird');
var sqlite3 = require('sqlite3').verbose();
var sql = require('sql');
var core = express.Router();


var db = new sqlite3.Database('./hitchbikedb');
sql.setDialect('sqlite');

var user = sql.define({
  name: 'user',
  columns: ['name', 'email', 'availibility']
});

core.post('/putusers', function(req, res, next){
  console.log(req.body);
  db.serialize(function(){
    var stmt = db.prepare("INSERT INTO user VALUES(?,?,?)");
    stmt.run(req.body.name,req.body.email,"0");
    stmt.finalize();
    res.send("Success");
  });
});

core.get('/getusers', function(req, res, next){
  console.log("Sending all users to client.");
  ret = [];
  db.serialize(function(){
    db.each("SELECT name FROM user", function(err, row){
      ret.push(row);
    }, function(err, rows){
      console.log("Fetched "+ rows +  " rows");
      res.send(JSON.stringify(ret));
    });
  });
});

core.post('/toggleavailibilityon', function(req, res, next){
  console.log("Updating availibility for ",req.body.name);
  db.serialize(function(){
    db.run("UPDATE user SET availibility = 1 WHERE name = ?", req.body.name, function(err){
      if (err != "null"){
        res.send("Success");
      }
    });
  });
});

core.post('/toggleavailibilityoff', function(req, res, next){
  console.log("Updating availibility for ",req.body);
  db.serialize(function(){
    db.run("UPDATE user SET availibility = 0 WHERE name = ?", req.body.name, function(err){
      if (err != "null"){
        res.send("Success");
      }
    });
  });
});

core.post('/updateposition', function(req, res, next){
  console.log("Updating position for ", req.body);
  var params = [req.body.pos_lat, req.body.pos_long, req.body.name];
  db.serialize(function(){
    db.run("UPDATE user SET pos_lat = ?, pos_long = ? WHERE name = ?", params, function(err){
      if (err != "null"){
        res.send("Success");
      }
    })
  })
});

// TODO Implement using spatial data type in mssql-server
core.post('/sendpickrequest', function(req, res, next){
  console.log("Find nearest available benefactor for " + req.body);
  db.serialize(function(){
    db.each("SELECT location FROM user WHERE availibility = 1", function(err, row){
      ret.push(row);
    }, function(err, rows){
      console.log("Fetched "+ rows +  " rows");
      res.send(JSON.stringify(ret));
    });
  });

});

core.get('/home',function(req, res, next){
  res.send(JSON.stringify({"Hitch": "Bike"}));
});

core.post('')

module.exports = core;

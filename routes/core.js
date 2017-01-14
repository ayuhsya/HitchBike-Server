var express = require('express');
var geolib = require('geolib');
var events = require('events');
var Connection = require('tedious').Connection;
var FCM = require('fcm-push');
var Request = require('tedious').Request
var TYPES = require('tedious').TYPES;

//var helpers = require('helpers');
//var promise = require('bluebird');
var core = express.Router();
var serverKey = 'AAAAKkwMFhM:APA91bGB9UA6C3V7C7hSfYox4Kwuu-FqwLrXk3ehyF8WKz7aEQxXutLXSBCVWlnMhRVjDJIb7XW-MTX8xGYV7xahRpOEKCDD6xVAhmoiKL2frwgdqlus2928raq1vjQaVZZWbf8UlJbu';
//var sendRequest = promise.promisify(helpers.acceptListener);
var config = {
        userName: 'hitchbikeadmin',
        password: 'whiledOnes@1',
        server: 'hitchbike.database.windows.net',
        // When you connect to Azure SQL Database, you need these next options.
        options: {encrypt: true, database: 'hitchbikedb'}
    };

core.post('/putusers', function(req, res, next){
  console.log("New user request called with ", req.body);
  let ret = [];

  var connection = new Connection(config);
    connection.on('connect', function(err) {
      // If no error, then good to proceed.
      console.log("Connected", err);
      let request = new Request("SELECT credits, availability FROM USERS WHERE id=@id", function(err, rowCount){
        if (err){
          console.log(err);
        } else {
          console.log("Done!");
          if (rowCount == 0){
            let newrequest = new Request("INSERT into USERS VALUE(@username,@id,@email,@phone,@token,@availability,@credits)");
            newrequest.addParameter('username',TYPES.VarChar,req.body.username);
            newrequest.addParameter('id',TYPES.VarChar,req.body.id);
            newrequest.addParameter('email',TYPES.VarChar,req.body.email);
            newrequest.addParameter('phone',TYPES.VarChar,req.body.phone);
            newrequest.addParameter('token',TYPES.VarChar,req.body.token);
            newrequest.addParameter('availability',TYPES.Int,0);
            newrequest.addParameter('credits',TYPES.Int,10);

            newrequest.on('done', function(rowCount,more){
              if(rowCount != 1){
                res.status(400).json({"Fail":"400"});
              } else {
                res.status(200).json({"credits":'10',"availability":'0'});
              }
            });
            connection.execSql(newrequest);
          } else {
            console.log("Fetched ", rowCount);
            res.status(200).json(JSON.stringify(ret));
          }
        }
      });
      request.addParameter('id', TYPES.VarChar, req.body.id);
      console.log(request);
      request.on('row', function(columns){
        columns.forEach(function(column) {
              if (column.value === null) {
                console.log('NULL');
              } else {
                console.log("Value " + column.value);
                ret[column.colName] = column.value;
              };
            });
      });

      console.log("Second", request);
      connection.execSql(request);
    });
});

core.post('/settoken', function(req, res, next){
  console.log("Setting token for ", req.body);
    db.serialize(function(){
      var stmt = db.prepare('UPDATE USERS SET token = ? WHERE id = ?');
      stmt.run(req.body.token, req.body.id, function(err){
        if(err != null){
          console.log("Token added for ", req.body.id);
          stmt.finalize();
          res.status(200).json({"Status": "Success"});
        };
      });
    });
})

core.get('/getusers', function(req, res, next){
  console.log("Sending all users to client.");
  ret = [];
  db.serialize(function(){
    db.each("SELECT name, availability FROM USERS", function(err, row){
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
    db.run("UPDATE USERS SET availability = ? WHERE id = ?",availability, req.body.id, function(err){
      if (err != "null"){
        if (availability == 1){
          stmt = db.prepare("INSERT OR IGNORE INTO geolocation VALUES(?,null,null)");
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

/*
// TODO Implement using spatial data type in mssql-server
core.push('/sendpickrequest', function(req, res, next){
  console.log("Find nearest available benefactor for ", req.body);
  var fcm = new FCM(serverKey);

  var message = {
    to: 'ch8_JtJ7TmA:APA91bEH-KWYf1W9iDkyqvoUTegphgkNFtSXXZrQT1bfXMt5HwF8habQcxGQj5bDSROfN0WyCN9f-A5XbZ7lFDZGoi7XZ9Lbgi1cMmgFrIXE8XDzh-ZkWBsERyuouj8QdnB9us7Qw_-Q',
    data: {
      "freeloader": "world",
      "timestamp":
    },
    notification: {
      title: 'New request trip!',
      body: ''
    }
  };
  fcm.send(message, function(err, response){
    if (err) {
        console.log("Something has gone wrong!");
    } else {
        console.log("Successfully sent with response: ", response);
    }
  });

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
*/

core.get('/home',function(req, res, next){
  res.send("¯\\_(ツ)_/¯");
});

module.exports = core;

var express = require('express');
var geolib = require('geolib');
var events = require('events');
var Connection = require('tedious').Connection;
var FCM = require('fcm-push');
var Request = require('tedious').Request
var TYPES = require('tedious').TYPES;
var config = require('../config.json');
var Promise = require('bluebird');
var core = express.Router();
var fcm = new FCM(config.fcmServerKey);


core.post('/putusers', function(req, res, next){
  console.log("New user request called with ", req.body);
  var ret = {};
  var connection = new Connection(config.sqlserver);
  connection.on('connect', function(err) {
    // If no error, then good to proceed.
    console.log("Connected", err);
    let request = new Request("SELECT credits, availability FROM USERS WHERE id=@id", function(err, rowCount){
      if (err){
        console.log(err);
      } else {
        console.log("Done!");
        if (rowCount == 0){
          var newrequest = new Request("INSERT into USERS VALUES(@username,@id,@email,@phone,@token,@availability,@credits)", function(err, rowCount){
            console.log("Inner Error", err);
            if(rowCount != 1){
              res.status(400).json({"Fail":"400"});
            } else {
              res.status(200).json({"credits":'10',"availability":'0'});
            }
          });
          newrequest.addParameter('username',TYPES.VarChar,req.body.username);
          newrequest.addParameter('id',TYPES.VarChar,req.body.id);
          newrequest.addParameter('email',TYPES.VarChar,req.body.email);
          newrequest.addParameter('phone',TYPES.VarChar,req.body.phone);
          newrequest.addParameter('token',TYPES.VarChar,req.body.token);
          newrequest.addParameter('availability',TYPES.Int,0);
          newrequest.addParameter('credits',TYPES.Int,10);
          connection.execSql(newrequest);
        } else {
          console.log("Fetched ", rowCount);
          res.status(200).json(ret);
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
          console.log("Value ",column);
          ret[column.metadata.colName] = column.value;
        };
      });
    });
    console.log("Second", request);
    connection.execSql(request);
  });
});

core.post('/settoken', function(req, res, next){
  console.log("Setting token for ", req.body);
  var connection = new Connection(config.sqlserver);
  connection.on('connect', function(err) {
    // If no error, then good to proceed.
    console.log("Connected", err);
    let request = new Request("UPDATE USERS SET token = @token WHERE id = @id", function(err, rowCount){
      if (err){
        console.log(err);
      } else {
        console.log("Update token for ", req.body.id);
        res.status(200).json({"Status": "Success"});
      };
    });

    request.addParameter('id',TYPES.VarChar,req.body.id);
    request.addParameter('token',TYPES.VarChar,req.body.token);
    connection.execSql(request);
  });
});

core.post('/toggleavailability', function(req, res, next){
  console.log("Updating availability for",req.body);
  ret = {};
  let availability = 0;

  if (req.body.availability == "true") availability = 1;

  console.log("Set availability", availability);
  var connection = new Connection(config.sqlserver);
  connection.on('connect', function(err) {
    // If no error, then good to proceed.
    console.log("Connected", err);
    let request = new Request("UPDATE USERS SET availability = @availability WHERE id = @id OUTPUT UPDATED.*", function(err, rowCount){
      if (err){
        console.log(err);
      } else {
        console.log("Toggled availability!", availability);
        if (availability == 1){
          var newrequest = new Request("INSERT INTO geolocation (id, latitude, longitude, token) SELECT @id,@latitude,@longitude,@token WHERE NOT EXISTS (SELECT * FROM GEOLOCATION WHERE id=@id)", function(err, rowCount){
            console.log("Insert to geolocation err", err);
            if (err){
              res.status(400).json({"Fail":"400"});
            } else {
              res.status(200).json({"Status":"Success"});
            };
          });
          newrequest.addParameter('id',TYPES.VarChar,req.body.id);
          newrequest.addParameter('latitude',TYPES.VarChar,null);
          newrequest.addParameter('longitude',TYPES.VarChar,null);
          newrequest.addParameter('token',TYPES.VarChar, ret['token']);
          connection.execSql(newrequest);
        } else {
          var newrequest2 = new Request("DELETE FROM geolocation WHERE id = @id", function(err, rowCount){
            console.log("Delete from geolocation err", err);
            if (err){
              res.status(400).json({"Fail":"400"});
            } else {
              res.status(200).json({"Status":"Success"});
            };
          });
          newrequest2.addParameter('id',TYPES.VarChar,req.body.id);
          connection.execSql(newrequest2);
        }
      };
    });

    request.addParameter('id',TYPES.VarChar,req.body.id);
    request.addParameter('availability',TYPES.VarChar,availability);
    request.on('row', function(columns){
      columns.forEach(function(column) {
        if (column.value === null) {
          console.log('NULL');
        } else {
          console.log("Value ",column);
          ret[column.metadata.colName] = column.value;
        };
      });
    });
    connection.execSql(request);
  });
});

core.post('/updateposition', function(req, res, next){
  console.log("Updating position for ", req.body);

  var connection = new Connection(config.sqlserver);
  connection.on('connect', function(err) {
    // If no error, then good to proceed.
    console.log("Connected", err);
    let request = new Request("UPDATE geolocation SET latitude = @latitude, longitude = @longitude WHERE id = @id", function(err, rowCount){
      if (err){
        console.log(err);
      } else {
        console.log("Update position for ", req.body.id);
        res.status(200).json({"Status": "Success"});
      };
    });

    request.addParameter('id',TYPES.VarChar,req.body.id);
    request.addParameter('latitude',TYPES.VarChar,req.body.latitude);
    request.addParameter('longitude',TYPES.VarChar,req.body.longitude);
    connection.execSql(request);
  });
});


// TODO Implement using spatial data type in mssql-server
core.push('/sendpickrequest', function(req, res, next){
  console.log("Find nearest available pooler for ", req.body);
  var ret = [];

  var connection = new Connection(config.sqlserver);
  connection.on('connect', function(err) {
    // If no error, then good to proceed.
    console.log("Connected", err);
    let request = new Request("SELECT * FROM geolocation", function(err, rowCount){
      if (err){
        console.log(err);
      } else {
        console.log("Found " + rowCount + " available users.");

        var freeloaderpos = {
          'latitude': req.body.latitude,
          'longitude': req.body.longitude
        };

        for (let key in ret){
          let poolerpos = {
            'latitude': ret[key].latitude,
            'longitude': ret[key].longitude
          }
          ret[key].geoDistance = geolib.getDistance(freeloaderpos, poolerpos);
        };

        ret.sort(helpers.compareFunction);

        // sorted list of users in ret, send push notification here
        for (let key in ret){
          var message = {
            to: ret[key].token,
            data: {
              "freeloader": req.body.id
            },
            notification: {
              title: 'New request trip!',
              body: 'You have a new request from a freeloader!'
            }
          };
          fcm.send(message, function(err, response){
            if (err) {
              console.log("Something has gone wrong!");
            } else {
              console.log("Successfully sent with response: ", response);
            }
          });
        };

        var connection = new Connection(config.sqlserver);
        connection.on('connect', function(err) {
          // If no error, then good to proceed.
          console.log("Connected", err);
          let request = new Request("INSERT into REQUESTS VALUES(@id,@status,@timestamp)", function(err, rowCount){
            if (err){
              console.log(err);
            } else {
              console.log("Created new request entry for ", req.body.id);
              res.status(200).json({"Status": "Success"});
            };
          });

          request.addParameter('id',TYPES.VarChar,req.body.id);
          request.addParameter('status',TYPES.VarChar,'False');
          request.addParameter('timestamp', TYPES.VarChar, Date.now());
          connection.execSql(request);
        });
      };
    });

    request.on('row', function(columns){
      var obj = {};
      columns.forEach(function(column) {
        if (column.value === null) {
          console.log('NULL');
        } else {
          console.log("Value ",column);
          obj[column.metadata.colName] = column.value;
        };
      });
      ret.push(obj);
    });

    request.addParameter('id',TYPES.VarChar,req.body.id);
    request.addParameter('token',TYPES.VarChar,req.body.token);
    connection.execSql(request);
  });
});

core.put('/acceptrequest', function(req, res, next){
  console.log("Accept request from ", req.body);
  var ret = {};
  var connection = new Connection(config.sqlserver);
  connection.on('connect', function(err) {
    // If no error, then good to proceed.
    console.log("Connected", err);
    let request = new Request("SELECT status from REQUESTS WHERE id=@id", function(err, rowCount){
      if (err){
        console.log(err);
      } else {
        if (ret['status'] == "True"){
          console.log("Request already closed.");
          res.status(400).json({"Status":"Request closed"});
        } else {
          var connection = new Connection(config.sqlserver);
          connection.on('connect', function(err) {
            // If no error, then good to proceed.
            console.log("Connected", err);
            let request = new Request("UPDATE REQUESTS SET status = @status WHERE id = @id", function(err, rowCount){
              if (err){
                console.log(err);
              } else {
                console.log("Request accepted by", req.body.id);
                res.status(200).json({"Status": "Success"});
              };
            });
            request.addParameter('id',TYPES.VarChar,req.body.freeloaderid);
            request.addParameter('status', TYPES.VarChar, "True");
            connection.execSql(request);
          });
        }
      };
    });

    request.addParameter('id',TYPES.VarChar,req.body.id);
    console.log(request);
    request.on('row', function(columns){
      columns.forEach(function(column) {
        if (column.value === null) {
          console.log('NULL');
        } else {
          console.log("Value ",column);
          ret[column.metadata.colName] = column.value;
        };
      });
    });
    connection.execSql(request);
  });
});

core.get('/home',function(req, res, next){
  res.send("¯\\_(ツ)_/¯");
});

module.exports = core;

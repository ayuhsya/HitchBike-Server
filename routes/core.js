var express = require('express');
var geolib = require('geolib');
var events = require('events');
var Connection = require('tedious').Connection;
var FCM = require('fcm-push');
var Request = require('tedious').Request
var TYPES = require('tedious').TYPES;
var config = require('../config.json');
var Promise = require('bluebird');
var helpers = require('../helpers');
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
  let availability = 0;

  if (req.body.availability == "true") availability = 1;

  console.log("Set availability", availability);
  var connection = new Connection(config.sqlserver);
  connection.on('connect', function(err) {
    // If no error, then good to proceed.
    console.log("Connected", err);
    let request = new Request("UPDATE USERS SET availability = @availability WHERE id = @id", function(err, rowCount){
      if (err){
        console.log(err);
      } else {
        console.log("Toggled availability!", availability);
        if (availability == 1){
          var newrequest = new Request("INSERT INTO GEOLOCATION (id, latitude, longitude, token) SELECT @id,@latitude,@longitude,@token WHERE NOT EXISTS (SELECT * FROM GEOLOCATION WHERE id=@id)", function(err, rowCount){
            console.log("Insert to GEOLOCATION err", err);
            if (err){
              res.status(400).json({"Fail":"400"});
            } else {
              res.status(200).json({"Status":"Success"});
            };
          });
          newrequest.addParameter('id',TYPES.VarChar,req.body.id);
          newrequest.addParameter('latitude',TYPES.VarChar,null);
          newrequest.addParameter('longitude',TYPES.VarChar,null);
          newrequest.addParameter('token',TYPES.VarChar, req.body.token);
          connection.execSql(newrequest);
        } else {
          var newrequest2 = new Request("DELETE FROM GEOLOCATION WHERE id = @id", function(err, rowCount){
            console.log("Delete from GEOLOCATION err", err);
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
    connection.execSql(request);
  });
});

core.post('/updateposition', function(req, res, next){
  console.log("Updating position for ", req.body);

  var connection = new Connection(config.sqlserver);
  connection.on('connect', function(err) {
    // If no error, then good to proceed.
    console.log("Connected", err);
    let request = new Request("UPDATE GEOLOCATION SET latitude = @latitude, longitude = @longitude WHERE id = @id", function(err, rowCount){
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
core.post('/sendpickrequest', function(req, res, next){
  console.log("Find nearest available pooler for ", req.body);
  var ret = [];

  var connection = new Connection(config.sqlserver);
  connection.on('connect', function(err) {
    // If no error, then good to proceed.
    console.log("Connected", err);
    let request = new Request("SELECT * FROM GEOLOCATION", function(err, rowCount){
      if (err){
        console.log(err);
      } else {
        console.log("Found " + rowCount + " available users.");

        var freeloaderpos = {
          'latitude': req.body.latitude,
          'longitude': req.body.longitude
        };

        console.log("Generated list", ret);

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
              "freeloaderid": req.body.id
            },
            notification: {
              title: 'New trip request!',
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
          let newrequest = new Request("INSERT into REQUESTS VALUES(@id,@status,@timestamp,@otp)", function(err, rowCount){
            if (err){
              console.log(err);
            } else {
              console.log("Created new request entry for ", req.body.id);


              var counter = 4;
              function makeRequest() {
                var connection = new Connection(config.sqlserver);
                var status = "";
                connection.on('connect', function(err) {
                  // If no error, then good to proceed.
                  console.log("Connected", err);
                  let _newrequest = new Request("SELECT status from REQUESTS WHERE id=@id", function(err, rowCount){
                    if (err){
                      console.log(err);
                    } else {
                      if(status == "true"){
                        var OTP = Math.floor((Math.random() * 10000) + 1);

                        var connection = new Connection(config.sqlserver);
                        connection.on('connect', function(err) {
                          // If no error, then good to proceed.
                          console.log("Connected", err);
                          let _request = new Request("UPDATE REQUESTS SET otp = @otp WHERE id = @id", function(err, rowCount){
                            if (err){
                              console.log(err);
                            } else {
                              console.log("OTP generated ", req.body.id);
                              res.status(200).json({"OTP": OTP});
                            };
                          });

                          _request.addParameter('id',TYPES.VarChar,req.body.id);
                          _request.addParameter('otp',TYPES.Int,OTP);


                          connection.execSql(_request);
                        });
                      } else {
                        console.log("No accepts yet.");
                      }
                    };
                  });
                  _newrequest.addParameter('id',TYPES.VarChar,req.body.id);
                  request.on('row', function(columns){
                    var obj = {};
                    columns.forEach(function(column) {
                      if (column.value === null) {
                        console.log('NULL');
                      } else {
                        console.log("Value ",column);
                        status = column.value;
                      };
                    });
                  });

                  connection.execSql(_newrequest);
                });
              };

              function myFunction() {
                makeRequest();
                counter--;
                if (counter > 0) {
                    setTimeout(myFunction, 15000);
                }
              }

              myFunction();
            };
          });

          newrequest.addParameter('id',TYPES.VarChar,req.body.id);
          newrequest.addParameter('status',TYPES.VarChar,'False');
          newrequest.addParameter('timestamp', TYPES.VarChar, Date.now());
          newrequest.addParameter('otp', TYPES.Int, null);
          connection.execSql(newrequest);
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
    connection.execSql(request);
  });
});

core.post('/acceptrequest', function(req, res, next){
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

core.post('/verifyotp', function(res, req, next){
  console.log("Verifying OTP for ", req.body);
  var ret = {};
  var connection = new Connection(config.sqlserver);
  connection.on('connect', function(err) {
    // If no error, then good to proceed.
    console.log("Connected", err);
    let request = new Request("SELECT otp FROM REQUESTS id = @id", function(err, rowCount){
      if (err){
        console.log(err);
      } else {
        if (ret['otp'] == req.body.otp){
          var connection2 = new Connection(config.sqlserver);
          connection2.on('connect', function(err) {
            // If no error, then good to proceed.
            console.log("Connected", err);
            let request2 = new Request("DELETE FROM REQUESTS WHERE id = @id", function(err, rowCount){
              if (err){
                console.log(err);
              } else {
                console.log("OTP verified by", req.body.id);
                res.status(200).json({"Status": "Success"});
              };
            });
            request2.addParameter('id',TYPES.VarChar,req.body.freeloaderid);
            connection.execSql(request2);
          });
        } else {
          console.log("OTP not verified!");
          res.status(400).json({"Status": "Fail"});
        }
      };
    });
    request.addParameter('id',TYPES.VarChar,req.body.freeloaderid);
    request.on('row', function(columns){
      var obj = {};
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

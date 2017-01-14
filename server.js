var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.json())

var port = process.env.PORT || 3000;
app.listen(port);

var core = require('./routes/core');
app.use('/',core);

console.log("HitchBike running on ", port);

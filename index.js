var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var config = require('config')['production'];
app.use(bodyParser.json())

app.listen(config.port);

var core = require('./routes/core');
app.use('/',core);

console.log("HitchBike running on ", config.port);

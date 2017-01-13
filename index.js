var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.json())

app.listen(3000);

var core = require('./routes/core');
app.use('/',core);

console.log("HitchBike running on 3000.");

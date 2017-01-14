var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.json())

app.listen(process.env.PORT || 3000);

var core = require('./routes/core');
app.use('/',core);

console.log("HitchBike running on ", config.port);

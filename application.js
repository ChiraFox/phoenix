'use strict';

var express = require('express');
var routes = require('./routes');

var app = express();

// You’ll need to be using Nginx for static files regardless
app.enable('trust proxy');

// Enforce proper links in development
if (app.get('env') === 'development') {
	app.enable('case sensitive routing');
	app.enable('strict routing');
}

// Cookie-based CSRF tokens and sessions
app.use(require('./lib/cookie-parser').middleware);
app.use(require('./lib/form-session').middleware);

// Routes
app.use('/', routes.general);
app.use('/', routes.authentication);
app.use('/submissions/', routes.submissions);
app.use('/', routes.users);

module.exports = app;

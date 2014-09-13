'use strict';

var express = require('express');
var controllers = require('./controllers');
var promiseResponse = require('./lib/promise-response');

var app = express();

// You’ll need to be using Nginx for static files regardless
app.enable('trust proxy');

// Enforce proper links in development
if (app.get('env') === 'development') {
	app.enable('case sensitive routing');
	app.enable('strict routing');
}

app.disable('x-powered-by');

// Cookie-based CSRF tokens and sessions
app.use(require('./lib/cookie-parser').middleware);
app.use(require('./lib/form-session').middleware);

// Routes
app.get('/', promiseResponse.html(controllers.general.home));

app.get('/support/terms', promiseResponse.html(controllers.general.terms));
app.get('/support/submission-agreement', promiseResponse.html(controllers.general.submissionAgreement));
app.get('/support/acceptable-upload-policy', promiseResponse.html(controllers.general.aup));

app.route('/login')
	.get(promiseResponse.html(controllers.authentication.loginForm))
	.post(promiseResponse.html(controllers.authentication.login));

app.route('/logout')
	.post(promiseResponse.html(controllers.authentication.logout));

app.get('/submissions/upload', promiseResponse.html(controllers.submissions.uploadForm));
app.get('/submissions/new', promiseResponse.html(controllers.submissions.createForm));

app.post('/submissions/', promiseResponse.html(controllers.submissions.create));
app.post('/submissions/media/', promiseResponse.html(controllers.submissions.upload));

app.get('/users/:username/', promiseResponse.html(controllers.users.homepage));

module.exports = app;

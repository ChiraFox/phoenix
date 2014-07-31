'use strict';

var app = require('./application');
var rateLimit = require('./lib/rate-limit');

rateLimit.clear().done();

var server = app.listen(
	process.env.BIND || 3000,
	process.env.HOST || '::1'
);

process.once('SIGINT', function () {
	server.close(function () {
		process.exit(0);
	});
});

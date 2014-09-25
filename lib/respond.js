'use strict';

var _ = require('lodash');
var util = require('util');
var url = require('url');

function Response() {
}

Response.prototype.respond = function respond() {
	throw new Error('Response.prototype.respond shouldn’t be called.');
};

var defaultRedirect = url.parse('/');

function Redirect(path, statusCode) {
	var redirectTo;

	if (path && (redirectTo = url.parse(path)).hostname === null) {
		this.redirectTo = redirectTo;
	} else {
		this.redirectTo = defaultRedirect;
	}

	this.statusCode = statusCode || Redirect.DEFAULT;
}

util.inherits(Redirect, Response);

Redirect.MULTIPLE_CHOICES   = 300;
Redirect.MOVED_PERMANENTLY  = 301;
Redirect.FOUND              = 302;
Redirect.SEE_OTHER          = 303;
Redirect.TEMPORARY_REDIRECT = 307;
Redirect.PERMANENT_REDIRECT = 308;
Redirect.DEFAULT = Redirect.FOUND;

Redirect.prototype.respond = function respond(request, response) {
	var redirectTo = _.clone(this.redirectTo);
	redirectTo.protocol = request.headers['x-forwarded-protocol'];
	redirectTo.host = request.headers.host;

	var redirectUrl = url.format(redirectTo);

	response.writeHead(this.statusCode, { Location: redirectUrl, 'Content-Type': 'text/plain; charset=utf-8' });
	response.end(redirectUrl);
};

function AlreadyResponded() {
}

util.inherits(AlreadyResponded, Response);

AlreadyResponded.prototype.respond = function respond() {
};

exports.Response = Response;
exports.Redirect = Redirect;
exports.AlreadyResponded = AlreadyResponded;

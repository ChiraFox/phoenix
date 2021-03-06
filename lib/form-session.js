'use strict';

var Promise = require('bluebird');
var util = require('util');
var assert = require('assert');
var crypto = require('crypto');
var querystring = require('querystring');
var Busboy = require('busboy');
var unit = require('./unit');
var db = require('./db');
var media = require('../models/media');
var users = require('../models/users');
var config = require('../config');

Promise.promisifyAll(crypto);

assert(config.session.key, 'session key should exist');

var sessionKey = new Buffer(config.session.key, 'base64');
var guestMaxAge = unit.Interval.parse(config.session.guestMaxAge).seconds;
var userMaxAge = unit.Interval.parse(config.session.userMaxAge).seconds;
var maximumFormSize = unit.ByteSize.parse(config.maximumFormSize).bytes;

assert(sessionKey.length, 'session key shouldn’t be empty');
assert(maximumFormSize, 'maximum form size should be non-zero');

var guestUser = new users.Guest();

function sign(sessionId) {
	var hmac = crypto.createHmac('sha256', sessionKey);

	hmac.update(sessionId);

	return hmac.digest('base64');
}

function checkToken(token) {
	if (!token) {
		return {
			valid: false
		};
	}

	var separatorIndex = token.indexOf(':');
	var sessionId = token.substring(0, separatorIndex);
	var expectedDigest = token.substring(separatorIndex + 1);
	var valid = sign(sessionId) === expectedDigest;

	return {
		valid: valid,
		token: expectedDigest,
		sessionId: valid ? sessionId | 0 : null
	};
}

function createGuestToken() {
	return crypto.randomBytesAsync(9).then(function (bytes) {
		return 'g' + bytes.toString('base64');
	});
}

function createUserSession(userId, response) {
	return db.query('INSERT INTO sessions (owner) VALUES ($1) RETURNING id', [userId]).then(function (result) {
		var sessionId = result.rows[0].id;

		var secure = response.req.headers['x-forwarded-protocol'] !== 'http';

		response.setHeader('Set-Cookie',
			util.format(
				't=%d:%s; Max-Age=%d; Path=/; %s HttpOnly',
				sessionId, sign('' + sessionId), userMaxAge, secure ? 'Secure;' : ''
			)
		);
	});
}

function formData(request) {
	var expectedToken = request.token;

	if (request.headers['content-type'] !== 'application/x-www-form-urlencoded') {
		var error = new Error('Unexpected Content-Type ' + request.headers['content-type'] + '.');
		error.statusCode = 415;

		return Promise.reject(error);
	}

	return new Promise(function (resolve, reject) {
		var parts = [];
		var totalLength = 0;

		function addPart(part) {
			totalLength += part.length;

			if (totalLength > maximumFormSize) {
				request.removeListener('data', addPart);
				request.removeListener('end', parseFormData);

				reject({
					statusCode: 413,
					message: 'The submitted data exceeded the maximum allowed size.'
				});

				return;
			}

			parts.push(part);
		}

		function parseFormData() {
			var body = Buffer.concat(parts, totalLength).toString('utf8');
			var data = querystring.parse(body);

			if (data.token !== expectedToken) {
				reject({
					statusCode: 403,
					message: 'Your request was made with an unexpected token; please go back, refresh, and try again.'
				});

				return;
			}

			resolve(data);
		}

		request.on('data', addPart);
		request.on('end', parseFormData);
	});
}

function formFiles(expectedFiles, request) {
	var expectedToken = request.token;

	var contentType = request.headers['content-type'];

	if (!contentType || contentType.split(';')[0] !== 'multipart/form-data') {
		var error = new Error('Unexpected Content-Type ' + contentType + '.');
		error.statusCode = 415;

		return Promise.reject(error);
	}

	var busboy = new Busboy({ headers: request.headers });

	var fields = {};
	var files = {};

	Object.keys(expectedFiles).forEach(function (key) {
		files[key] = Promise.resolve(null);
	});

	function addField(name, value) {
		fields[name] = value;
	}

	function addFile(name, stream) {
		if (!Object.prototype.hasOwnProperty.call(expectedFiles, name)) {
			stream.resume();
			return;
		}

		files[name] = media.upload(stream);
	}

	busboy.on('field', addField);
	busboy.on('file', addFile);

	return new Promise(function (resolve, reject) {
		busboy.on('finish', function finish() {
			if (fields.token === expectedToken) {
				resolve({
					fields: fields,
					files: files
				});
			} else {
				reject({
					statusCode: 403,
					message: 'Your request was made with an unexpected token; please go back, refresh, and try again.'
				});
			}
		});

		request.pipe(busboy);
	});
}

function createNewSession(response) {
	return createGuestToken().then(function (newToken) {
		var secure = response.req.headers['x-forwarded-protocol'] !== 'http';

		response.setHeader('Set-Cookie',
			util.format(
				't=%s:%s; Max-Age=%d; Path=/; %s HttpOnly',
				newToken, sign(newToken), guestMaxAge, secure ? 'Secure;' : ''
			)
		);

		return newToken;
	});
}

function removeSession(sessionId) {
	return db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

function middleware(request, response, next) {
	function nextWithNewSession() {
		return createNewSession(response).then(function (newToken) {
			request.token = newToken;
			request.user = guestUser;
		});
	}

	var token = checkToken(request.cookies.t);

	if (!token.valid) {
		nextWithNewSession().done(next, next);
		return;
	}

	request.token = token.token;
	request.sessionId = token.sessionId;

	if (!token.sessionId) {
		request.user = guestUser;
		next();
		return;
	}

	db.query('SELECT sessions.owner, users.username FROM sessions INNER JOIN users ON users.id = sessions.owner WHERE sessions.id = $1', [token.sessionId])
		.then(function (result) {
			var session = result.rows[0];

			if (!session) {
				return nextWithNewSession().then(next);
			}

			request.user = new users.User(session.owner, session.username);
		})
		.done(next, next);
}

exports.middleware = middleware;
exports.createNewSession = createNewSession;
exports.createUserSession = createUserSession;
exports.removeSession = removeSession;
exports.formData = formData;
exports.formFiles = formFiles;

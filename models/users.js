'use strict';

var Promise = require('bluebird');
var util = require('util');
var assert = require('assert');
var db = require('../lib/db');
var bcrypt = require('bcrypt');
var config = require('../config');

Promise.promisifyAll(bcrypt);

var bcryptRounds = config.password.bcryptRounds;

assert((bcryptRounds | 0) === bcryptRounds, 'password.bcryptRounds should be an integer');

function Privileged() {
}

Privileged.prototype.ensure = function (privilege) {
	var methodName = 'ensureCan' + privilege.charAt(0).toUpperCase() + privilege.substring(1);

	if (methodName in this) {
		return this[methodName]();
	}

	return Promise.reject();
};

function User(id, username) {
	this.id = id;
	this.username = username;
}

util.inherits(User, Privileged);

User.prototype.ensureCanSubmit = function () {
	return Promise.resolve();
};

function Guest() {
}

util.inherits(Guest, Privileged);

function authenticate(credentials) {
	var username = credentials.username;
	var password = credentials.password;

	if (!username || !password) {
		return Promise.resolve({ failureType: username ? 'password' : 'username' });
	}

	return db.query('SELECT id, password_hash FROM users WHERE username = $1', [username]).then(function (result) {
		var user = result.rows[0];

		if (!user) {
			return { failureType: 'username' };
		}

		return bcrypt.compareAsync(password, user.password_hash).then(function (match) {
			return match ? { userId: user.id } : { failureType: 'password' };
		});
	});
}

function create(credentials) {
	var username = credentials.username;
	var password = credentials.password;

	if (!username) {
		return Promise.reject(new Error('A username is required.'));
	}

	if (!password) {
		return Promise.reject(new Error('A password is required.'));
	}

	return bcrypt.hashAsync(password, bcryptRounds).then(function (hash) {
		return db.query('INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id', [username, hash]);
	}).then(function (result) {
		return result.rows[0].id;
	});
}

function ensure(privilege) {
	return function ensuresPrivilege(request) {
		return request.user.ensure(privilege).catch(function () {
			var error = new Error('Access requires ' + privilege + ' privilege.');
			error.statusCode = 403;

			return Promise.reject(error);
		});
	};
}

function byUsername(username) {
	return db.query('SELECT id, username, registered, full_name, artist_type, current_mood, profile_text, views FROM users WHERE username = $1', [username]).then(function (result) {
		if (result.rows.length !== 1) {
			return Promise.reject(new Error('A user with the given username does not exist.'));
		}

		return result.rows[0];
	});
}

function byUsernameParameter(request) {
	return byUsername(request.params.username).then(function (user) {
		return { user: user };
	});
}

exports.Privileged = Privileged;
exports.User = User;
exports.Guest = Guest;
exports.authenticate = authenticate;
exports.create = create;
exports.ensure = ensure;
exports.byUsername = byUsername;
exports.byUsernameParameter = byUsernameParameter;

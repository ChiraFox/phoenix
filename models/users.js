'use strict';

var Promise = require('bluebird');
var util = require('util');
var assert = require('assert');
var db = require('../lib/db');
var bcrypt = require('bcrypt');
var config = require('../config');

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

		return new Promise(function (resolve, reject) {
			bcrypt.compare(password, user.password_hash, function (error, match) {
				if (error) {
					reject(error);
					return;
				}

				resolve(match ? { userId: user.id } : { failureType: 'password' });
			});
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

	return new Promise(function (resolve, reject) {
		bcrypt.hash(password, bcryptRounds, function (error, hash) {
			if (error) {
				reject(error);
				return;
			}

			db.query('INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id', [username, hash]).then(
				function (result) {
					resolve(result.rows[0].id);
				},
				reject
			);
		});
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

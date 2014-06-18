'use strict';

var Promise = require('bluebird');
var util = require('util');
var assert = require('assert');
var db = require('../lib/db');
var bcrypt = require('bcrypt');
var config = require('../config');
var _ = require('lodash');

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

var userFieldTypes = {
	'COUNT':        'COUNT(id)', // You will get a number back instead of an object
	'ID':           'id',
	'USERNAME':     'username',
	'REGISTERED':   'registered',
	'FULL_NAME':    'full_name',
	'ARTIST_TYPE':  'artist_type',
	'CURRENT_MOOD': 'current_mood',
	'PROFILE_TEXT': 'profile_text',
	'VIEWS':        'views'
};


// Excludes password hash, because security!
var validUserDataFields = {
	'COUNT(id)':    true,
	'id':           true,
	'username':     true,
	'registered':   true,
	'full_name':    true,
	'artist_type':  true,
	'current_mood': true,
	'profile_text': true,
	'views':        true
};

/**
 *
 * @param {(User|string)} username
 * @param {Array} fields - Names of fields in the users table to query.
 * @returns {*}
 */
function getUserData(username, fields) {
	if (!username) {
		return Promise.resolve(null);
	}

	// Check for type of input
	var queryMatch = null;
	if (typeof username === 'string') {
		queryMatch = 'username';
	} else if (username instanceof User) {
		if (username.id) {
			// Bonus for a primary key lookup
			queryMatch = 'id';
			username = username.id;
		} else if (username.username) {
			queryMatch = 'username';
			username = username.username;
		}
	}

	// Make sure the input is legit.
	if (!queryMatch) {
		return Promise.resolve(null);
	}

	// Filter out invalid field names, because no hax plz.
	var stringFields = _.select(fields, function (field) {
		return validUserDataFields[field] || false;
	}).join(',');

	var queryString = 'SELECT ' + stringFields + ' FROM users WHERE ' + queryMatch + ' = $1';
	return db.query(queryString, [username]).then(function (result) {
		if (!result) {
			return null;
		}
		var data = result.rows[0];

		if (!data) {
			return null;
		} else {
			return data;
		}
	});
}

/**
 * Get data for FA userpage
 * @param {(User|string)} username
 * @returns {Promise} - Promise returns null or { id, username, registered, full_name, artist_type, current_mood, profile_text, views }
 */
function homepageData(username) {
	return getUserData(username, [
		userFieldTypes.ID,
		userFieldTypes.USERNAME,
		userFieldTypes.REGISTERED,
		userFieldTypes.FULL_NAME,
		userFieldTypes.ARTIST_TYPE,
		userFieldTypes.CURRENT_MOOD,
		userFieldTypes.PROFILE_TEXT,
		userFieldTypes.VIEWS
	]);
}

function exists(username) {
	return getUserData(username, [
		userFieldTypes.COUNT
	]).then(function (result) {
		return !!result;
	});
}

function basicData(username) {
	return getUserData(username, [
		userFieldTypes.ID,
		userFieldTypes.USERNAME,
		userFieldTypes.FULL_NAME
	]);
}

exports.Privileged = Privileged;
exports.User = User;
exports.Guest = Guest;
exports.authenticate = authenticate;
exports.create = create;
exports.ensure = ensure;
exports.exists = exists;
exports.basicData = basicData;
exports.homepageData = homepageData;
exports.getData = getUserData;
exports.FIELDS = userFieldTypes;

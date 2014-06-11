'use strict';

var Promise = require('bluebird');

exports.base = 'sessions';

exports.up = function (query) {
	return Promise.resolve()
		.then(query(
			"CREATE TABLE media (\
				id SERIAL PRIMARY KEY,\
				hash VARCHAR(64) NOT NULL UNIQUE\
			)"
		))
		.then(query(
			"CREATE TABLE user_media (\
				owner INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,\
				media INTEGER NOT NULL REFERENCES media (id),\
				name VARCHAR,\
				PRIMARY KEY (owner, media)\
			)"
		));
};

exports.down = function (query) {
	return Promise.resolve()
		.then(query("DROP TABLE user_media"))
		.then(query("DROP TABLE media"));
};

'use strict';

var Promise = require('bluebird');

exports.base = 'submission-media';

exports.up = function (query) {
	return Promise.resolve()
		.then(query(
			"ALTER TABLE submissions ADD thumbnail INTEGER REFERENCES media (id)"
		));
};

exports.down = function (query) {
	return Promise.resolve()
		.then(query("ALTER TABLE submissions DROP thumbnail"));
};

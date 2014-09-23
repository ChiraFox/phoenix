'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var pg = require('pg');
var config = require('../config');
var slice = Array.prototype.slice;

Promise.promisifyAll(pg);
Promise.promisifyAll(pg.Client.prototype);

var connectionString = config.database;

function useClient() {
	var done;

	return pg.connectAsync(connectionString).spread(function (client, done_) {
		done = done_;
		return client;
	}).disposer(function () {
		if (done) {
			done();
		}
	});
}

function query() {
	var args = slice.call(arguments);

	return Promise.using(useClient(), function (client) {
		return client.queryAsync.apply(client, args);
	});
}

function transaction(client, callback) {
	return client
		.queryAsync('BEGIN')
		.then(callback)
		.then(
			function (result) {
				var originalResolve = _.constant(result);

				return client.queryAsync('COMMIT').then(originalResolve, originalResolve);
			},
			function (error) {
				var originalReject = _.constant(Promise.reject(error));

				return client.queryAsync('ROLLBACK').then(originalReject, originalReject);
			}
		);
}

exports.useClient = useClient;
exports.query = query;
exports.transaction = transaction;
exports.pg = pg;

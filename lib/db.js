'use strict';

var Promise = require('bluebird');
var pg = require('pg');
var config = require('../config');
var slice = Array.prototype.slice;

var connectionString = config.database;

function query() {
	var args = slice.call(arguments);

	return new Promise(function (resolve, reject) {
		pg.connect(connectionString, function (error, client, done) {
			if (error) {
				reject(error);
				return;
			}

			function callback(error, result) {
				done();

				if (error) {
					reject(error);
					return;
				}

				resolve(result);
			}

			client.query.apply(client, args.concat(callback));
		});
	});
}

function useClient() {
	return new Promise(function (resolve, reject) {
		pg.connect(connectionString, function (error, client, done) {
			if (error) {
				reject(error);
				return;
			}

			resolve({
				query: function query(queryString, parameters) {
					return new Promise(function (resolve, reject) {
						client.query(queryString, parameters, function (error, result) {
							if (error) {
								reject(error);
								return;
							}

							resolve(result);
						});
					});
				},
				done: done
			});
		});
	});
}

exports.query = query;
exports.useClient = useClient;
exports.pg = pg;

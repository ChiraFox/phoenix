'use strict';

var Promise = require('bluebird');
var redis = require('redis');
var client = redis.createClient();

var slice = Array.prototype.slice;

function wrap(method) {
	return function () {
		var args = slice.call(arguments);

		return new Promise(function (resolve, reject) {
			args.push(function (error, result) {
				if (error) {
					reject(error);
				} else {
					resolve(result);
				}
			});

			method.apply(client, args);
		});
	};
}

client.on('error', console.error);

exports.client = client;
exports.hmget = wrap(client.hmget);
exports.hincrby = wrap(client.hincrby);

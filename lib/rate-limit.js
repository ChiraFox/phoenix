'use strict';

var Interval = require('./unit').Interval;
var redis = require('./redis');

var alreadyResponded = new (require('./respond').AlreadyResponded)();

function byAddress(count, interval_, action, identifier) {
	var key = 'rate:' + identifier;
	var interval = Interval.parse(interval_).seconds * 1000;

	var timers = {};

	return function rateLimited(request, response) {
		var remoteAddr = request.headers['x-forwarded-for'];

		if (!remoteAddr) {
			return action(request, response);
		}

		redis.saddAsync('rate_limits', key);

		return redis.hincrbyAsync(key, remoteAddr, 1).then(function (value) {
			if (value > count) {
				response.writeHead(429, { 'Content-Type': 'text/plain' });
				response.end('Slow down!');
				return alreadyResponded;
			}

			if (timers.hasOwnProperty(remoteAddr)) {
				clearTimeout(timers[remoteAddr]);
			}

			timers[remoteAddr] = setTimeout(function () {
				delete timers[remoteAddr];
				redis.hsetAsync(key, remoteAddr, 0);
			}, interval);

			return action(request, response);
		});
	};
}

function clear() {
	return redis.smembersAsync('rate_limits').then(function (rateLimitKeys) {
		if (!rateLimitKeys.length) {
			return;
		}

		return redis.sremAsync('rate_limits', rateLimitKeys).then(function () {
			return redis.delAsync(rateLimitKeys);
		});
	});
}

exports.byAddress = byAddress;
exports.clear = clear;

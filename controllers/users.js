'use strict';

var view = require('../lib/view').view;
var notifications = require('../models/notifications');
var users = require('../models/users');

var homepageRenderer = view('users/homepage', [notifications.counts]);
var notFoundRenderer = view('users/notfound', [notifications.counts]);

function homepage(request) {
	return users.homepageData(request.params.username).then(function (userData) {
		if (!userData) {
			return notFoundRenderer(request);
		} else {
			// Extra queries here

			// Call with providing extra model data. Call returned, extended template with request finally
			return homepageRenderer.with({ userInfo: userData })(request);
		}
	});
}

exports.homepage = homepage;

'use strict';

var formSession = require('../lib/form-session');
var Redirect = require('../lib/respond').Redirect;
var rateLimit = require('../lib/rate-limit');
var view = require('../lib/view').view;
var models = require('../models');
var notifications = require('../models/notifications');

var loginForm = view('login', [notifications.counts]);

function login(request, response) {
	return formSession.formData(request).then(function (form) {
		return models.User.authenticate(form).then(function (result) {
			if (!result.userId) {
				return loginForm.with({
					failureType: result.failureType,
					username: form.username,
					password: form.password,
					returnTo: form.return_to
				})(request);
			}

			return formSession.createUserSession(result.userId, response).then(function () {
				return new Redirect(form.return_to, Redirect.SEE_OTHER);
			});
		});
	});
}

function logout(request, response) {
	return formSession.formData(request).then(function () {
		var redirect = new Redirect('/', Redirect.SEE_OTHER);

		if (!request.user.id) {
			return redirect;
		}

		return formSession.removeSession(request.sessionId)
			.then(function () {
				return formSession.createNewSession(response);
			})
			.then(function () {
				return redirect;
			});
	});
}

exports.loginForm = loginForm;
exports.login = rateLimit.byAddress(30, '10 minutes', login, 'login');
exports.logout = logout;

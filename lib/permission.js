'use strict';

var assert = require('assert');
var Redirect = require('./respond').Redirect;

function requirePermission(permission, controller) {
	assert(typeof permission === 'function', 'permission should be a function');

	return function restricted(request) {
		return permission(request.user).then(
			function permitted() {
				return controller(request);
			},
			function denied() {
				// TODO: Drain upload streams and move necessary POST parameters to GET
				// TODO: Display message instead of redirecting depending on permission and reason for rejection
				return new Redirect('/login?return_to=' + encodeURIComponent(request.url));
			}
		);
	};
}

exports.require = requirePermission;

exports.submit = function (user) {
	return user ? Promise.resolve() : Promise.reject();
};

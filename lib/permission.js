'use strict';

var Redirect = require('./respond').Redirect;

function requirePermission(permission, controller) {
	return function restricted(request) {
		return request.user.ensure(permission).then(
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

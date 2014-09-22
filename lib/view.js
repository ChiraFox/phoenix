'use strict';

var Promise = require('bluebird');
var path = require('path');
var razorleaf = require('razorleaf');

var templateLoader = new razorleaf.DirectoryLoader(path.join(__dirname, '../templates'), {
	globals: require('./template-utilities')
});

function view(templateName, callbacks) {
	var template = templateLoader.load(templateName);

	return (function createRenderer(additionalDataSets) {
		function renderer(request) {
			var on = callbacks.map(function (callback) {
				return callback(request);
			});

			return Promise.all(on).then(function (dataSets) {
				var result = {
					token: request.token,
					requester: request.user,
					query: request.query
				};

				function addDataSet(data) {
					for (var k in data) {
						if (data.hasOwnProperty(k)) {
							result[k] = data[k];
						}
					}
				}

				dataSets.forEach(addDataSet);
				additionalDataSets.forEach(addDataSet);

				return template(result);
			});
		}

		renderer.with = function withDataSet(dataSet) {
			return createRenderer(additionalDataSets.concat([dataSet]));
		};

		return renderer;
	})([]);
}

exports.templateLoader = templateLoader;
exports.view = view;

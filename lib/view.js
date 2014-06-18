'use strict';

var Promise = require('bluebird');
var path = require('path');
var razorleaf = require('razorleaf');

function pluralize(num, pluralSuffix, singularSuffix) {
	if (num === 1) {
		return singularSuffix || '';
	}

	return pluralSuffix == null ? 's' : pluralSuffix;
}

var templateLoader = new razorleaf.DirectoryLoader(path.join(__dirname, '../templates'), {
	globals: {
		s: pluralize,
		ByteSize: require('./unit').ByteSize
	}
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
					user: request.user,
					query: request.query,
					params: request.params
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

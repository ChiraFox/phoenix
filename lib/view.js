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
  // Create template, basic template from source without model data
	var template = templateLoader.load(templateName);

  // Generate the renderer
	return (function createRenderer(additionalDataSets) {
		function renderer(request) {
      // Iterate through all the data callbacks first
			var on = callbacks.map(function (callback) {
				return callback(request);
			});

      // Then populate the model from the data
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

        // Return the template populated data
				return template(result);
			});
		}

    // Same thing as renderer, except with the option to provide even more model data.
		renderer.with = function withDataSet(dataSet) {
			return createRenderer(additionalDataSets.concat([dataSet]));
		};

		return renderer;
	})([]);
}

exports.templateLoader = templateLoader;
exports.view = view;

'use strict';

var Promise = require('bluebird');
var util = require('util');
var formSession = require('../lib/form-session');
var permission = require('../lib/permission');
var Redirect = require('../lib/respond').Redirect;
var view = require('../lib/view').view;
var unit = require('../lib/unit');
var slug = require('../lib/slug');
var notifications = require('../models/notifications');
var media = require('../models/media');
var tags = require('../models/tags');
var submissions = require('../models/submissions');
var config = require('../config');

var maximumThumbnailSize = unit.ByteSize.parse(config.maximumThumbnailSize).bytes;

function toInteger(obj) {
	return obj | 0;
}

function validId(n) {
	return n > 0;
}

var uploadForm = permission.require('submit', view('submissions/upload', [notifications.counts]));
var createForm = permission.require('submit', view('submissions/edit', [tags.mostCommonTagsForRequester, media.forRequest, notifications.counts]));

var upload = permission.require('submit', function upload(request) {
	return formSession.formFiles(request).then(function (form) {
		return new Promise(function (resolve) {
			var uploadHash = null;

			form.on('file', function processFile(name, file) {
				if (name !== 'file') {
					file.stream.resume();
					return;
				}

				form.removeListener('file', processFile);

				uploadHash = media.upload(file.stream);
			});

			form.on('finish', function () {
				resolve(Promise.resolve(uploadHash).then(function (hexDigest) {
					if (!hexDigest || hexDigest === media.EMPTY_UPLOAD) {
						return new Redirect('/submissions/upload');
					}

					return new Redirect('/submissions/new?submit=' + hexDigest, Redirect.SEE_OTHER);
				}));
			});
		});
	});
});

var create = permission.require('submit', function create(request) {
	return formSession.formFiles(request).then(function (form) {
		return new Promise(function (resolve) {
			var thumbnail = null;

			form.on('file', function (name, file) {
				var stream = file.stream;

				if (name === 'thumbnail') {
					var parts = [];
					var totalLength = 0;

					stream.on('data', function addPart(part) {
						totalLength += part.length;

						if (totalLength >= maximumThumbnailSize) {
							totalLength = 0;
							parts = null;
							stream.removeListener('data', addPart);
							return;
						}

						parts.push(part);
					});

					stream.on('end', function () {
						if (totalLength) {
							var data = Buffer.concat(parts, totalLength);

							thumbnail = media.autoThumbnail(data);
						}
					});

					return;
				}

				stream.resume();
			});

			form.on('finish', function () {
				var submit = form.fields.media;
				var submitMedia = Array.isArray(submit) ? submit.map(toInteger) : [submit | 0];

				if (!submitMedia.every(validId)) {
					resolve(new Redirect('/submissions/new'));
					return;
				}

				if (thumbnail) {
					thumbnail = thumbnail.then(function (thumbnailData) {
						return media.createUploadStream().then(function (thumbnailStream) {
							thumbnailStream.end(thumbnailData);

							return thumbnailStream.uploaded;
						});
					});
				} else {
					thumbnail = Promise.resolve(null);
				}

				resolve(Promise.all(submitMedia.map(function (mediaId) {
					return media.owns(request.user, mediaId);
				})).then(function (ownsMedia) {
					if (!ownsMedia.every(Boolean)) {
						return Promise.reject(new Error('A specified media entry does not exist or is not available to the user.'));
					}

					return thumbnail.then(function (thumbnailId) {
						return submissions.create({
							owner: request.user.id,
							thumbnail: thumbnailId,
							title: form.fields.title,
							description: form.fields.description,
							rating: form.fields.rating,
							tags: form.fields.tags
						}).then(function (submissionId) {
							return Promise.all(submitMedia.map(function (mediaId) {
								return media.associateWithSubmission(mediaId, submissionId);
							})).then(function () {
								return new Redirect(util.format('/submissions/%d/%s', submissionId, slug.slugFor(form.fields.title)));
							});
						});
					});
				}));
			});
		});
	});
});

exports.uploadForm = uploadForm;
exports.createForm = createForm;
exports.upload = upload;
exports.create = create;

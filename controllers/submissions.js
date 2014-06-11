'use strict';

var Promise = require('bluebird');
var util = require('util');
var querystring = require('querystring');
var formSession = require('../lib/form-session');
var Redirect = require('../lib/respond').Redirect;
var view = require('../lib/view').view;
var unit = require('../lib/unit');
var slug = require('../lib/slug');
var notifications = require('../models/notifications');
var users = require('../models/users');
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

var uploadForm = view('submissions/upload', [users.ensure('submit'), media.listForRequester, notifications.counts]);
var createForm_ = view('submissions/edit', [users.ensure('submit'), tags.mostCommonTagsForRequester, notifications.counts]);

function createForm(request) {
	var submit = request.query.submit;
	var submitMedia = Array.isArray(submit) ? submit.map(toInteger) : [submit | 0];

	if (!submitMedia.every(validId)) {
		return Promise.resolve(new Redirect('/submissions/new'));
	}

	return createForm_.with({ media: submitMedia })(request);
}

function upload(request) {
	return request.user.ensure('submit')
		.then(
			function () {
				return formSession.formFiles(request).then(function (form) {
					return new Promise(function (resolve, reject) {
						var fileCount = 0;
						var files = [];

						form.on('file', function (name, file) {
							media.createUploadStream()
								.then(function (uploadStream) {
									var empty = true;

									file.stream.pipe(uploadStream);

									file.stream.once('data', function () {
										fileCount++;
										empty = false;
									});

									files.push(
										uploadStream.uploaded.then(function (mediaId) {
											return empty ? null : media.associate(request.user, mediaId, file.filename);
										})
									);
								})
								.catch(reject);
						});

						form.on('finish', function () {
							if (!fileCount) {
								uploadForm(request).then(resolve).catch(reject);
								return;
							}

							Promise.all(files)
								.then(function (associatedIds) {
									var redirectTo = '/submissions/new?' + querystring.stringify({ submit: associatedIds.filter(Boolean) });

									resolve(new Redirect(redirectTo, Redirect.SEE_OTHER));
								})
								.catch(reject);
						});
					});
				});
			},
			function () {
				return new Redirect('/login?return_to=/submissions/new');
			}
		);
}

function create(request) {
	return request.user.ensure('submit').then(
		function () {
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
		},
		function () {
			return formSession.formFiles(request).then(function (form) {
				return new Promise(function (resolve) {
					form.on('file', function (file) {
						file.stream.resume();
					});

					form.on('finish', function () {
						resolve(new Redirect('/login?return_to=/submissions/new%3Fsubmit%3D' + encodeURIComponent(form.fields.user_media)));
					});
				});
			});
		}
	);
}

exports.uploadForm = uploadForm;
exports.createForm = createForm;
exports.upload = upload;
exports.create = create;

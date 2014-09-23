'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var util = require('util');
var formSession = require('../lib/form-session');
var permission = require('../lib/permission');
var Redirect = require('../lib/respond').Redirect;
var view = require('../lib/view').view;
var slug = require('../lib/slug');
var notifications = require('../models/notifications');
var media = require('../models/media');
var tags = require('../models/tags');
var submissions = require('../models/submissions');

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
					if (!hexDigest) {
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
			var thumbnailHash = null;

			form.on('file', function processFile(name, file) {
				if (name !== 'thumbnail') {
					file.stream.resume();
					return;
				}

				form.removeListener('file', processFile);

				thumbnailHash = media.upload(file.stream);
			});

			form.on('finish', function () {
				resolve(media.byHash(form.fields.media).then(
					function (submitMedia) {
						return Promise.resolve(thumbnailHash).then(function (hexDigest) {
							var thumbnail = hexDigest ? media.byHash(hexDigest) : Promise.resolve(null);

							return thumbnail.then(function (thumbnailMedia) {
								return submissions.create({
									owner: request.user.id,
									thumbnail: thumbnailMedia && thumbnailMedia.id,
									title: form.fields.title,
									description: form.fields.description,
									rating: form.fields.rating,
									tags: form.fields.tags
								});
							});
						}).then(function (submissionId) {
							var titleSlug = slug.slugFor(form.fields.title);
							var submissionPath = util.format('/submissions/%d/%s', submissionId, titleSlug);

							return media.associateWithSubmission(submitMedia.id, submissionId)
								.then(_.constant(new Redirect(submissionPath)));
						});
					},
					_.constant(new Redirect('/submissions/new'))
				));
			});
		});
	});
});

exports.uploadForm = uploadForm;
exports.createForm = createForm;
exports.upload = upload;
exports.create = create;

'use strict';

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
		var submissionUpload = Promise.resolve(null);

		form.on('file', function processFile(name, file) {
			if (name !== 'file') {
				file.stream.resume();
				return;
			}

			form.removeListener('file', processFile);

			submissionUpload = media.upload(file.stream);
		});

		function completeUpload() {
			return submissionUpload.then(function (submissionMedia) {
				return submissionMedia ?
					new Redirect('/submissions/new?submit=' + submissionMedia.hash, Redirect.SEE_OTHER) :
					new Redirect('/submissions/upload');
			});
		}

		return new Promise(function (resolve) {
			form.on('finish', function () {
				resolve(completeUpload());
			});
		});
	});
});

var create = permission.require('submit', function create(request) {
	return formSession.formFiles(request).then(function (form) {
		var thumbnailUpload = Promise.resolve(null);

		function completeSubmission() {
			return media.byHash(form.fields.media).then(function (submitMedia) {
				return thumbnailUpload.then(function (thumbnailMedia) {
					return submissions.create({
						owner: request.user.id,
						media: submitMedia.id,
						thumbnail: thumbnailMedia && thumbnailMedia.id,
						title: form.fields.title,
						description: form.fields.description,
						rating: form.fields.rating,
						tags: form.fields.tags
					});
				}).then(function (submissionId) {
					var titleSlug = slug.slugFor(form.fields.title);
					var submissionPath = util.format('/submissions/%d/%s', submissionId, titleSlug);

					return new Redirect(submissionPath);
				});
			});
		}

		form.on('file', function processFile(name, file) {
			if (name !== 'thumbnail') {
				file.stream.resume();
				return;
			}

			form.removeListener('file', processFile);

			thumbnailUpload = media.upload(file.stream);
		});

		return new Promise(function (resolve) {
			form.on('finish', function () {
				resolve(completeSubmission());
			});
		});
	});
});

exports.uploadForm = uploadForm;
exports.createForm = createForm;
exports.upload = upload;
exports.create = create;

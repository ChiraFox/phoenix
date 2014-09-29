'use strict';

var util = require('util');
var formSession = require('../lib/form-session');
var permission = require('../lib/permission');
var Redirect = require('../lib/respond').Redirect;
var view = require('../lib/view').view;
var slug = require('../lib/slug');
var models = require('../models');
var notifications = require('../models/notifications');

var Media = models.Media;
var Submission = models.Submission;
var Tag = models.Tag;

var uploadForm = permission.require(permission.submit, view('submissions/upload', [notifications.counts]));
var createForm = permission.require(permission.submit, view('submissions/edit', [Tag.mostCommonTagsForRequester, Media.forRequest, notifications.counts]));

var upload = permission.require(permission.submit, function upload(request) {
	return formSession.formFiles({ file: {} }, request).then(function (form) {
		return form.files.file;
	}).then(function (submissionMedia) {
		return submissionMedia ?
			new Redirect('/submissions/new?submit=' + submissionMedia.get('hash'), Redirect.SEE_OTHER) :
			new Redirect('/submissions/upload');
	});
});

var create = permission.require(permission.submit, function create(request) {
	return formSession.formFiles({ thumbnail: {} }, request).then(function (form) {
		return Media.byHash(form.fields.media).then(function (submitMedia) {
			return form.files.thumbnail.then(function (thumbnailMedia) {
				return Submission.create({
					owner: request.user,
					media: submitMedia,
					thumbnail: thumbnailMedia,
					title: form.fields.title,
					description: form.fields.description,
					rating: form.fields.rating,
					tags: form.fields.tags
				});
			}).then(function (submission) {
				var titleSlug = slug.slugFor(submission.get('title'));
				var submissionPath = util.format('/submissions/%d/%s', submission.id, titleSlug);

				return new Redirect(submissionPath, Redirect.SEE_OTHER);
			});
		});
	});
});

exports.uploadForm = uploadForm;
exports.createForm = createForm;
exports.upload = upload;
exports.create = create;

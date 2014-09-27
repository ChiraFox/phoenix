'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var unorm = require('unorm');
var db = require('../lib/db');
var tags = require('./tags');
var media = require('./media');

var validRatings = ['general', 'mature', 'adult'];

function create(info) {
	var owner = info.owner;
	var thumbnail = info.thumbnail;
	var submissionMedia = info.media;
	var title = info.title;
	var description = info.description;
	var rating = info.rating;
	var tagNames = info.tags.split(',').map(function (tag) {
		return tag.trim();
	}).filter(Boolean).map(function (tag) {
		return unorm.nfc(tag.toLowerCase());
	}).sort();

	for (var i = 1; i < tagNames.length; i++) {
		if (tagNames[i] === tagNames[i - 1]) {
			tagNames.splice(i, 1);
			i--;
		}
	}

	if ((owner | 0) !== owner) {
		return Promise.reject(new TypeError('owner should be an integer.'));
	}

	if ((submissionMedia | 0) !== submissionMedia) {
		return Promise.reject(new TypeError('submissionMedia should be an integer.'));
	}

	if (thumbnail !== null && (thumbnail | 0) !== thumbnail) {
		return Promise.reject(new TypeError('thumbnail should be an integer or null.'));
	}

	if (!title) {
		return Promise.reject(new Error('title should be a non-empty string.'));
	}

	if (validRatings.indexOf(rating) === -1) {
		return Promise.reject(new Error('rating should be one of “general”, “mature”, “adult”.'));
	}

	return Promise.using(db.useClient(), function (client) {
		return db.transaction(client, function () {
			return client.queryAsync(
				"INSERT INTO submissions (owner, title, description, rating, thumbnail, posted) VALUES ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'UTC') RETURNING id",
				[owner, title, description, rating, thumbnail]
			).then(function (result) {
				var submissionId = result.rows[0].id;

				var tagsReady = tagNames.length === 0 ? Promise.resolve() :
					client.queryAsync('SELECT id, name FROM tags WHERE name = ANY ($1)', [tagNames]).then(function (result) {
						var existingTags = result.rows;

						existingTags.sort(function (a, b) {
							return a.name < b.name ? -1 : 1;
						});

						var i = 0;
						var newTags = [];
						var existingTagIds = [];

						existingTags.forEach(function (existingTag) {
							var tag;

							while ((tag = tagNames[i]) !== existingTag.name) {
								newTags.push(tag);
								i++;
							}

							existingTagIds.push(existingTag.id);
							i++;
						});

						newTags.push.apply(newTags, tagNames.slice(i));

						return Promise.all(newTags.map(function (tag) {
							return tags.byName(tag, true);
						})).then(function (newTagIds) {
							var params = existingTagIds.concat(newTagIds);
							var placeholders = params.map(function (_, i) {
								return '($1, $' + (i + 2) + ')';
							}).join(', ');

							params.unshift(submissionId);

							return client.queryAsync('INSERT INTO submission_tags (submission, tag) VALUES ' + placeholders, params);
						});
					});

				return tagsReady.then(_.constant(submissionId));
			});
		}).then(function (submissionId) {
			return media.associateWithSubmission(submissionMedia, submissionId).then(_.constant(submissionId));
		});
	});
}

exports.create = create;

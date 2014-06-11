'use strict';

var Promise = require('bluebird');
var unorm = require('unorm');
var db = require('../lib/db');
var tags = require('./tags');

var validRatings = ['general', 'mature', 'adult'];

function create(info) {
	var owner = info.owner;
	var thumbnail = info.thumbnail;
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

	if (thumbnail !== null && (thumbnail | 0) !== thumbnail) {
		return Promise.reject(new TypeError('thumbnail should be an integer or null.'));
	}

	if (!title) {
		return Promise.reject(new Error('title should be a non-empty string.'));
	}

	if (validRatings.indexOf(rating) === -1) {
		return Promise.reject(new Error('rating should be one of “general”, “mature”, “adult”.'));
	}

	return db.useClient().then(function (client) {
		return client.query('BEGIN').then(function () {
			return client.query(
				"INSERT INTO submissions (owner, title, description, rating, thumbnail, posted) VALUES ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'UTC') RETURNING id",
				[owner, title, description, rating, thumbnail]
			).then(function (result) {
				var submissionId = result.rows[0].id;

				var tagsReady;

				if (tagNames.length) {
					tagsReady = client.query('SELECT id, name FROM tags WHERE name IN (' + tagNames.map(function (_, i) { return '$' + (i + 1); }).join(', ') + ')', tagNames).then(function (result) {
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

							return client.query('INSERT INTO submission_tags (submission, tag) VALUES ' + placeholders, params);
						});
					});
				} else {
					tagsReady = Promise.resolve();
				}

				return tagsReady.then(function () {
					console.log('Committing submission %d', submissionId);
					return client.query('COMMIT');
				}).then(function () {
					client.done();
					return submissionId;
				});
			}).catch(function (error) {
				console.log('Rolling back');

				function failWithOriginalError() {
					client.done();
					return Promise.reject(error);
				}

				return client.query('ROLLBACK').then(failWithOriginalError, failWithOriginalError);
			});
		});
	});
}

exports.create = create;

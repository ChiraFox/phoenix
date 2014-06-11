'use strict';

var Promise = require('bluebird');
var unorm = require('unorm');
var db = require('../lib/db');

function byName(name, preNormalized) {
	if (!preNormalized) {
		name = unorm.nfc(name.toLowerCase().trim());
	}

	return db.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [name]).then(
		function (result) {
			return result.rows[0].id;
		},
		function (error) {
			return db.query('SELECT id FROM tags WHERE name = $1', [name]).then(function (result) {
				var tag = result.rows[0];

				return tag ? tag.id : Promise.reject(error);
			});
		}
	);
}

function mostCommonTagsFor(user) {
	return db.query(
		'SELECT COUNT(submissions.id) AS count, tags.name FROM tags ' +
		'INNER JOIN submission_tags ON tags.id = submission_tags.tag ' +
		'INNER JOIN submissions ON submission_tags.submission = submissions.id ' +
		'WHERE submissions.owner = $1 ' +
		'GROUP BY tags.id ' +
		'ORDER BY count DESC LIMIT 20', [user.id]).then(function (result) {
			return result.rows;
		});
}

function mostCommonTagsForRequester(request) {
	if (!request.user.id) {
		return Promise.resolve(null);
	}

	return mostCommonTagsFor(request.user).then(function (tags) {
		return { commonTags: tags };
	});
}

exports.byName = byName;
exports.mostCommonTagsFor = mostCommonTagsFor;
exports.mostCommonTagsForRequester = mostCommonTagsForRequester;

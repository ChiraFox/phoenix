'use strict';

var Promise = require('bluebird');
var crypto = require('crypto');
var stream = require('stream');
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');
var db = require('../lib/db');
var config = require('../config');

var temporaryDirectory = path.join(__dirname, '../', config.temporaryDirectory);
var mediaDirectory = path.join(__dirname, '../public/media/');

function const_(obj) {
	return function () {
		return obj;
	};
}

function autoThumbnail(imageBuffer) {
	return sharp(imageBuffer).resize(300, 300).max().png();
}

function associateWithSubmission(mediaId, submissionId) {
	return db.query('INSERT INTO submission_media (media, submission) VALUES ($1, $2)', [mediaId, submissionId]);
}

function createUploadStream() {
	return new Promise(function (resolve, reject) {
		crypto.randomBytes(15, function (error, bytes) {
			if (error) {
				reject(error);
				return;
			}

			var tempPath = path.join(temporaryDirectory, bytes.toString('base64').replace(/\//g, '-'));
			var hash = crypto.createHash('sha256');
			var fileStream = fs.createWriteStream(tempPath, { flags: 'wx', mode: 6 << 6 });
			var uploadStream = new stream.PassThrough();

			uploadStream.pipe(hash);
			uploadStream.pipe(fileStream);

			var resolveUploaded;
			var rejectUploaded;

			uploadStream.uploaded = new Promise(function (resolve, reject) {
				resolveUploaded = resolve;
				rejectUploaded = reject;
			});

			var totalLength = 0;

			uploadStream.on('data', function (part) {
				totalLength += part.length;
			});

			uploadStream.on('end', function () {
				var hexDigest = hash.read().toString('hex');

				function getId(result) {
					return result.rows[0].id;
				}

				return db.query('INSERT INTO media (hash, type, file_size) VALUES ($1, $2, $3) RETURNING id', [hexDigest, '', totalLength])
					.then(getId)
					.then(
						function (mediaId) {
							return new Promise(function (resolve, reject) {
								fs.rename(tempPath, path.join(mediaDirectory, hexDigest), function (error) {
									if (error) {
										reject(error);
									} else {
										resolve(mediaId);
									}
								});
							});
						},
						function (error) {
							return db.query('SELECT id FROM media WHERE hash = $1', [hexDigest])
								.then(getId)
								.catch(const_(Promise.reject(error)));
						}
					)
					.then(resolveUploaded, rejectUploaded);
			});

			resolve(uploadStream);
		});
	});
}

function associate(user, mediaId, filename) {
	var mediaId_ = const_(mediaId);

	return db.query('INSERT INTO user_media (owner, media, name) VALUES ($1, $2, $3)', [user.id, mediaId, filename])
		.then(mediaId_, mediaId_);
}

function owns(user, mediaId) {
	return db.query(
		'SELECT COUNT(*)::int AS count FROM user_media WHERE user_media.owner = $1 AND user_media.media = $2',
		[user.id, mediaId]
	).then(function (result) {
		return result.rows[0].count === 1;
	});
}

function listFor(user) {
	return db.query(
		'SELECT media.id, media.hash, media.type, media.file_size, media.width, media.height, user_media.media, user_media.name FROM media INNER JOIN user_media ON media.id = user_media.media WHERE user_media.owner = $1',
		[user.id]
	).then(function (result) {
		return result.rows;
	});
}

function listForRequester(request) {
	if (!request.user.id) {
		return Promise.resolve(null);
	}

	return listFor(request.user).then(function (media) {
		return { media: media };
	});
}

exports.autoThumbnail = autoThumbnail;
exports.createUploadStream = createUploadStream;
exports.associate = associate;
exports.associateWithSubmission = associateWithSubmission;
exports.owns = owns;
exports.listFor = listFor;
exports.listForRequester = listForRequester;

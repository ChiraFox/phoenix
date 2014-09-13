'use strict';

var Promise = require('bluebird');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');
var db = require('../lib/db');
var config = require('../config');

Promise.promisifyAll(crypto);
Promise.promisifyAll(fs);

var EMPTY_UPLOAD = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
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

function upload(uploadStream) {
	return crypto.randomBytesAsync(15).then(function (bytes) {
		var hash = crypto.createHash('sha256');
		var temporaryPath = path.join(temporaryDirectory, bytes.toString('base64').replace(/\//g, '-'));
		var temporaryFileStream = fs.createWriteStream(temporaryPath, { flags: 'wx', mode: 6 << 6 });

		uploadStream.pipe(hash);
		uploadStream.pipe(temporaryFileStream);

		return new Promise(function (resolve) {
			uploadStream.on('end', function () {
				var hexDigest = hash.read().toString('hex');

				resolve(
					fs.renameAsync(temporaryPath, path.join(mediaDirectory, hexDigest))
						.then(function () {
							return db.query('INSERT INTO media (hash, type) VALUES ($1, $2)', [hexDigest, ''])
								.catch(const_());
						})
						.then(const_(hexDigest))
				);
			});
		});
	});
}

function byHash(hash) {
	return db.query(
		'SELECT id, hash, type, width, height FROM media WHERE hash = $1',
		[hash]
	).then(function (result) {
		return result.rows[0] || Promise.reject(new Error('No media available with that hash.'));
	});
}

function forRequest(request) {
	return byHash(request.query.submit).then(function (media) {
		return { media: media };
	});
}

exports.EMPTY_UPLOAD = EMPTY_UPLOAD;
exports.autoThumbnail = autoThumbnail;
exports.upload = upload;
exports.associateWithSubmission = associateWithSubmission;
exports.byHash = byHash;
exports.forRequest = forRequest;

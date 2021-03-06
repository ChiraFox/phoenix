'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');
var db = require('../lib/db');
var IdentifyStream = require('../lib/identify-stream').IdentifyStream;
var config = require('../config');

Promise.promisifyAll(crypto);
Promise.promisifyAll(fs);

var EMPTY_UPLOAD = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
var temporaryDirectory = path.join(__dirname, '../', config.temporaryDirectory);
var mediaDirectory = path.join(__dirname, '../public/media/');

function autoThumbnailer() {
	return sharp().resize(300, 300).max();
}

function associateWithSubmission(mediaId, submissionId) {
	return db.query('INSERT INTO submission_media (media, submission) VALUES ($1, $2)', [mediaId, submissionId]);
}

function byHash(hash) {
	return db.query(
		'SELECT id, hash, type, width, height FROM media WHERE hash = $1',
		[hash]
	).then(function (result) {
		return result.rows[0] || Promise.reject(new Error('No media available with that hash.'));
	});
}

function upload(uploadStream) {
	return crypto.randomBytesAsync(15).then(function (bytes) {
		var hash = crypto.createHash('sha256');
		var temporaryPath = path.join(temporaryDirectory, bytes.toString('base64').replace(/\//g, '-'));
		var temporaryFileStream = fs.createWriteStream(temporaryPath, { flags: 'wx', mode: 6 << 6 });
		var identifyStream = new IdentifyStream();

		uploadStream.pipe(hash);
		uploadStream.pipe(identifyStream);
		uploadStream.pipe(temporaryFileStream);

		function completeUpload() {
			var hexDigest = hash.read().toString('hex');

			if (hexDigest === EMPTY_UPLOAD) {
				return null;
			}

			var identifiedType = identifyStream.identifiedType;

			if (!identifiedType) {
				return fs.unlinkAsync(temporaryPath)
					.then(Promise.reject(_.constant(new Error('Unrecognized file type.'))));
			}

			return fs.renameAsync(temporaryPath, path.join(mediaDirectory, hexDigest + '.' + identifiedType)).then(function () {
				return db.query('INSERT INTO media (hash, type) VALUES ($1, $2) RETURNING id, hash, type, width, height', [hexDigest, identifiedType])
					.then(
						function (result) {
							return result.rows[0];
						},
						function () {
							return byHash(hexDigest);
						}
					);
			});
		}

		return new Promise(function (resolve) {
			uploadStream.on('end', function () {
				resolve(completeUpload());
			});
		});
	});
}

function forRequest(request) {
	return byHash(request.query.submit).then(function (media) {
		return { media: media };
	});
}

exports.EMPTY_UPLOAD = EMPTY_UPLOAD;
exports.autoThumbnailer = autoThumbnailer;
exports.upload = upload;
exports.associateWithSubmission = associateWithSubmission;
exports.byHash = byHash;
exports.forRequest = forRequest;

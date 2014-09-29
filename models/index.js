'use strict';

/* jshint latedef: false */

var _ = require('lodash');
var Promise = require('bluebird');
var assert = require('assert');
var bcrypt = require('bcrypt');
var bookshelf = require('../lib/bookshelf');
var config = require('../config');
var crypto = require('crypto');
var fs = require('fs');
var IdentifyStream = require('../lib/identify-stream').IdentifyStream;
var path = require('path');
var unorm = require('unorm');

Promise.promisifyAll(bcrypt);
Promise.promisifyAll(crypto);
Promise.promisifyAll(fs);

var bcryptRounds = config.password.bcryptRounds;

assert((bcryptRounds | 0) === bcryptRounds, 'password.bcryptRounds should be an integer');

var EMPTY_UPLOAD = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
var temporaryDirectory = path.join(__dirname, '../', config.temporaryDirectory);
var mediaDirectory = path.join(__dirname, '../public/media/');

var Media = bookshelf.Model.extend({
	tableName: 'media'
}, {
	upload: function (uploadStream) {
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
					return new Media({ hash: hexDigest, type: identifiedType }).save().catch(function () {
						return Media.byHash(hexDigest);
					});
				});
			}

			return new Promise(function (resolve) {
				uploadStream.on('end', function () {
					resolve(completeUpload());
				});
			});
		});
	},
	byHash: function (hash) {
		return new Media({ hash: hash }).fetch({ require: true });
	},
	forRequest: function (request) {
		return Media.byHash(request.query.submit).then(function (media) {
			return { media: media };
		});
	}
});

var Portfolio = bookshelf.Model.extend({
	tableName: 'portfolios',
	submissions: function () {
		return this.belongsToMany(Submission, 'submission_portfolios', 'portfolio', 'submission');
	}
});

var Session = bookshelf.Model.extend({
	tableName: 'sessions',
	owner: function () {
		return this.belongsTo(User);
	}
});

var Submission = bookshelf.Model.extend({
	tableName: 'submissions',
	owner: function () {
		return this.belongsTo(User);
	},
	thumbnail: function () {
		return this.hasOne(Media);
	},
	media: function () {
		return this.belongsToMany(Media, 'submission_media', 'submission', 'media');
	},
	tags: function () {
		return this.belongsToMany(Tag, 'submission_tags', 'submission', 'tag');
	}
}, {
	create: function (info) {
		var owner = info.owner;
		var thumbnail = info.thumbnail;
		var submissionMedia = info.media;
		var title = info.title;
		var description = info.description;
		var rating = info.rating;
		var tagNames = info.tags.split(',');

		if (!title) {
			return Promise.reject(new Error('title should be a non-empty string.'));
		}

		return Tag.getAll(tagNames).then(function (tags) {
			return new Submission({
				owner: owner.id,
				title: title,
				description: description,
				rating: rating,
				thumbnail: thumbnail && thumbnail.id,
				posted: 'NOW()'
			}).save().then(function (submission) {
				var relatedTags = submission.related('tags');

				return Promise.all([
					submission.related('media').create(submissionMedia),
					Promise.map(tags, function (tag) {
						return relatedTags.create(tag);
					})
				]).then(_.constant(submission));
			});
		});
	}
});

var Tag = bookshelf.Model.extend({
	tableName: 'tags'
}, {
	get: function (tagName, normalized) {
		if (!normalized) {
			tagName = unorm.nfc(tagName.trim().toLowerCase());
		}

		return new Tag({ name: tagName }).save().catch(function () {
			return new Tag({ name: tagName }).fetch({ require: true });
		});
	},
	getAll: function (tagNames, normalized) {
		if (!normalized) {
			tagNames = _.chain(tagNames).map(function (tagName) {
				return unorm.nfc(tagName.trim().toLowerCase());
			}).filter().sortBy().uniq(true).value();
		}

		return Tag.query(function (q) {
			q.whereRaw('tags.name = ANY (?)', [tagNames])
			 .orderBy('tags.name');
		}).fetchAll().then(function (existingTags) {
			var newTags = [];
			var start = -1;

			existingTags.models.forEach(function (existingTag) {
				var i = tagNames.indexOf(existingTag.get('name'), start + 1);

				while (++start < i) {
					newTags.push(Tag.get(tagNames[start], true));
				}
			});

			return Promise.all(newTags).then(function (createdTags) {
				return existingTags.models.concat(createdTags);
			});
		});
	},
	mostCommonTagsFor: function (user) {
		return Tag.query(function (q) {
			q.innerJoin('submission_tags', 'tags.id', 'submission_tags.tag')
			 .innerJoin('submissions', 'submission_tags.submission', 'submissions.id')
			 .where('submissions.owner', '=', user.id)
			 .groupBy('tags.id')
			 .orderByRaw('COUNT(submissions.id) DESC')
			 .limit(20);
		}).fetchAll();
	},
	mostCommonTagsForRequester: function (request) {
		if (!request.user.id) {
			return Promise.resolve(null);
		}

		return Tag.mostCommonTagsFor(request.user).then(function (tags) {
			return { commonTags: tags };
		});
	}
});

var User = bookshelf.Model.extend({
	tableName: 'users',
	submissions: function () {
		return this.hasMany(Submission, 'owner');
	},
	portfolios: function () {
		return this.hasMany(Portfolio, 'owner');
	}
}, {
	authenticate: function (credentials) {
		var username = credentials.username;
		var password = credentials.password;

		if (!username || !password) {
			return Promise.resolve({ failureType: username ? 'password' : 'username' });
		}

		return new User({ username: username }).fetch().then(function (user) {
			if (!user) {
				return { failureType: 'username' };
			}

			return bcrypt.compareAsync(password, user.get('password_hash')).then(function (match) {
				return match ? { userId: user.id } : { failureType: 'password' };
			});
		});
	},
	create: function (credentials) {
		var username = credentials.username;
		var password = credentials.password;

		if (!username) {
			return Promise.reject(new Error('A username is required.'));
		}

		if (!password) {
			return Promise.reject(new Error('A password is required.'));
		}

		return bcrypt.hashAsync(password, bcryptRounds).then(function (hash) {
			return new User({ username: username, password_hash: hash }).save();
		});
	},
	byUsername: function (username) {
		return new User({ username: username }).fetch({ require: true });
	},
	byUsernameParameter: function (request) {
		return User.byUsername(request.params.username).then(function (user) {
			return { user: user };
		});
	}
});

exports.Media = Media;
exports.Portfolio = Portfolio;
exports.Session = Session;
exports.Submission = Submission;
exports.Tag = Tag;
exports.User = User;

'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var fs = require('fs');
var db = require('../lib/db');
var path = require('path');

var readFile = Promise.promisify(fs.readFile);

Promise.using(db.useClient(), function (client) {
	function query(sql) {
		return function () {
			return client.queryAsync(sql);
		};
	}

	function wrap(transform, targetRevision) {
		return function () {
			return db.transaction(client, function () {
				return transform(query).then(function () {
					return client.queryAsync('UPDATE database_revision SET revision = $1', [targetRevision]);
				});
			});
		};
	}

	function upgradeTo(revision, current, finalDestination) {
		if (revision === current) {
			return Promise.resolve();
		}

		var migration = require(path.join('../migrations', current + '.js'));

		if (revision !== null && migration.base === null) {
			throw new Error('Can’t find an upgrade path from ' + revision + ' to ' + finalDestination + '.');
		}

		return upgradeTo(revision, migration.base, finalDestination)
			.then(function () {
				console.log('Upgrading from %s to %s.', migration.base, current);
			})
			.then(wrap(migration.up, current));
	}

	var destinationRevision = process.argv.length >= 3 ?
		Promise.resolve(process.argv[2]) :
		readFile('migrations/current', 'utf8').then(function (name) {
			return name.trim();
		});

	var databaseRevision = client.queryAsync('CREATE TABLE IF NOT EXISTS database_revision (revision VARCHAR); SELECT revision FROM database_revision').then(function (result) {
		return result.rows.length ?
			result.rows[0].revision :
			client.queryAsync('INSERT INTO database_revision (revision) VALUES (NULL)').then(_.constant(null));
	});

	return Promise.all([databaseRevision, destinationRevision]).spread(function (current, target) {
		if (current !== target) {
			return upgradeTo(current, target, target);
		}

		console.log('Database is up to date.');
	});
}).done(db.pg.end.bind(db.pg));

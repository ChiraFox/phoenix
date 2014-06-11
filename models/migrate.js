'use strict';

var Promise = require('bluebird');
var fs = require('fs');
var pg = require('pg');
var path = require('path');

var config = require('../config');

var readFile = Promise.denodeify(fs.readFile);

var client = new pg.Client(config.database);
var query_ = Promise.denodeify(client.query).bind(client);

function query(sql) {
	return function () {
		return query_(sql);
	};
}

function wrap(transform, targetRevision) {
	return function () {
		return transform(query).then(
			function () {
				return query_('UPDATE database_revision SET revision = $1', [targetRevision])
					.then(query('COMMIT'));
			},
			function (error) {
				return query_('ROLLBACK').then(function () {
					throw error;
				});
			}
		);
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
		.then(query('BEGIN'))
		.then(wrap(migration.up, current));
}

function destinationRevision() {
	if (process.argv.length >= 3) {
		return Promise.resolve(process.argv[2]);
	}

	return readFile('migrations/current', 'utf8').then(function (name) {
		return name.trim();
	});
}

function databaseRevision() {
	return new Promise(function (resolve, reject) {
		client.query('CREATE TABLE IF NOT EXISTS database_revision (revision VARCHAR); SELECT revision FROM database_revision', function (error, result) {
			if (error) {
				reject(error);
				return;
			}

			if (result.rows.length) {
				resolve(result.rows[0].revision);
			} else {
				client.query('INSERT INTO database_revision (revision) VALUES (NULL)', function (error) {
					if (error) {
						reject(error);
					} else {
						resolve(null);
					}
				});
			}
		});
	});
}

client.connect(function (error) {
	if (error) {
		throw error;
	}

	Promise.all([databaseRevision(), destinationRevision()])
		.then(function (result) {
			if (result[0] === result[1]) {
				console.log('Database is up to date.');
				return Promise.resolve();
			}

			return upgradeTo(result[0], result[1], result[1]);
		})
		.done(function () {
			client.end();
		});
});

'use strict';

exports.base = 'submission-thumbnails';

exports.up = function (query) {
	return query('DROP TABLE user_media')();
};

exports.down = function (query) {
	return query(
		'CREATE TABLE user_media (\
			owner INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,\
			media INTEGER NOT NULL REFERENCES media (id),\
			name VARCHAR,\
			PRIMARY KEY (owner, media)\
		)'
	)();
};

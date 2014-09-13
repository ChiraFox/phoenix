'use strict';

exports.base = 'remove-user-media';

exports.up = function (query) {
	return query('ALTER TABLE media DROP file_size')();
};

exports.down = function (query) {
	return query('ALTER TABLE media ADD file_size INTEGER NOT NULL')();
};

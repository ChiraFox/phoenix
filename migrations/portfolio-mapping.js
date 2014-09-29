'use strict';

exports.base = 'remove-file-size';

exports.up = function (query) {
	return query(
		"CREATE TABLE submission_portfolios (\
			submission INTEGER NOT NULL REFERENCES submissions (id),\
			portfolio INTEGER NOT NULL REFERENCES portfolios (id),\
			PRIMARY KEY (submission, portfolio)\
		)"
	)();
};

exports.down = function (query) {
	return query("DROP TABLE submission_portfolios")();
};

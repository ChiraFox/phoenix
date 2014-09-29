'use strict';

var config = require('../config');

var knex = require('knex')({
	client: 'pg',
	connection: config.database,
	debug: true
});

var bookshelf = require('bookshelf')(knex);

module.exports = bookshelf;

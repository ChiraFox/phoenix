'use strict';

var readline = require('readline');
var models = require('./');

var rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Username? ', function createUser(username) {
	rl.close();

	models.User.create({ username: username, password: 'password' }).then(
		function (user) {
			console.log('Created user %d with password “password”.', user.id);
			return require('../lib/bookshelf').knex.destroy();
		},
		function (error) {
			console.error(error.stack);
			process.exit(1);
		}
	).done();
});

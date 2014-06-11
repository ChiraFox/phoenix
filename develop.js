'use strict';

/* eslint no-return-assign: 0 */

var fs = require('fs');
var path = require('path');
var util = require('util');
var events = require('events');
var Promise = require('bluebird');
var minimatch = require('minimatch');
var childProcess = require('child_process');

function cons(head, tail) {
	var list = [head];

	list.push.apply(list, tail);

	return list;
}

function TreeWatcher(directory, ignoreList) {
	var shouldIgnore = ignoreList.some(function (ignorePattern) {
		return minimatch(directory, ignorePattern);
	});

	if (shouldIgnore) {
		return;
	}

	var treeWatcher = this;

	function pass(event) {
		return function () {
			treeWatcher.emit.apply(treeWatcher, cons(event, arguments));
		};
	}

	fs.watch(path.join(__dirname, directory), pass('change'));

	fs.readdir(path.join(__dirname, directory), function (error, names) {
		if (error) {
			if (error.message.indexOf('ENOTDIR') === -1) {
				treeWatcher.emit('error', error);
			}

			return;
		}

		names.forEach(function (name) {
			var subWatcher = new TreeWatcher(path.join(directory, name), ignoreList);

			subWatcher.on('error', pass('error'));
			subWatcher.on('change', pass('change'));
		});
	});
}

util.inherits(TreeWatcher, events.EventEmitter);

function awaitableExit(child) {
	child.exit = new Promise(function (resolve) {
		child.on('exit', function () {
			resolve();
		});
	});

	return child;
}

function SingleProcess() {
	this.last = Promise.resolve();
}

SingleProcess.prototype.spawn = function spawn(path, args, options) {
	return (this.last = this.kill('SIGINT').then(function () {
		return awaitableExit(childProcess.spawn(path, args, options));
	}));
};

SingleProcess.prototype.kill = function kill(signal) {
	return (this.last = this.last.then(function (previous) {
		if (previous === undefined) {
			return Promise.resolve();
		}

		previous.kill(signal);

		return previous.exit;
	}));
};

function limit(func, timeout) {
	var lastCall = 0;
	var timer = null;

	return function limited() {
		var now = Date.now();

		if (now - lastCall >= timeout) {
			lastCall = now;
			clearTimeout(timer);
			timer = null;
			func.apply(this, arguments);
		} else if (!timer) {
			timer = setTimeout(limited, timeout - (now - lastCall));
		}
	};
}

var p = new SingleProcess();

var spawnOptions = {
	cwd: __dirname,
	stdio: 'inherit'
};

function spawnServer() {
	p.spawn(process.execPath, process.execArgv.concat(['server']), spawnOptions);
}

function changed() {
	p.kill('SIGINT').then(spawnServer);
}

function beginWatching() {
	process.once('SIGINT', function () {
		p.kill('SIGINT').then(function () {
			process.exit(0);
		});
	});

	fs.readFile(path.join(__dirname, '.watchignore'), 'utf8', function (error, content) {
		if (error) {
			throw error;
		}

		var ignoreList = content.trim().split('\n');

		new TreeWatcher('.', ignoreList).on('change', limit(changed, 100));

		spawnServer();
	});
}

function main() {
	var config = require('./config');

	if (!config.session.key) {
		console.error('No session.key has been provided in config.json; you’ll need one\nto sign session IDs.');

		require('crypto').randomBytes(64, function (error, bytes) {
			if (error) {
				throw error;
			}

			console.error('\nHere’s a fresh, random, 64-byte key:\n' + bytes.toString('base64'));

			process.exit(1);
		});

		return;
	}

	beginWatching();
}

main();

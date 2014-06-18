'use strict';

var view = require('../lib/view').view;
var notifications = require('../models/notifications');
var users = require('../models/users');

exports.homepage = view('users/profile', [users.byUsernameParameter, notifications.counts]);

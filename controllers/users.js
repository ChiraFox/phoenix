'use strict';

var view = require('../lib/view').view;
var models = require('../models');
var notifications = require('../models/notifications');

exports.homepage = view('users/profile', [models.User.byUsernameParameter, notifications.counts]);

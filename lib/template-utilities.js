'use strict';

var PRE_THOUSANDS = /.(?=(?:.{3})+$)/g;

exports.s = function pluralize(num, pluralSuffix, singularSuffix) {
	if (num === 1) {
		return singularSuffix || '';
	}

	return pluralSuffix == null ? 's' : pluralSuffix;
};

exports.formatInteger = function formatInteger(num) {
	return num.toString().replace(PRE_THOUSANDS, '$&,');
};

exports.ByteSize = require('./unit').ByteSize;
exports.bbcode = require('phoenix-bbcode').render;

'use strict';

var stream = require('stream');
var util = require('util');

function State(identifier) {
	this.transitions = {};
	this.identifier = identifier;
}

State.prototype.addMatch = function addMatch(pattern, identifier) {
	var state = this;
	var length = pattern.length;
	var byte;

	if (!length) {
		throw new Error('Pattern cannot be empty.');
	}

	for (var i = 0; i < length - 1; i++) {
		byte = pattern[i];
		var transition = state.transitions[byte];

		if (!transition) {
			transition = new State(null);
			state.transitions[byte] = transition;
		} else if (transition.identifier) {
			throw new Error('Patterns overlap.');
		}

		state = transition;
	}

	byte = pattern[length - 1];

	if (state.transitions[byte]) {
		throw new Error('Patterns overlap.');
	}

	state.transitions[byte] = new State(identifier);
};

var initialState = new State(null);

initialState.addMatch([0xff, 0xd8, 0xff], 'jpeg');
initialState.addMatch([137, 80, 78, 71, 13, 10, 26, 10], 'png');
initialState.addMatch([0x49, 0x49, 0x2a, 0x00], 'tiff');
initialState.addMatch([0x4d, 0x4d, 0x00, 0x2a], 'tiff');
initialState.addMatch([0x47, 0x49, 0x46, 0x38, 0x37, 0x61], 'gif');
initialState.addMatch([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 'gif');

function IdentifyStream() {
	stream.Writable.call(this);

	this.identifiedType = null;
	this.state = initialState;
}

util.inherits(IdentifyStream, stream.Writable);

IdentifyStream.prototype._write = function _write(chunk, encoding, callback) {
	var currentState = this.state;

	if (currentState) {
		for (var i = 0; i < chunk.length; i++) {
			var nextState = currentState.transitions[chunk[i]];

			if (!nextState) {
				currentState = null;
				break;
			}

			if (nextState.identifier) {
				this.identifiedType = nextState.identifier;
				currentState = null;
				break;
			}

			currentState = nextState;
		}

		this.state = currentState;
	}

	callback();
};

exports.IdentifyStream = IdentifyStream;

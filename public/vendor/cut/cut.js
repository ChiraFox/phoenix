// https://github.com/charmander/cut

'use strict';

/* exported Cut */

var Cut = (function () {
	function EventEmitter() {
		this.events = {};
	}

	EventEmitter.prototype.on = function (eventName, listener) {
		if (this.events.hasOwnProperty(eventName)) {
			this.events[eventName].push(listener);
		} else {
			this.events[eventName] = [listener];
		}
	};

	EventEmitter.prototype.emit = function (eventName, data) {
		if (this.events.hasOwnProperty(eventName)) {
			var firing = this.events[eventName].slice();

			for (var i = 0; i < firing.length; i++) {
				var listener = firing[i];

				listener(data);
			}
		}
	};

	EventEmitter.prototype.off = function (eventName, listener) {
		if (this.events.hasOwnProperty(eventName)) {
			var listeners = this.events[eventName];
			var i = listeners.indexOf(listener);

			if (i !== -1) {
				listeners.splice(i, 1);
			}
		}
	};

	function Cut(imageInput, options) {
		EventEmitter.call(this);

		var cut = this;

		this.imageWidth = imageInput.naturalWidth | 0;
		this.imageHeight = imageInput.naturalHeight | 0;
		this.cropWidth = options.cropWidth;
		this.cropHeight = options.cropHeight;

		var isImageThin = this.imageWidth / this.imageHeight < options.cropWidth / options.cropHeight;
		this.scaleContain = Math.min(1, isImageThin ? options.cropHeight / this.imageHeight : options.cropWidth / this.imageWidth);
		this.scaleCover = Math.min(1, !isImageThin ? options.cropHeight / this.imageHeight : options.cropWidth / this.imageWidth);

		var imageElement = document.createElement('img');
		imageElement.className = 'cut-image';
		imageElement.src = imageInput.src;
		imageElement.width = this.imageWidth;
		imageElement.height = this.imageHeight;

		var cropBox = document.createElement('div');
		cropBox.className = 'cut-crop-box';
		cropBox.style.width = this.cropWidth + 'px';
		cropBox.style.height = this.cropHeight + 'px';
		cropBox.style.marginLeft = (-this.cropWidth / 2) + 'px';
		cropBox.style.marginTop = (-this.cropHeight / 2) + 'px';
		cropBox.style.backgroundImage = 'url("' + encodeURI(imageElement.src) + '")';

		this.imageElement = imageElement;
		this.cropBox = cropBox;
		this.scaleMinimum = options.scaleMinimum == null ? this.scaleContain : +options.scaleMinimum;
		this.scaleMaximum = +options.scaleMaximum || 1;

		var container = document.createElement('div');
		container.className = 'cut-container';
		container.tabIndex = 0;
		container.style.minHeight = this.cropHeight + 'px';

		this.zoom = 1;
		this.offsetX = 0;
		this.offsetY = 0;

		container.addEventListener('mousedown', function (e) {
			if (e.button || e.ctrlKey || e.shiftKey || e.metaKey || e.altKey) {
				return;
			}

			var startX = e.pageX;
			var startY = e.pageY;
			var originalOffsetX = cut.offsetX;
			var originalOffsetY = cut.offsetY;

			function stopDrag(e) {
				window.removeEventListener('mousemove', drag, false);
				window.removeEventListener('mouseup', stopDrag, false);

				drag(e);
			}

			function drag(e) {
				var deltaX = e.pageX - startX;
				var deltaY = e.pageY - startY;

				cut.offsetX = originalOffsetX + deltaX;
				cut.offsetY = originalOffsetY + deltaY;
				cut.positionImage();
				cut.emit('move', { x: cut.offsetX, y: cut.offsetY });

				e.preventDefault();
			}

			window.addEventListener('mousemove', drag, false);
			window.addEventListener('mouseup', stopDrag, false);

			e.preventDefault();
			container.focus();
		}, false);

		container.addEventListener('touchstart', function (e) {
			if (e.touches.length > 2) {
				return;
			}

			var originalOffsetX = cut.offsetX;
			var originalOffsetY = cut.offsetY;
			var originalZoom = cut.zoom;

			var isZoom = e.touches.length === 2;
			var startX = e.touches[0].pageX;
			var startY = e.touches[0].pageY;
			var startDistance;

			if (isZoom) {
				startX = (startX + e.touches[1].pageX) / 2;
				startY = (startY + e.touches[1].pageY) / 2;

				var touchDeltaX = e.touches[0].pageX - e.touches[1].pageX;
				var touchDeltaY = e.touches[0].pageY - e.touches[1].pageY;
				startDistance = Math.sqrt(touchDeltaX * touchDeltaX + touchDeltaY * touchDeltaY);
			}

			function stopDrag() {
				window.removeEventListener('touchmove', drag, false);
				window.removeEventListener('touchend', stopDrag, false);
			}

			function drag(e) {
				var pageX = e.touches[0].pageX;
				var pageY = e.touches[0].pageY;

				if (isZoom) {
					pageX = (pageX + e.touches[1].pageX) / 2;
					pageY = (pageY + e.touches[1].pageY) / 2;
				}

				var deltaX = pageX - startX;
				var deltaY = pageY - startY;
				var currentDistance;

				cut.offsetX = originalOffsetX + deltaX;
				cut.offsetY = originalOffsetY + deltaY;

				if (isZoom) {
					var touchDeltaX = e.touches[0].pageX - e.touches[1].pageX;
					var touchDeltaY = e.touches[0].pageY - e.touches[1].pageY;
					currentDistance = Math.sqrt(touchDeltaX * touchDeltaX + touchDeltaY * touchDeltaY);

					cut.zoomTo(originalZoom * currentDistance / startDistance);
				} else {
					cut.positionImage();
				}

				cut.emit('move', { x: cut.offsetX, y: cut.offsetY });

				e.preventDefault();
			}

			window.addEventListener('touchmove', drag, false);
			window.addEventListener('touchend', stopDrag, false);

			e.preventDefault();
			container.focus();
		}, false);

		container.addEventListener('keydown', function (e) {
			if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
				return;
			}

			switch (e.keyCode) {
				case 37: // Left
					cut.offsetX -= 5;
					cut.positionImage();
					cut.emit('move', { x: cut.offsetX, y: cut.offsetY });
					break;

				case 38: // Up
					cut.offsetY -= 5;
					cut.positionImage();
					cut.emit('move', { x: cut.offsetX, y: cut.offsetY });
					break;

				case 39: // Right
					cut.offsetX += 5;
					cut.positionImage();
					cut.emit('move', { x: cut.offsetX, y: cut.offsetY });
					break;

				case 40: // Down
					cut.offsetY += 5;
					cut.positionImage();
					cut.emit('move', { x: cut.offsetX, y: cut.offsetY });
					break;

				default:
					return;
			}

			e.preventDefault();
		}, false);

		container.addEventListener('keypress', function (e) {
			if (e.key === '-' || e.charCode === 45) {
				cut.zoomTo(cut.zoom - 0.05);
			} else if (e.key === '+' || e.charCode === 43) {
				cut.zoomTo(cut.zoom + 0.05);
			} else {
				return;
			}

			e.preventDefault();
		}, false);

		container.appendChild(imageElement);
		container.appendChild(cropBox);

		imageInput.parentNode.replaceChild(container, imageInput);

		this.positionImage();
	}

	Cut.prototype = Object.create(EventEmitter.prototype);
	Cut.prototype.constructor = Cut;

	Cut.prototype.positionImage = function () {
		var imageTransform =
			'translate(' +
				(-this.imageWidth / 2 + this.offsetX).toFixed(1) + 'px, ' +
				(-this.imageHeight / 2 + this.offsetY).toFixed(1) + 'px) ' +
			'scale(' + this.zoom + ')';

		this.imageElement.style.webkitTransform = imageTransform;
		this.imageElement.style.msTransform = imageTransform;
		this.imageElement.style.oTransform = imageTransform;
		this.imageElement.style.transform = imageTransform;

		this.cropBox.style.backgroundPosition =
			(-this.imageWidth / 2 * this.zoom + this.cropWidth / 2 + this.offsetX).toFixed(1) + 'px ' +
			(-this.imageHeight / 2 * this.zoom + this.cropHeight / 2 + this.offsetY).toFixed(1) + 'px';
	};

	Cut.prototype.zoomTo = function (zoom) {
		if (zoom < this.scaleMinimum) {
			zoom = this.scaleMinimum;
		} else if (zoom > this.scaleMaximum) {
			zoom = this.scaleMaximum;
		}

		this.offsetX *= zoom / this.zoom;
		this.offsetY *= zoom / this.zoom;
		this.zoom = zoom;
		this.cropBox.style.backgroundSize = (this.imageWidth * zoom).toFixed(1) + 'px auto';
		this.positionImage();
		this.emit('zoom', zoom);
	};

	Cut.prototype.cover = function () {
		this.offsetX = 0;
		this.offsetY = 0;
		this.zoomTo(this.scaleCover);
	};

	Cut.prototype.contain = function () {
		this.offsetX = 0;
		this.offsetY = 0;
		this.zoomTo(this.scaleContain);
	};

	return Cut;
})();

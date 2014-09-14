/* global Cut */

'use strict';

var thumbnailSection = document.getElementById('thumbnail');
var cropInitialSource = thumbnailSection.dataset.cropInitialSource;

if (cropInitialSource) {
	var cutImage = document.createElement('img');
	cutImage.src = cropInitialSource;
	thumbnailSection.insertBefore(cutImage, thumbnailSection.lastElementChild);

	var cut = new Cut(cutImage, {
		cropWidth: 120,
		cropHeight: 120
	});

	var controls = document.createElement('div');
	controls.className = 'cut-controls';

	var slider = document.createElement('input');
	slider.className = 'cut-zoom-slider';
	slider.type = 'range';
	slider.min = cut.scaleMinimum.toFixed(2);
	slider.max = 1;
	slider.step = 0.01;
	slider.value = 1;

	var sliderChanged = function sliderChanged() {
		var zoom = +slider.value;

		if (zoom < +slider.min) {
			zoom = +slider.min;
		} else if (!(zoom <= 1)) {
			zoom = 1;
		}

		cut.zoomTo(zoom);
	};

	slider.addEventListener('input', sliderChanged, false);
	slider.addEventListener('change', sliderChanged, false);

	cut.on('zoom', function (zoom) {
		slider.value = zoom;
	});

	var buttons = document.createElement('span');

	var containButton = document.createElement('input');
	containButton.className = 'button';
	containButton.type = 'button';
	containButton.value = 'Contain';

	containButton.addEventListener('click', function () {
		cut.contain();
	}, false);

	var coverButton = document.createElement('input');
	coverButton.className = 'button';
	coverButton.type = 'button';
	coverButton.value = 'Cover';

	coverButton.addEventListener('click', function () {
		cut.cover();
	}, false);

	buttons.appendChild(containButton);
	buttons.appendChild(document.createTextNode(' '));
	buttons.appendChild(coverButton);
	controls.appendChild(slider);
	controls.appendChild(buttons);

	thumbnailSection.insertBefore(controls, thumbnailSection.lastElementChild);

	cut.cover();
}

/* global Cut */

'use strict';

var thumbnailSection = document.getElementById('thumbnail');
var existingCropContainer = null;
var existingCropControls = null;

function awaitSuccessfulCompletion(image, callback) {
	if (image.complete) {
		callback();
		return;
	}

	image.addEventListener('load', callback, false);
}

function cropThumbnail(uri) {
	if (existingCropContainer) {
		thumbnailSection.removeChild(existingCropContainer);
		thumbnailSection.removeChild(existingCropControls);
		existingCropContainer = null;
		existingCropControls = null;
	}

	var cutImage = document.createElement('img');
	cutImage.src = uri;
	cutImage.style.position = 'absolute';
	cutImage.style.visibility = 'hidden';
	thumbnailSection.insertBefore(cutImage, thumbnailSection.lastElementChild);

	awaitSuccessfulCompletion(cutImage, function () {
		var cut = new Cut(cutImage, {
			cropWidth: 120,
			cropHeight: 120
		});

		var controls = document.createElement('div');
		controls.className = 'cut-controls';

		var offsetInput = document.createElement('input');
		offsetInput.type = 'hidden';
		offsetInput.name = 'thumbnail_offset';
		offsetInput.value = '0,0';

		var slider = document.createElement('input');
		slider.name = 'thumbnail_zoom';
		slider.className = 'cut-zoom-slider';
		slider.type = 'range';
		slider.min = Math.sqrt(cut.scaleMinimum).toFixed(2);
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

			cut.zoomTo(zoom * zoom);
		};

		slider.addEventListener('input', sliderChanged, false);
		slider.addEventListener('change', sliderChanged, false);

		cut.on('zoom', function (zoom) {
			slider.value = Math.sqrt(zoom);
		});

		cut.on('move', function (offset) {
			offsetInput.value = offset.x + ',' + offset.y;
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
		controls.appendChild(offsetInput);
		controls.appendChild(slider);
		controls.appendChild(buttons);

		thumbnailSection.insertBefore(controls, thumbnailSection.lastElementChild);

		cut.cover();

		existingCropContainer = cut.cropBox.parentNode;
		existingCropControls = controls;
	});
}

var cropInitialSource = thumbnailSection.dataset.cropInitialSource;
var thumbnailUpload = document.getElementById('thumbnail-upload');

function selectThumbnailSource() {
	if (thumbnailUpload.files && thumbnailUpload.files.length) {
		cropThumbnail(URL.createObjectURL(thumbnailUpload.files[0]));
	} else if (cropInitialSource) {
		cropThumbnail(cropInitialSource);
	}
}

thumbnailUpload.addEventListener('change', selectThumbnailSource, false);
selectThumbnailSource();

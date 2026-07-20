// Photography gallery: loads photos/manifest.json, renders a justified
// grid, and drives the lightbox viewer.

const CAMERA_LABELS = {
    r7: 'Canon EOS R7',
    iphone: 'iPhone 16 Pro Max',
    k1000: 'Pentax K1000',
    other: ''
};

let allPhotos = [];
let visiblePhotos = [];
let currentIndex = -1;
let lastFocused = null;

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('current-year').textContent = new Date().getFullYear();

    loadGallery();

    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            const filter = this.getAttribute('data-filter');
            renderGallery(filter === 'all'
                ? allPhotos
                : allPhotos.filter(p => p.cameraKey === filter));
        });
    });

    setupLightbox();
});

async function loadGallery() {
    const loader = document.getElementById('gallery-loader');

    try {
        const response = await fetch('photos/manifest.json', { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error('Failed to fetch photo manifest');
        }
        const manifest = await response.json();
        allPhotos = manifest.photos || [];
        loader.style.display = 'none';

        if (allPhotos.length === 0) {
            document.getElementById('camera-filter').style.display = 'none';
            showNote('ls ~/photos', 'Nothing here yet — the first batch is still being developed. Check back soon.');
            return;
        }

        renderGallery(allPhotos);
    } catch (error) {
        console.error('Error loading photos:', error);
        loader.style.display = 'none';
        showNote('ls ~/photos', 'Could not load the gallery. Please try again later.');
    }
}

function showNote(command, message) {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = `
        <div class="gallery-note terminal">
            <div class="terminal-header">
                <span class="terminal-button"></span>
                <span class="terminal-button"></span>
                <span class="terminal-button"></span>
            </div>
            <div class="terminal-content">
                <div class="line">
                    <span class="prompt">$</span>
                    <span class="command"></span>
                </div>
                <div class="output"></div>
            </div>
        </div>
    `;
    gallery.querySelector('.command').textContent = command;
    gallery.querySelector('.output').textContent = message;
}

function renderGallery(photos) {
    visiblePhotos = photos;
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '';

    if (photos.length === 0) {
        showNote('ls ~/photos --filter', 'No photos from this camera yet.');
        return;
    }

    photos.forEach((photo, index) => {
        const ratio = (photo.width && photo.height) ? photo.width / photo.height : 1.5;
        const tile = document.createElement('button');
        tile.className = 'photo-tile';
        tile.style.setProperty('--ar', ratio.toFixed(4));
        tile.setAttribute('aria-label', tileLabel(photo));
        tile.addEventListener('click', () => openLightbox(index));

        const img = document.createElement('img');
        img.src = photo.thumb;
        img.alt = tileLabel(photo);
        img.loading = 'lazy';
        img.decoding = 'async';
        tile.appendChild(img);

        const meta = document.createElement('div');
        meta.className = 'tile-meta';
        meta.textContent = tileMetaText(photo);
        tile.appendChild(meta);

        gallery.appendChild(tile);
    });
}

function tileLabel(photo) {
    if (photo.title) return photo.title;
    const camera = CAMERA_LABELS[photo.cameraKey] || photo.camera || '';
    return camera ? `Photo taken on ${camera}` : 'Photo';
}

function tileMetaText(photo) {
    const camera = CAMERA_LABELS[photo.cameraKey] || photo.camera || '';
    const parts = [camera, photo.focalLength].filter(Boolean);
    if (photo.cameraKey === 'k1000') parts.push('35mm film');
    return parts.join(' · ');
}

function exifLine(photo) {
    const camera = CAMERA_LABELS[photo.cameraKey] || photo.camera || '';
    const parts = [
        camera,
        photo.cameraKey === 'k1000' ? '35mm film' : null,
        photo.lens,
        photo.focalLength,
        photo.aperture,
        photo.shutter,
        photo.iso,
        photo.date
    ].filter(Boolean);
    return parts.join(' · ');
}

/* Lightbox */

function setupLightbox() {
    const lightbox = document.getElementById('lightbox');

    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
    document.getElementById('lightbox-prev').addEventListener('click', () => step(-1));
    document.getElementById('lightbox-next').addEventListener('click', () => step(1));

    lightbox.addEventListener('click', function(e) {
        // Close when clicking the backdrop (not the image or controls)
        if (e.target === lightbox || e.target.classList.contains('lightbox-figure')) {
            closeLightbox();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (lightbox.hidden) return;
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') step(-1);
        else if (e.key === 'ArrowRight') step(1);
    });

    let touchStartX = null;
    lightbox.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    lightbox.addEventListener('touchend', e => {
        if (touchStartX === null) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        touchStartX = null;
        if (Math.abs(deltaX) > 50) step(deltaX > 0 ? -1 : 1);
    }, { passive: true });
}

function openLightbox(index) {
    lastFocused = document.activeElement;
    currentIndex = index;
    showPhoto();
    const lightbox = document.getElementById('lightbox');
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('lightbox-close').focus();
}

function closeLightbox() {
    document.getElementById('lightbox').hidden = true;
    document.body.style.overflow = '';
    currentIndex = -1;
    if (lastFocused) lastFocused.focus();
}

function step(direction) {
    const count = visiblePhotos.length;
    currentIndex = (currentIndex + direction + count) % count;
    showPhoto();
}

function showPhoto() {
    const photo = visiblePhotos[currentIndex];
    const img = document.getElementById('lightbox-image');
    img.src = photo.src;
    img.alt = tileLabel(photo);

    document.getElementById('lightbox-title').textContent = photo.title || '';
    document.getElementById('lightbox-counter').textContent =
        `${currentIndex + 1} / ${visiblePhotos.length}`;

    const exif = document.getElementById('lightbox-exif');
    exif.innerHTML = '';
    const prompt = document.createElement('span');
    prompt.className = 'prompt';
    prompt.textContent = '$';
    exif.appendChild(prompt);
    exif.appendChild(document.createTextNode(exifLine(photo)));

    // Preload neighbours so arrow navigation feels instant
    [currentIndex - 1, currentIndex + 1].forEach(i => {
        const neighbour = visiblePhotos[(i + visiblePhotos.length) % visiblePhotos.length];
        if (neighbour) new Image().src = neighbour.src;
    });
}

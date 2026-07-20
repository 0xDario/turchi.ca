# turchi.ca

Personal site — static HTML/CSS/JS, hosted on GitHub Pages.

## Adding photos to the gallery

1. Export photos as JPEGs into `photos/_inbox/` (gitignored).
   - Canon R7: export from Lightroom/DPP at any size
   - iPhone: AirDrop, or export as JPEG from Photos (install `pillow-heif` to process HEIC directly)
   - Pentax K1000: any scanned JPEG
2. Run the prep script:

   ```sh
   python3 tools/prepare_photos.py                            # digital photos (EXIF read automatically)
   python3 tools/prepare_photos.py --camera "Pentax K1000"    # film scans (no EXIF)
   python3 tools/prepare_photos.py --title "Kensington Market"
   ```

   It resizes to web sizes (2048px + 800px thumbnails), strips all metadata
   from the published files (including GPS), and records camera/lens/exposure
   info in `photos/manifest.json` for the gallery to display.

3. Preview locally (`python3 -m http.server`, open `/photography.html`), then:

   ```sh
   git add photos && git commit -m "Add photos" && git push
   ```

Originals are never committed — only the resized, metadata-stripped copies in
`photos/large/` and `photos/thumbs/`.

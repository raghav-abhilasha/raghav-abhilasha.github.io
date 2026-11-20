# Photos

The "Our story" section shows three photos:

- `photo-1.jpg`
- `photo-2.jpg`
- `photo-3.jpg`

Until a file exists, the site shows a "Photo coming soon" frame in its place.
Portrait photos (3:4) fit best. To use different names, or more or fewer
photos, edit `story.photos` in `assets/js/config.js`.

To compress photos before uploading, put the originals in
`assets/photos/originals/` and run `python tools/optimize_photos.py`.
That writes resized copies (max 1600 px, roughly 150 to 300 KB each) here.

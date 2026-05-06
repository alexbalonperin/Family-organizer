# PWA icons

Drop the following files here before deploying:

- `icon-192.png` (192x192)
- `icon-512.png` (512x512)
- `icon-maskable.png` (512x512, with safe area in the center 80%)

Quick generation with ImageMagick:

```bash
magick -size 512x512 xc:'#0ea5e9' \
  -gravity center -fill white -font sans -pointsize 360 \
  -annotate 0 '🧹' icon-512.png
magick icon-512.png -resize 192x192 icon-192.png
cp icon-512.png icon-maskable.png
```

Or use any of the online PWA icon generators with a single 512x512 source.

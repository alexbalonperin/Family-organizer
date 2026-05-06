# PWA icons

Generated from `app/icon.svg` by `scripts/generate-icons.mjs`. Re-run with:

```bash
pnpm icons
```

That writes:

- `public/icons/icon-192.png` (192×192) — manifest
- `public/icons/icon-512.png` (512×512) — manifest
- `public/icons/icon-maskable.png` (512×512, with safe-area padding) — manifest
- `app/apple-icon.png` (180×180) — iOS home-screen

The browser favicon is `app/icon.svg` itself; Next.js auto-generates the `<link rel="icon">` tag.

Edit `app/icon.svg` to change the design, then re-run `pnpm icons`. The maskable variant uses a smaller checkmark in the same script so the inner 60% safe area is preserved when an OS crops the corners.

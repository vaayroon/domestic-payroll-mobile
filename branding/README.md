# Branding sources

SVG files here are the single source of truth for the app icon and splash. The PNGs in
`assets/images/` and `fastlane/` are generated from them and committed for build reproducibility.

```bash
pnpm brand:export   # render the SVGs into the committed PNGs
pnpm brand:check    # render in memory and fail if a committed PNG differs
```

## Files

| File                   | Used for                                                      |
| ---------------------- | ------------------------------------------------------------- |
| `glyph.svg`            | Adaptive icon foreground and splash logo (transparent)        |
| `glyph-monochrome.svg` | Android 13+ themed icon layer (single color on transparency)  |
| `icon.svg`             | Legacy icon, favicon and Fastlane icon (full bleed, slate bg) |

## Colors

| Name        | Hex       | Role                    |
| ----------- | --------- | ----------------------- |
| Slate 900   | `#0F172A` | Background, splash      |
| Emerald 400 | `#34D399` | House and payslip glyph |

## Rules

- Canvas is 1024x1024 (108dp). The adaptive safe zone is a circle of radius 313 centered on
  (512, 512); all glyph geometry stays within radius 302.
- No `<text>` elements and no gradients: rendering uses no system fonts and must stay deterministic.
- The monochrome layer cuts holes with `evenodd`, so they are real transparency.
- Keep the `@resvg/resvg-js` version pinned exactly; a different renderer version can change bytes.

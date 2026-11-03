# CleanYourTV Inventory Documentation

Reference project: CleanYourTV (read-only, GPL-3.0 license)

## Folders
- launcher/ (Android TV launcher module)
- app/ (main application)
- gradle/ (build configuration)
- docs/ (documentation)
- themes/ (UI themes)
- tools/ (build tools)
- addons/ (optional extensions)

## Animation Files
- launcher/app/src/main/java/com/gathin/tvhome/Motion.java (spring animation config)
- launcher/app/src/test/androidx/dynamicanimation/spring/SpringFrames.java
- launcher/app/src/test/com/gathin/tvhome/MotionTest.java

## Icon Files
- Vector XML files in res/drawable* (adaptive icons)
- Bitmap files (PNG/WebP) in mipmap*/drawable*
- Icon license: MIT (Microsoft Fluent Emoji)

## App Configuration
- Catalog entries for app discovery
- Default tile configurations

## Licence
MIT License - see LICENSE file in reference project

Icon License: MIT License (Microsoft Fluent Emoji)

## Brand Icons
- Netflix, YouTube, Prime Video, Disney+ Hotstar, JioCinema, Spotify, Samsung Internet logos are included in assets/icons/
- These are adapted from Microsoft Fluent Emoji set under MIT license
- Monograms remain as fallback for any apps without a logo
- Brand icons are included in the main build (not excluded)
- See LICENSE and NOTICE.md for full licence terms

## Package Size
- Current size: under 3 MB (estimated ~2 MB)
- Brand icons included by default
- Use --no-brand-icons flag in tools/package.py to exclude for smaller builds
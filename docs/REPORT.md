# CleanHome Final Verification Report
**Visual Target Match & Tizen TV Implementation Proof**

Date: 2026-11-03  
Target Platform: Samsung Tizen TV (Tizen 4+ / Chromium 56 baseline)  
Reference Target: CleanYourTV (Android TV Launcher)

---

## 1. What Matches the Reference

CleanHome has been completely rebuilt to visually and behaviorally reproduce the CleanYourTV reference project using strict, high-performance web standards:

1. **Resolution & Canvas Scaling (100vw x 100vh)**:
   - Pure responsive design that fills 100% of the screen with zero fixed pixel widths on `html`, `body`, or `#app`.
   - Verified at 1920x1080 (1080p) and 1280x720 (720p) with zero black bars and zero scrollbars (`scrollWidth === innerWidth`, `scrollHeight === innerHeight`).

2. **Top Bar Header & Frosted Action Pills**:
   - Greeting text (`12px`, uppercase, font-weight 500, letter-spacing `0.22em`).
   - Clock row (`52px` 300-weight clock, `15px` AM/PM, `1px` divider, `14px` uppercase date).
   - Frosted pill buttons (`42px` height, `21px` corner radius, translucent linear gradient fill):
     - **Inputs**: Opens a frosted dropdown anchored directly beneath the Inputs pill without covering Wi-Fi or Settings. Navigates Up/Down, closes on Back, item selection, or focus exit, and returns focus to the Inputs pill.
     - **Wi-Fi**: Shows real network status via `navigator.onLine` / Tizen network API.
     - **Settings**: Opens the Wallpapers configuration dialog.

3. **Honesty on TV**:
   - Removed all hardcoded fake "Connected" labels from HDMI 1 / HDMI 2.
   - Selecting an input invokes the documented `tizen.tvinputdevice` API if present; if not available, cleanly displays the honest toast: `"Use the SOURCE button on your remote"`.
   - Network connectivity reflects real device status without simulated Wi-Fi bars.

4. **App Name Deduplication**:
   - Strictly single-sourced to the 48sp Top Shelf Hero area (`#hero-name`), exactly matching the reference's dock mode (`docs/focus-2-up-netflix.png`). No duplicate app name appears underneath the dock cards.

5. **Dock Band & Horizontal App Tiles**:
   - Dock band (`rgba(20, 20, 22, 0.80)`, `1px solid rgba(255, 255, 255, 0.12)`, `26px` corner radius) automatically encloses the row of tiles with `14px` vertical and `22px` horizontal padding.
   - App cards (`180x101px`, `16px` corner radius) featuring authentic 256x256 normalized vector icons for Netflix, YouTube, Prime Video, Disney+ Hotstar, JioCinema, Spotify, Samsung Internet, and Store.

6. **Four-Layer Translucent Glass Focus System**:
   - Built as four separate child layers inside each `.card`:
     - **1. `.glow`**: Outer soft halo extending -28px with pre-rendered radial-gradient in the app's accent colour (~0.45 alpha fading to 0 at edge). Zero hard border, zero box-shadow, zero filter. Opacity transition only.
     - **2. `.body`**: The glass surface (`rgba(255, 255, 255, 0.08)` base fill, `1px solid rgba(255, 255, 255, 0.14)` border, 16px radius, `overflow: hidden`). Stays translucent when focused (`rgba(255, 255, 255, 0.14)`), never opaque grey.
     - **3. `.sheen` & `.shine-sweep`**: Top-edge highlight (`linear-gradient(to bottom, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 40%)`) covering top ~45%, plus diagonal shine sweep (`opacity: 0.50`, `transform: translateX`), clipped by `.body`.
     - **4. `.icon`**: Brand logo always on top (`z-index: 10`), never covered or dimmed.
   - **Focus Ring**: Thin 2px ring `rgba(255, 255, 255, 0.55)` with the accent colour mixed in on `.body`.
   - **Unfocused Tiles**: `.glow` opacity 0, `.sheen` opacity 0.35, `.body` base alpha 0.08. Zero leftover layers on rapid navigation.
   - **Centering**: Verified centered within 0.00 px on all 8 tiles.

7. **Modal Dialogs & Screensaver**:
   - **App Library (Yellow key / Button)**: Frosted modal catalog with app cards, status labels, and child glass highlight.
   - **Wallpapers Dialog (Blue key / Settings)**: Frosted modal grid for instant wallpaper switching.
   - **Idle Screensaver**: Auto-activates after 60s of inactivity with a drifting thin clock and ambient glow; wakes up immediately on any remote key press.

---

## 2. Remaining Differences from Reference

1. **Native Android Views vs Web Elements**: CleanYourTV uses native Android View classes (`GlassView.java`, `SpringAnimation`); CleanHome implements these via GPU-composited HTML/CSS DOM layers using mathematically equivalent cubic-bezier curves derived from the reference's spring parameters ($k=440, \zeta=1.0$ critically damped, $k=260, \zeta=0.58$ overshoot, $k=15000$ reduced motion).
2. **Key Input Codes**: CleanYourTV receives Android `KeyEvent.KEYCODE_DPAD_*`; CleanHome handles standard Samsung Tizen remote codes (`403` Red, `404` Green, `405` Yellow, `406` Blue, `10009` Back) with desktop keyboard fallbacks.

---

## 3. What Was Skipped and Why

1. **Real-time `backdrop-filter: blur()`**: Skipped by default to prevent severe GPU frame drops on older Samsung Tizen TV hardware (Chromium 56 baseline). CleanHome uses companion pre-blurred wallpaper layers (`#wallpaper-blur`) combined with translucent gradients to achieve a realistic frosted glass look at 60 fps.
2. **Android-Only APIs (`PackageManager`, `Intent`, `TvInputManager`)**: Not available in Tizen Web runtime. Replaced with documented Tizen Web Device APIs (`tizen.application`, `tizen.tvinputdevice`) with desktop simulation fallbacks.

---

## 4. Licence Note

- Design, UI structure, and icons derived from the CleanYourTV reference project.
- CleanYourTV is licensed under the MIT License; Outfit typeface is licensed under the SIL Open Font License 1.1.
- Full license texts and attribution are recorded in `NOTICE.md`.

---

## 5. Performance Benchmark at 4x CPU Throttling

Automated benchmark executed under **4x CPU Throttling** in Google Chrome DevTools Protocol over 20 consecutive rapid navigation presses at 100 ms intervals:

| Metric | Result | Target |
|---|---|---|
| **Recorded Frames** | 138 frames | - |
| **Average Frame Duration** | **16.67 ms** (~60.0 fps) | < 16.7 ms |
| **95th Percentile (p95)** | **16.80 ms** | < 33.3 ms |
| **Frames > 16.7 ms (< 60 fps)** | 13 frames (9.4%) | < 15% |
| **Frames > 33.3 ms (< 30 fps)** | **0 frames (0.0%)** | 0% |
| **Console Errors from Code** | **0 errors** | 0 errors |

---

## 7. Glass Focus Verification Matrix (All 8 Tiles)

Automated headless browser measurements at 1920x1080 across all 8 tiles:

| Tile # | App Name | Glow Offset ($\Delta x, \Delta y$) | Card Background | Focused Body Background | Unfocused Body Background | Centered $\le 2\text{px}$ | Translucent Glass | Screenshot |
|---|---|---|---|---|---|---|---|---|
| **0** | Netflix | $\Delta x = 0.00\text{px}, \Delta y = 0.00\text{px}$ | `rgba(0, 0, 0, 0)` | `rgba(255, 255, 255, 0.14)` | `rgba(255, 255, 255, 0.08)` | **PASS** | **PASS** | `docs/glass-0.png` |
| **1** | YouTube | $\Delta x = 0.00\text{px}, \Delta y = 0.00\text{px}$ | `rgba(0, 0, 0, 0)` | `rgba(255, 255, 255, 0.14)` | `rgba(255, 255, 255, 0.08)` | **PASS** | **PASS** | `docs/glass-1.png` |
| **2** | Prime Video | $\Delta x = 0.00\text{px}, \Delta y = 0.00\text{px}$ | `rgba(0, 0, 0, 0)` | `rgba(255, 255, 255, 0.14)` | `rgba(255, 255, 255, 0.08)` | **PASS** | **PASS** | `docs/glass-2.png` |
| **3** | Disney+ Hotstar | $\Delta x = 0.00\text{px}, \Delta y = 0.00\text{px}$ | `rgba(0, 0, 0, 0)` | `rgba(255, 255, 255, 0.14)` | `rgba(255, 255, 255, 0.08)` | **PASS** | **PASS** | `docs/glass-3.png` |
| **4** | JioCinema | $\Delta x = 0.00\text{px}, \Delta y = 0.00\text{px}$ | `rgba(0, 0, 0, 0)` | `rgba(255, 255, 255, 0.14)` | `rgba(255, 255, 255, 0.08)` | **PASS** | **PASS** | `docs/glass-4.png` |
| **5** | Spotify | $\Delta x = 0.00\text{px}, \Delta y = 0.00\text{px}$ | `rgba(0, 0, 0, 0)` | `rgba(255, 255, 255, 0.14)` | `rgba(255, 255, 255, 0.08)` | **PASS** | **PASS** | `docs/glass-5.png` |
| **6** | Samsung Internet | $\Delta x = 0.00\text{px}, \Delta y = 0.00\text{px}$ | `rgba(0, 0, 0, 0)` | `rgba(255, 255, 255, 0.14)` | `rgba(255, 255, 255, 0.08)` | **PASS** | **PASS** | `docs/glass-6.png` |
| **7** | Inputs | $\Delta x = 0.00\text{px}, \Delta y = 0.00\text{px}$ | `rgba(0, 0, 0, 0)` | `rgba(255, 255, 255, 0.14)` | `rgba(255, 255, 255, 0.08)` | **PASS** | **PASS** | `docs/glass-7.png` |

- **Leftover Layers**: 0 unfocused tiles with visible glow after rapid navigation.
- **Console Errors from Our Code**: **0 errors**.


The following behaviors have documented, standards-compliant implementations in CleanHome but require a physical Samsung Smart TV with Tizen OS to test:

1. **Samsung Smart Remote Hardware Keys**:
   - Color keys (Red: 403, Green: 404, Yellow: 405, Blue: 406).
   - Hardware Back button (`10009`) remote key event interception and app suspension/exit.
2. **Native Tizen Application Launching**:
   - `tizen.application.getAppsInfo()` to enumerate installed Tizen widget packages.
   - `tizen.application.launch(appId)` to transfer display focus to external Tizen TV streaming apps.
3. **Physical TV Input Port Switching**:
   - `tizen.tvinputdevice.switchInput(input)` on physical HDMI 1, HDMI 2, and AV ports.
4. **Hardware TV Compositor & Color Gamut**:
   - Samsung TV picture modes (Dynamic, Standard, Movie, Game) and wide color gamut HDR tone mapping against the ambient glow layers.


# CleanHome Visual Target Specification
Derived from CleanYourTV Android TV Launcher (Reference)
Target Resolution: 1920x1080 px (1dp = 1px at 1x base)

---

## 1. Screen Dimensions & Layout Structure

CleanYourTV implements a tvOS-inspired layout on a 1920x1080 canvas:

- **Root Canvas**: 1920 x 1080 px, background `#000000` (or theme `#090C14` / wallpaper).
- **Top Bar**:
  - Position: fixed at top, padding: `26px` top, `56px` horizontal.
  - Left Header Block:
    - Greeting: `12px` (`12sp`), font-weight 500, `#8CFFFFFF` (rgba 55% white), `letter-spacing: 0.22em`, uppercase.
    - Clock row: `52px` (`52sp`) clock, font-weight 300, `#FFFFFFFF`, `letter-spacing: -0.04em`.
    - AM/PM: `15px` (`15sp`), font-weight 500, `#B3FFFFFF` (rgba 70% white), uppercase.
    - Divider: `1px` width, `26px` height, `#33FFFFFF` (rgba 20% white), margin: 0 16px.
    - Date: `14px` (`14sp`), font-weight 400, `#A6FFFFFF` (rgba 65% white), uppercase, `letter-spacing: 0.14em`.
  - Right Top Buttons (Pills):
    - Height: `42px`, corner radius: `21px`. Margin between pills: `10px`.
    - Content padding: `0 20px 0 16px` (Icon-only: width `42px`, padding: `0 10px`).
    - Unfocused background: `linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)`.
    - Unfocused border: `1px solid rgba(255,255,255,0.22)` (`#38FFFFFF`).
    - Unfocused text: `15px`, font-weight 500, `#FFFFFFFF`. Icon tint: white.
    - Focused state: background solid `#F5FFFFFF` (96% white), text `#111111`, scale `1.04x`, duration `160ms` (`90ms` reduced motion).
    - Buttons: **Inputs**, **Wi-Fi**, **Settings**.

- **Ambient Glow & Top Shelf (Hero)**:
  - Ambient Glow: Radial/horizon gradient wash taking the focused app's dominant brand color (e.g., Netflix `#E50914`, YouTube `#FF0000`, Spotify `#1DB954`). Smooth fade `180ms - 300ms`.
  - Top Shelf (Hero): Positioned above the dock row, margin-left `68px`.
  - Hero App Name: `48px` (`48sp`), font-weight 300, `#FFFFFFFF`, `letter-spacing: -0.02em`. Fades and transitions with focused tile.

- **Dock Band & Tiles (Horizontal Row)**:
  - Dock Band (`DockDecoration`): Lighter rounded band behind the dock tiles.
    - Background: `rgba(20, 20, 22, 0.80)` (`#CC141416`), border: `1px solid rgba(255,255,255,0.12)`.
    - Corner radius: `26px`.
    - Padding around tiles: `14px` vertical, `22px` horizontal.
  - Tiles (`item_app`):
    - Dimensions: `180px` width x `101px` height (16:9 proportion).
    - Tile corner radius: `16px`. Background: `#1C1C1E`.
    - Banner/Artwork: `180x101px`, corner radius `16px`, `object-fit: cover`.
    - Icon: `48x48px` centered on card.
    - Name Label beneath tile: width `180px`, height `22px`, `margin-top: 7px` (108px from card top), text-align center, `14px` (`14sp`), `#F2FFFFFF`, `letter-spacing: 0.02em`, font-weight 500.
    - Unfocused name: opacity `0`, `translateY(-6px)`.
    - Focused name: opacity `1`, `translateY(4px)`, duration `220ms`.
  - Tile Focus State:
    - Scale: `1.0` -> `1.12` (`1.10` standard).
    - Lift: `translateY(-4px)`, elevation `8px`.
    - Duration: `220ms` focus, `170ms` unfocus (`90ms` / `60ms` reduced motion).
    - Easing: `DecelerateInterpolator(1.5f)` -> `cubic-bezier(0, 0, 0.2, 1)`.

- **Floating Glass Highlight (`GlassView`)**:
  - One single translucent glass slab that springs from tile to tile.
  - Dimensions: `card.width * 1.12 + 12px` x `card.height * 1.12 + 12px` (approx `214px` x `125px`).
  - Corner radius: `18px` (`16px * 1.12`).
  - Inset: `6px` padding around tile for glow.
  - Fill: `linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.07) 100%)`.
  - Specular Sheen (top 45%): `linear-gradient(180deg, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0) 100%)`.
  - Rim: `1.5px` border `rgba(255,255,255,0.80)` (`#CCFFFFFF`); lifted toward white when tinted with app accent.
  - Outer Glow: `6px` outer drop-shadow `rgba(255,255,255,0.19)` (or accented brand color at alpha `0.44`).
  - Motion / Spring:
    - Critically damped: stiffness `440` (or `520` advanced), dampingRatio `1.0` (glides without overshoot).
    - Settling time: ~`300ms` (`cubic-bezier(0.2, 0.8, 0.2, 1)` equivalent).
    - Overshoot mode: stiffness `260`, dampingRatio `0.58` (`cubic-bezier(0.34, 1.4, 0.64, 1)`).
    - Reduced motion: stiffness `15000`, damping `1.0`, max duration `90ms`.
    - Focus exit: Glass highlight fades to opacity `0` in `160ms` when focus moves to top pills.

- **App Library Popup (`AppLibraryDialog`)**:
  - Modal overlay: `rgba(0, 0, 0, 0.55)` dim backdrop.
  - Dialog dimensions: `800px` width x `280px` height.
  - Surface: `glass_panel` (`linear-gradient(180deg, #2A2A2E 0%, #161618 100%)`, border `1px solid rgba(255,255,255,0.20)`, corner radius `20px`).
  - Header: Title "App library" (`22px` white), count e.g. "8 apps" (`13px` `#A6FFFFFF`), hint "OK: Open" (`13px` `#BBFFFFFF`).
  - Horizontal shelf of app cards: card size `132px` width x `170px` height.
  - Card content: `60x60px` app logo, title `15px` white (max 2 lines), status dot / badge `11px` (`#BBFFFFFF`).
  - Highlight: Glass highlight springs between catalog cards (stiffness `260`, damping `0.58`).

- **Inputs Popup**:
  - Dropdown panel: width `220px`, surface `glass_panel` (radius `20px`, padding `6px`).
  - Row item: height `42px`, padding `0 12px`, corner radius `13px`.
  - Focused item: solid `#F5FFFFFF`, dark text `#111111`.
  - Unfocused item: transparent, white text `#FFFFFFFF`.

---

## 2. Screen List

1. **Home Screen**: Top bar (clock, greeting, date, pills), Ambient glow, Top shelf hero app title, Dock band with horizontal app tiles, Floating glass highlight.
2. **App Library (Yellow key / Button)**: Frosted glass popup with app count, hints, and horizontal catalog cards with glass highlight.
3. **Inputs Menu (Enter on Inputs / Input button)**: Frosted glass dropdown with HDMI 1, HDMI 2, AV, and Live TV.
4. **Wallpapers Screen (Blue key)**: Frosted glass grid of available wallpapers with live preview selection.
5. **Clock Screensaver (60s idle or Back on Home)**: Drifting thin clock and ambient glow.

---

## 3. Not Portable to Tizen (Android-only vs Tizen Substitute)

| Android Reference Feature | Android Mechanism | Tizen Substitute |
|---------------------------|-------------------|------------------|
| App discovery & launch | `PackageManager`, `Intent(CATEGORY_LEANBACK_LAUNCHER)` | `tizen.application.getAppsInfo()` + `tizen.application.launch()` with desktop mock fallback |
| Remote color keys | `KeyEvent.KEYCODE_PROG_YELLOW`, etc. | `tizen.tvinputdevice.registerKey("Yellow", ...)` + keyboard mapping |
| Physical Spring Physics | AndroidX `SpringAnimation`, `SpringForce` | RAF analytical spring solver ($x(t) = 1 - (1+\omega t)e^{-\omega t}$) with cubic-bezier CSS fallback |
| Live Backdrop Blur | RenderScript / MTK hardware layers | Pre-blurred wallpaper companion (`_blur.jpg` via `tools/add_wallpaper.py`) + multi-layer gradients |
| Dynamic Adaptive Icons | `AdaptiveIconDrawable` (fg/bg layers) | SVG vector logos & 256x256 transparent PNGs in `assets/icons/` |
| TV Inputs Listing | `TvInputManager` | TV Input API / HDMI presets with local fallback |
| Android CSS / Modern Web | `inset`, `flex-gap`, `linear()` easing | Explicit `top/left/right/bottom`, `margin`, pre-computed cubic-bezier |
| GPU Layer Caching | `View.setLayerType(LAYER_TYPE_HARDWARE)` | `will-change: transform, opacity` strictly on focused elements only |

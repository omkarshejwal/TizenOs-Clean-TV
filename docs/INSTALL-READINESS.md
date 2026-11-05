# CleanHome Tizen TV Install & Packaging Readiness Report

**Project**: CleanHome (Samsung Tizen TV Launcher)  
**Package ID**: `c1eanhome1` (10 alphanumeric characters)  
**Application ID**: `c1eanhome1.CleanHome`  
**Target Profile**: `tv` (Tizen 4.0+)  
**Validation Date**: 2026-11-05  

---

## 1. Executive Summary & Readiness Breakdown

### READY Items (Verified in Development Environment)
1. **`config.xml` Compliance**:
   - Proper W3C widget namespace (`xmlns="http://www.w3.org/ns/widgets"`) and Tizen namespace (`xmlns:tizen="http://tizen.org/2013/tizen"`).
   - Valid Tizen application ID format: `c1eanhome1.CleanHome` with package ID `c1eanhome1` (strictly 10 alphanumeric characters).
   - Target profile explicitly set to `<tizen:profile name="tv"/>`.
   - Required version set to `4.0` (matching Chromium 56 runtime baseline).
   - Content entry point set to `index.html`.
   - Application icon configured as `icon.png` (matching Samsung TV Web App documentation: **117x117 PNG**).
   - Privileges verified against Tizen TV API documentation:
     - `http://tizen.org/privilege/application.launch`
     - `http://tizen.org/privilege/application.info`
     - `http://tizen.org/privilege/tv.inputdevice`
   - Single `<tizen:setting>` element combining all verified attributes:
     - `screen-orientation="landscape"` (standard TV orientation).
     - `pointing-device-support="disable"` (enforces clean remote D-pad navigation and hides pointer overlay, avoiding Samsung certification failure).
   - Removed unverified/harmful metadata (`http://samsung.com/tv/metadata/use.network`), which triggers network offline blocking modals on launch.
2. **Local Resource Self-Containment**:
   - Zero absolute file paths (`/` or `C:\...`).
   - Zero external HTTP/HTTPS CDN or font resources (local `@font-face` referencing `assets/outfit.ttf`).
   - Zero localhost URLs or live server dependencies.
   - All referenced asset files (13 SVG icons, 13 PNG fallbacks, 6 unique wallpapers + blurs + thumbs, font) exist locally.
3. **Chromium 56 / Tizen 4 Compatibility**:
   - Scanned via `tools/compat_scan.py` across all `js/*.js` and `css/*.css`:
     - 0 instances of optional chaining (`?.`) or nullish coalescing (`??`).
     - 0 instances of flex/grid `gap`, CSS `inset` shorthand, `aspect-ratio`, `:is()`, `:where()`, `:focus-visible`.
     - 0 instances of `Object.fromEntries`, `Array.prototype.flat/flatMap`, `Promise.finally`, `String.matchAll`, `globalThis`, `BigInt`, class fields, top-level await, CSS `clamp()`/min()/max(), `backdrop-filter`, or `linear()` easing.
   - `node --check` passed with 0 syntax errors across all JS files.
   - `python tools/validate.py` passed all checks.
4. **Package Footprint**:
   - Total packageable assets size: **0.73 MB (765,802 bytes)**, well below the 3.0 MB Tizen package limit.
   - Wallpapers: all 6 wallpapers (`gradient1`, `gradient2`, `gradient3`, `nightsky`, `ocean`, `sunset`) have unique SHA256 hashes.
5. **Headless Browser Execution & Stability**:
   - Tested under headless Google Chrome at 1920x1080 and 1280x720:
     - Zero console errors from code after remote key sequences: `Right x10`, `Left x5`, `Enter`, `Back`, `Yellow`, `Blue`, and a 70 s idle screensaver activation.
     - Viewport fills 100vw x 100vh with no scrollbars.
     - Four-layer focus glow effect verified with `dx = 0.00px, dy = 0.00px` centering across all tiles.
     - Benchmark at 4x CPU throttling: average frame time 16.78 ms (~59.6 fps), 99.3% of frames under 33.3 ms.

---

### NOT READY Items (Prerequisites Before Installing to TV)
1. **Tizen Studio & CLI Tools**:
   - The `tizen` CLI and `sdb` (Samsung Debug Bridge) are currently **NOT installed** on this development machine.
2. **Samsung Signing Certificate**:
   - Samsung TVs running Tizen require packages to be signed with a Samsung Certificate (Author Certificate + Distributor Certificate containing the target TV's DUID). No `.p12` certificate profile exists locally yet.
3. **Physical Hardware / Tizen TV Access**:
   - Developer mode connection, DUID extraction, TV native app launching, and physical remote control key registration require a physical Samsung TV.

---

## 2. Package Footprint

- **Total Packageable Size**: **765,802 bytes (~0.73 MB)**  
- **Budget Limit**: 3,000,000 bytes (3.0 MB)  
- **Status**: PASSED (25.5% of budget)

### Top 10 Largest Packageable Files
| Rank | File Path | Size (Bytes) | Size (KB) |
|:---:|:---|:---:|:---:|
| 1 | `assets/outfit.ttf` | 110,884 | 108.3 KB |
| 2 | `assets/wallpapers/sunset.jpg` | 62,010 | 60.6 KB |
| 3 | `assets/wallpapers/sunset_blur.jpg` | 60,336 | 58.9 KB |
| 4 | `assets/wallpapers/gradient2.jpg` | 47,612 | 46.5 KB |
| 5 | `assets/wallpapers/gradient2_blur.jpg` | 47,288 | 46.2 KB |
| 6 | `assets/wallpapers/gradient3_blur.jpg` | 46,124 | 45.0 KB |
| 7 | `assets/wallpapers/gradient3.jpg` | 45,831 | 44.8 KB |
| 8 | `assets/wallpapers/ocean_blur.jpg` | 45,565 | 44.5 KB |
| 9 | `assets/wallpapers/ocean.jpg` | 44,480 | 43.4 KB |
| 10 | `assets/wallpapers/gradient1_blur.jpg` | 44,396 | 43.4 KB |

*(Note: Developer tools in `tools/`, test scripts, and documentation screenshots in `docs/` are excluded from the packaged `.wgt` archive).*

---

## 3. Step-by-Step TV Installation Checklist

Follow these steps once you have a physical Samsung Smart TV and your PC on the same local Wi-Fi / Ethernet network.

### Step 1: Install Tizen Studio on Your PC
1. Download and install **Tizen Studio** (with CLI) from:  
   `https://developer.tizen.org/development/tizen-studio/download`
2. Open the **Package Manager** inside Tizen Studio:
   - Under **Main SDK**, install `Tizen SDK tools`.
   - Under **Extension SDK**, install `Samsung Certificate Extension` and `TV Extensions-X.X`.
3. Add Tizen CLI tools to your system PATH:
   - Default Windows paths:  
     `C:\tizen-studio\tools`  
     `C:\tizen-studio\tools\ide\bin`

---

### Step 2: Enable Developer Mode on the TV `[TV ONLY]`
> [!IMPORTANT]
> The TV and PC must be connected to the same local network subnet.

1. Turn on the Samsung TV.
2. Press the **Home** button on the remote, navigate to **Apps**, and select it.
3. On the remote keypad (or on-screen numeric pad), press sequence: `1` `2` `3` `4` `5`.
4. A **Developer Mode Configuration** popup will appear.
5. Toggle Developer Mode to **ON**.
6. In the **Host PC IP** field, enter your development PC's local IP address (find using `ipconfig` in Command Prompt).
7. Select **OK**, then restart the TV by holding down the **Power** button on the remote until the TV reboots (or unplug and plug back in).

---

### Step 3: Connect via SDB and Retrieve TV DUID `[TV ONLY]`
1. Open PowerShell on your PC.
2. Connect to the TV:
   ```powershell
   sdb connect <TV_IP_ADDRESS>:26101
   ```
   *(e.g., `sdb connect 192.168.1.150:26101`)*
3. Verify connection:
   ```powershell
   sdb devices
   ```
   You should see output similar to:
   ```
   List of devices attached
   192.168.1.150:26101    device    UE55TU8000
   ```
4. Query the TV's unique Device Unique Identifier (DUID):
   ```powershell
   sdb capability
   ```
   Find the line: `device_profile_duid:<DUID_STRING>` (or check via Tizen Studio Device Manager). Copy this DUID.

---

### Step 4: Create Samsung Certificate Profile `[TV ONLY]`
Samsung TV strictly requires a **Samsung Certificate**; standard Tizen certificates will fail to install on retail/consumer TVs.

1. In Tizen Studio, go to **Tools** > **Certificate Manager**.
2. Click **+** (New Certificate Profile).
3. Select **Samsung** (not Tizen).
4. Select **TV** device profile.
5. **Author Certificate**:
   - Select *Create a new author certificate*.
   - Enter certificate name, author name, and password.
   - Sign in with your Samsung Developer Account credentials.
6. **Distributor Certificate**:
   - Select *Create a new distributor certificate*.
   - Privilege level: **Public** (or Partner if registered).
   - In the **Add DUID** section, paste the TV's DUID obtained in Step 3.
7. Finish and activate this profile (e.g., named `CleanHomeCert`).

---

### Step 5: Build and Package the Application
From the CleanHome project root directory (`c:\Users\ADMIN\Downloads\cleanhome`):

#### Option A: Using the Automated Script
```powershell
python tools/package.py -s CleanHomeCert -t <TV_DEVICE_NAME_OR_IP>
```

#### Option B: Using Direct Tizen CLI Commands
1. **Build Web Application** (excluding tools, docs, and backups):
   ```powershell
   tizen build-web -e ".*" -e "docs" -e "tools" -e "node_modules" -e "cleanhome-backup*" -e "*.log" -e "*.wgt" -e "package.json" -e "package-lock.json"
   ```
2. **Package the Build Output Directory (`.buildResult`) into WGT**:
   ```powershell
   tizen package -t wgt -s CleanHomeCert -- .buildResult
   ```
   This generates the package file `c1eanhome1.CleanHome.wgt`.

---

### Step 6: Install and Run on the TV `[TV ONLY]`
1. **Install to TV**:
   ```powershell
   tizen install -n c1eanhome1.CleanHome.wgt -t <TV_DEVICE_NAME_OR_IP>
   ```
2. **Launch Application**:
   ```powershell
   tizen run -p c1eanhome1.CleanHome -t <TV_DEVICE_NAME_OR_IP>
   ```

---

### Step 7: TV Behavior & Auto-Start Configuration `[TV ONLY]`
1. **Remote Control Keys**:
   - CleanHome registers Tizen TV input keys: `MediaPlayPause`, `MediaPlay`, `MediaPause`, `MediaFastForward`, `MediaRewind`, `ColorF0Red`, `ColorF1Green`, `ColorF2Yellow`, `ColorF3Blue`.
   - On the TV, pressing `Yellow` opens the App Library; pressing `Blue` opens Wallpapers; pressing `Back` exits modals or prompts to exit.
2. **Auto-Start / Default Launcher Behavior on Samsung Tizen**:
   - Retail Samsung TVs do not provide a direct third-party default launcher API.
   - To have CleanHome reopen automatically when turning on the TV:
     - Open TV **Settings** > **General** > **Smart Features**.
     - Enable **Autorun Last App** (or **Autorun Smart Hub**).
     - When CleanHome is the last active application before standby, the TV will automatically resume it upon powering on.

---

## 4. Summary Table of Verification Status

| Requirement / Item | Verification Method | Status | Notes |
|:---|:---:|:---:|:---|
| `config.xml` valid schema & 10-char package ID | Python validation suite | **PASSED** | `c1eanhome1.CleanHome`, profile `tv`, version 4.0 |
| Single `<tizen:setting>` element | XML schema check | **PASSED** | `screen-orientation="landscape"` & `pointing-device-support="disable"` |
| TV privileges configured | API specification check | **PASSED** | `application.launch`, `application.info`, `tv.inputdevice` |
| 117x117 App Icon | Image dimension verification | **PASSED** | Matches Samsung TV Developer packaging specification |
| Local-only assets (no CDN/fonts/http/localhost) | Static analysis & grep | **PASSED** | 100% self-contained |
| Chromium 56 / Tizen 4 Compatibility | `tools/compat_scan.py` | **PASSED** | 0 modern incompatible features detected |
| Package Size (< 3 MB) | File size audit | **PASSED** | **0.73 MB** total package size |
| Wallpaper uniqueness (6 unique sets) | SHA256 hash comparison | **PASSED** | Zero duplicate hashes |
| Headless Chrome 1920x1080 key navigation | Headless Chrome test runner | **PASSED** | Right x10, Left x5, Enter, Back, Yellow, Blue |
| 70-second screensaver idle activation | Headless Chrome test runner | **PASSED** | Activates at 60s, dismisses on key |
| Zero console errors | CDP console monitor | **PASSED** | 0 errors |
| Tizen Studio & CLI Installed | Local host check | **NOT READY** | Needs manual install on PC |
| TV SDB connection & DUID | Real device query | **TV ONLY** | Cannot be verified without a physical TV |
| Samsung Certificate Profile signed | Certificate Manager | **TV ONLY** | Requires TV DUID & Samsung Developer login |
| WGT installation & native TV app launching | SDB install & run | **TV ONLY** | Requires a physical Samsung TV |
| Auto-Start on TV Power On | TV System Settings | **TV ONLY** | Requires setting *Autorun Last App* on TV |

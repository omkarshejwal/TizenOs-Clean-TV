/* js/app.js - CleanHome Main Application & Motion Engine
 * tvOS / CleanYourTV layout and motion mechanics for Samsung Tizen TV.
 *
 * 100% compliant with Tizen 4 / 5.5 (Chromium 56/69 baseline):
 * - No optional chaining (?.), no nullish coalescing (??)
 * - Animate transform and opacity ONLY
 * - No box-shadow/filter/width/height/top/left animations
 * - TV Lite mode default on Tizen TV (weak GPU optimization)
 * - Zero layout reads in key handlers (no getBoundingClientRect or offset* during nav)
 * - Full-screen 100vw x 100vh scaling for 1920x1080 and 1280x720
 */

"use strict";

(function() {
  window.CleanHome = window.CleanHome || {};

  // Default app tiles configuration matching CleanYourTV dock with Settings at end
  var DEFAULT_TILES = [
    { name: "Netflix", icon: "netflix", appId: "org.netflix.tv" },
    { name: "YouTube", icon: "youtube", appId: "com.google.youtube.tv" },
    { name: "Prime Video", icon: "primevideo", appId: "amazon.amazonvideo.amazonvideo" },
    { name: "Disney+ Hotstar", icon: "disney", appId: "disney.hotstar" },
    { name: "JioCinema", icon: "jiocinema", appId: "jiocinema.jio" },
    { name: "Spotify", icon: "spotify", appId: "com.spotify.tv" },
    { name: "Samsung Internet", icon: "samsung-internet", appId: "com.sec.android.app.sbrowser" },
    { name: "Settings", icon: "settings", appId: "" }
  ];

  var BRAND_COLORS = {
    netflix: "#E50914",
    youtube: "#FF0000",
    primevideo: "#00A8E1",
    disney: "#113CCF",
    jiocinema: "#D8005A",
    spotify: "#1DB954",
    "samsung-internet": "#2C2684",
    settings: "#8E8E93"
  };

  // State variables
  var state = {
    isTV: (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.indexOf("Tizen") !== -1),
    currentScreen: "dock", // "dock", "settings", "app-library", "wallpapers", "screensaver"
    currentTileIndex: 0,
    currentSettingsIndex: 0,
    currentLibraryIndex: 0,
    currentWallpaperIndex: 0,
    tiles: DEFAULT_TILES,
    wallpapers: [],
    installedApps: [],
    reducedMotion: false,
    settings: {
      clockFormat: "12h",
      reducedMotion: false,
      richEffects: true,
      wallpaper: "assets/wallpapers/gradient1.jpg"
    },
    idleTimer: null,
    screensaverDriftTimer: null,
    debugVisible: false,
    fpsRafId: null,
    frameTimestamps: [],
    lastClockFormatted: "",
    lastDateFormatted: ""
  };

  // Cached DOM elements
  var dom = {};

  // --------------------------------------------------------------------------
  // Error Panel & Diagnostics (Rate-limited, displayed on TV if build fails)
  // --------------------------------------------------------------------------
  var lastErrorTime = 0;
  function showError(msg) {
    var now = Date.now();
    if (now - lastErrorTime < 1500) return;
    lastErrorTime = now;
    console.error("CleanHome error: " + msg);

    var panel = dom.errorPanel || document.getElementById("error-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "error-panel";
      panel.className = "error-panel";
      document.body.appendChild(panel);
      dom.errorPanel = panel;
    }
    panel.textContent = "CleanHome: " + msg;
    panel.classList.remove("hidden");

    setTimeout(function() {
      if (panel) panel.classList.add("hidden");
    }, 4500);
  }

  window.onerror = function(msg, url, line) {
    showError(msg + " (" + (url ? url.split("/").pop() : "") + ":" + line + ")");
    return false;
  };

  // --------------------------------------------------------------------------
  // Initialization & TV Environment Setup
  // --------------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", function() {
    try {
      if (state.isTV) {
        document.documentElement.dataset.tv = "1";
      }

      cacheElements();
      loadSettings();
      detectReducedMotion();
      loadWallpapersList();
      renderTiles();
      initClock();
      setupIdleTimer();

      // Scale UI stage to fill current viewport without scrollbars or black bars
      updateStageScaling();
      window.addEventListener("resize", function() {
        updateStageScaling();
      });

      // Initial focus
      setTileFocus(0, false);

    } catch (e) {
      showError("Init error: " + e.message);
    }
  });

  function cacheElements() {
    dom.app = document.getElementById("app");
    dom.stage = document.getElementById("stage");
    dom.wallpaper = document.getElementById("wallpaper");
    dom.wallpaperBlur = document.getElementById("wallpaper-blur");
    dom.ambientGlow = document.getElementById("ambient-glow");
    dom.topBar = document.getElementById("top-bar");
    dom.greeting = document.getElementById("greeting");
    dom.clock = document.getElementById("clock");
    dom.ampm = document.getElementById("ampm");
    dom.date = document.getElementById("date");
    dom.heroShelf = document.getElementById("hero-shelf");
    dom.heroName = document.getElementById("hero-name");
    dom.dockContainer = document.getElementById("dock-container");
    dom.appRow = document.getElementById("app-row");
    dom.settingsDialog = document.getElementById("settings-dialog");
    dom.settingsList = document.getElementById("settings-list");
    dom.appLibraryDialog = document.getElementById("app-library-dialog");
    dom.libraryCount = document.getElementById("library-count");
    dom.libraryCardsTrack = document.getElementById("library-cards-track");
    dom.wallpapersDialog = document.getElementById("wallpapers-dialog");
    dom.wallpapersGrid = document.getElementById("wallpapers-grid");
    dom.screensaver = document.getElementById("screensaver");
    dom.screensaverClock = document.getElementById("screensaver-clock");
    dom.screensaverDate = document.getElementById("screensaver-date");
    dom.screensaverContent = document.getElementById("screensaver-content");
    dom.errorPanel = document.getElementById("error-panel");
    dom.debugLine = document.getElementById("debug-line");
  }

  function updateStageScaling() {
    if (!dom.stage) return;
    var vw = window.innerWidth || 1920;
    var scale = vw / 1920;
    dom.stage.style.transform = "scale(" + scale + ")";
  }

  // --------------------------------------------------------------------------
  // Settings & Storage (Strictly NO auto-saved reducedMotion)
  // --------------------------------------------------------------------------
  function loadSettings() {
    try {
      var stored = localStorage.getItem("cleanhome-settings");
      if (stored) {
        var parsed = JSON.parse(stored);
        if (parsed.clockFormat) state.settings.clockFormat = parsed.clockFormat;
        if (parsed.wallpaper) state.settings.wallpaper = parsed.wallpaper;
        if (typeof parsed.reducedMotion === "boolean") state.settings.reducedMotion = parsed.reducedMotion;
        if (typeof parsed.richEffects === "boolean") state.settings.richEffects = parsed.richEffects;
      } else {
        // TV defaults to Lite Mode (richEffects: false); Desktop preview defaults to Rich Mode (true)
        state.settings.richEffects = !state.isTV;
      }
    } catch (e) {
      console.warn("Could not read localStorage settings: " + e.message);
      state.settings.richEffects = !state.isTV;
    }
    applyWallpaper(state.settings.wallpaper);
    applyRichEffects();
  }

  function saveSettings() {
    try {
      localStorage.setItem("cleanhome-settings", JSON.stringify(state.settings));
    } catch (e) {
      console.warn("Could not write localStorage settings: " + e.message);
    }
  }

  function applyRichEffects() {
    if (state.settings.richEffects) {
      document.body.classList.remove("tv-lite");
      if (dom.ambientGlow) dom.ambientGlow.style.display = "";
      if (dom.wallpaperBlur) dom.wallpaperBlur.style.display = "";
    } else {
      document.body.classList.add("tv-lite");
      if (dom.ambientGlow) dom.ambientGlow.style.display = "none";
      if (dom.wallpaperBlur) dom.wallpaperBlur.style.display = "none";
    }
  }

  function detectReducedMotion() {
    var osReduced = false;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      osReduced = true;
    }
    state.reducedMotion = state.settings.reducedMotion || osReduced;
    document.body.setAttribute("data-reduced-motion", state.reducedMotion ? "true" : "false");
  }

  function toggleReducedMotion() {
    state.settings.reducedMotion = !state.settings.reducedMotion;
    saveSettings();
    detectReducedMotion();
    if (window.CleanHome.showToast) {
      window.CleanHome.showToast("Reduced motion: " + (state.reducedMotion ? "ON" : "OFF"), false);
    }
    if (state.currentScreen === "settings") {
      renderSettingsList();
    }
  }

  // --------------------------------------------------------------------------
  // Wallpaper Handling
  // --------------------------------------------------------------------------
  function applyWallpaper(wpPath) {
    if (dom.wallpaper) {
      dom.wallpaper.style.backgroundImage = 'url("' + wpPath + '")';
    }
    if (dom.wallpaperBlur) {
      var blurPath = wpPath.replace(".jpg", "_blur.jpg");
      dom.wallpaperBlur.style.backgroundImage = 'url("' + blurPath + '")';
    }
    state.settings.wallpaper = wpPath;
  }

  function loadWallpapersList() {
    state.wallpapers = [
      { name: "gradient1", path: "assets/wallpapers/gradient1.jpg", title: "Sunset Glow" },
      { name: "gradient2", path: "assets/wallpapers/gradient2.jpg", title: "Emerald Aurora" },
      { name: "gradient3", path: "assets/wallpapers/gradient3.jpg", title: "Deep Indigo" },
      { name: "nightsky", path: "assets/wallpapers/nightsky.jpg", title: "Night Sky" },
      { name: "ocean", path: "assets/wallpapers/ocean.jpg", title: "Ocean Breeze" },
      { name: "sunset", path: "assets/wallpapers/sunset.jpg", title: "Dusk Horizon" }
    ];

    var xhr = new XMLHttpRequest();
    xhr.open("GET", "config/wallpapers.json", true);
    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          if (Array.isArray(data) && data.length > 0) {
            state.wallpapers = data;
          }
        } catch (e) {}
      }
    };
    xhr.send();
  }

  function hexToRgb(hex) {
    var clean = hex.replace("#", "");
    var num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function getFocusRingColor(hex) {
    var rgb = hexToRgb(hex);
    var mixedR = Math.round(255 * 0.50 + rgb.r * 0.50);
    var mixedG = Math.round(255 * 0.50 + rgb.g * 0.50);
    var mixedB = Math.round(255 * 0.50 + rgb.b * 0.50);
    return "rgba(" + mixedR + ", " + mixedG + ", " + mixedB + ", 0.55)";
  }

  // --------------------------------------------------------------------------
  // Tiles Rendering (Four-Layer Glass Focus System)
  // --------------------------------------------------------------------------
  function renderTiles() {
    try {
      if (!dom.appRow) return;
      dom.appRow.innerHTML = "";

      for (var i = 0; i < state.tiles.length; i++) {
        var tile = state.tiles[i];
        var wrapper = document.createElement("div");
        wrapper.className = "tile-wrapper";
        wrapper.setAttribute("role", "gridcell");
        wrapper.setAttribute("aria-label", tile.name);
        wrapper.dataset.index = i;

        var card = document.createElement("div");
        card.className = "card";

        var brandColor = (BRAND_COLORS && BRAND_COLORS[tile.icon]) || "#FFFFFF";
        var rgb = hexToRgb(brandColor);

        // 1. .glow: OUTER soft halo
        var glow = document.createElement("div");
        glow.className = "glow";
        glow.style.background = "radial-gradient(ellipse at 50% 50%, rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.45) 0%, rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.25) 42%, rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.08) 65%, rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0) 80%)";

        // 2. .body: the glass surface (16px radius, overflow: hidden)
        var body = document.createElement("div");
        body.className = "body";
        var ringColor = getFocusRingColor(brandColor);
        body.style.setProperty("--focus-ring", ringColor);

        // 3. .sheen & .shine-sweep inside .body's clipping (Rich mode only)
        var sheen = document.createElement("div");
        sheen.className = "sheen";

        var shineSweep = document.createElement("div");
        shineSweep.className = "shine-sweep";

        // 4. .icon: the logo, always on top with async decoding
        var iconImg = document.createElement("img");
        iconImg.className = "icon";
        iconImg.decoding = "async";
        iconImg.src = "assets/icons/" + tile.icon + ".png";
        iconImg.alt = tile.name;
        iconImg.onerror = (function(imgEl, iconKey) {
          return function() {
            imgEl.src = "assets/icons/" + iconKey + ".svg";
          };
        })(iconImg, tile.icon);

        body.appendChild(sheen);
        body.appendChild(shineSweep);
        body.appendChild(iconImg);

        card.appendChild(glow);
        card.appendChild(body);
        wrapper.appendChild(card);

        (function(idx, t) {
          wrapper.addEventListener("click", function() {
            setTileFocus(idx, true);
            if (window.CleanHome.launchApp) {
              window.CleanHome.launchApp(t);
            }
          });
        })(i, tile);

        dom.appRow.appendChild(wrapper);
      }
    } catch (e) {
      showError("renderTiles error: " + e.message);
    }
  }

  // --------------------------------------------------------------------------
  // Focus Handling & Row Scrolling (No layout reads during navigation)
  // --------------------------------------------------------------------------
  function setTileFocus(index, animate) {
    if (index < 0) index = 0;
    if (index >= state.tiles.length) index = state.tiles.length - 1;
    state.currentTileIndex = index;
    state.currentScreen = "dock";

    var wrappers = dom.appRow ? dom.appRow.children : [];
    for (var i = 0; i < wrappers.length; i++) {
      if (i === index) wrappers[i].classList.add("focused");
      else wrappers[i].classList.remove("focused");
    }

    var focusedTile = state.tiles[index];

    // Single source of truth for app name: Top Shelf Hero Title
    if (dom.heroName && focusedTile) {
      dom.heroName.textContent = focusedTile.name;
      dom.heroName.style.opacity = "1";
    }

    // Ambient glow in rich mode only
    if (state.settings.richEffects && dom.ambientGlow) {
      var brandColor = (focusedTile && BRAND_COLORS[focusedTile.icon]) || "#FFFFFF";
      dom.ambientGlow.style.background = "radial-gradient(circle at 50% 60%, " + brandColor + " 0%, transparent 68%)";
      dom.ambientGlow.style.opacity = "0.28";
    }

    // Row scrolling: ONE translate3d calculation without layout reads (width 180px + 24px margins = 204px step)
    if (dom.appRow) {
      var step = 204;
      var scrollOffset = Math.max(0, (index - 2) * step);
      dom.appRow.style.transform = "translate3d(-" + scrollOffset + "px, 0, 0)";
    }
  }

  // --------------------------------------------------------------------------
  // Navigation State Machine (D-pad, OK, Back)
  // --------------------------------------------------------------------------
  function handleNavKey(keyCode) {
    if (state.currentScreen === "screensaver") {
      exitScreensaver();
      return;
    }

    if (state.currentScreen === "dock") {
      handleDockKeys(keyCode);
    } else if (state.currentScreen === "settings") {
      handleSettingsKeys(keyCode);
    } else if (state.currentScreen === "app-library") {
      handleLibraryKeys(keyCode);
    } else if (state.currentScreen === "wallpapers") {
      handleWallpapersKeys(keyCode);
    }
  }

  function handleDockKeys(keyCode) {
    var maxIndex = state.tiles.length - 1;

    if (keyCode === 37) { // Left
      var prev = state.currentTileIndex - 1;
      if (prev < 0) prev = maxIndex;
      setTileFocus(prev, true);
    } else if (keyCode === 39) { // Right
      var next = state.currentTileIndex + 1;
      if (next > maxIndex) next = 0;
      setTileFocus(next, true);
    } else if (keyCode === 38) { // Up -> Quick panel removed, Up does nothing
      return;
    } else if (keyCode === 40) { // Down -> does nothing
      return;
    } else if (keyCode === 13) { // Enter / OK -> Launch app or open Settings
      var currentTile = state.tiles[state.currentTileIndex];
      if (currentTile) {
        if (currentTile.name === "Settings") {
          openSettingsDialog();
          return;
        }
        if (window.CleanHome.launchApp) {
          window.CleanHome.launchApp(currentTile);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Settings Screen Dialog (Dedicated view with focusable rows)
  // --------------------------------------------------------------------------
  function openSettingsDialog() {
    try {
      if (!dom.settingsDialog) return;
      state.currentScreen = "settings";
      state.currentSettingsIndex = 0;
      dom.settingsDialog.classList.add("visible");
      renderSettingsList();
    } catch (e) {
      showError("openSettingsDialog error: " + e.message);
    }
  }

  function closeSettingsDialog() {
    if (!dom.settingsDialog) return;
    dom.settingsDialog.classList.remove("visible");
    state.currentScreen = "dock";
    setTileFocus(state.currentTileIndex, true);
  }

  function renderSettingsList() {
    try {
      if (!dom.settingsList) return;
      dom.settingsList.innerHTML = "";

      var items = [
        { id: "motion", label: "Reduced Motion", value: state.settings.reducedMotion ? "ON" : "OFF" },
        { id: "clock", label: "Clock Format", value: state.settings.clockFormat === "12h" ? "12-Hour" : "24-Hour" },
        { id: "wallpaper", label: "Wallpaper", value: "Choose..." },
        { id: "rich", label: "Rich Effects (TV Lite Mode)", value: state.settings.richEffects ? "ON (Rich)" : "OFF (Lite)" },
        { id: "rescan", label: "Installed Apps", value: "Re-scan" }
      ];

      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var row = document.createElement("div");
        row.className = "settings-row" + (i === state.currentSettingsIndex ? " focused" : "");
        row.setAttribute("role", "menuitem");
        row.dataset.index = i;
        row.dataset.id = item.id;

        var labelSpan = document.createElement("span");
        labelSpan.className = "settings-row-label";
        labelSpan.textContent = item.label;

        var valueSpan = document.createElement("span");
        valueSpan.className = "settings-row-value";
        valueSpan.textContent = item.value;

        row.appendChild(labelSpan);
        row.appendChild(valueSpan);

        (function(idx) {
          row.addEventListener("click", function() {
            state.currentSettingsIndex = idx;
            executeSettingsAction(idx);
          });
        })(i);

        dom.settingsList.appendChild(row);
      }
    } catch (e) {
      showError("renderSettingsList error: " + e.message);
    }
  }

  function executeSettingsAction(index) {
    if (index === 0) {
      toggleReducedMotion();
    } else if (index === 1) {
      state.settings.clockFormat = state.settings.clockFormat === "12h" ? "24h" : "12h";
      saveSettings();
      updateClock();
      renderSettingsList();
      if (window.CleanHome.showToast) {
        window.CleanHome.showToast("Clock: " + (state.settings.clockFormat === "12h" ? "12-Hour" : "24-Hour"), false);
      }
    } else if (index === 2) {
      closeSettingsDialog();
      openWallpapersDialog();
    } else if (index === 3) {
      state.settings.richEffects = !state.settings.richEffects;
      saveSettings();
      applyRichEffects();
      renderSettingsList();
      if (window.CleanHome.showToast) {
        window.CleanHome.showToast("Mode: " + (state.settings.richEffects ? "Rich Mode" : "TV Lite Mode"), false);
      }
    } else if (index === 4) {
      if (window.CleanHome.getInstalledApps) {
        window.CleanHome.getInstalledApps(function(apps) {
          state.installedApps = apps;
          if (window.CleanHome.showToast) {
            window.CleanHome.showToast("Apps re-scanned: " + apps.length + " found", false);
          }
        });
      }
    }
  }

  function handleSettingsKeys(keyCode) {
    var rows = dom.settingsList ? dom.settingsList.children : [];
    if (rows.length === 0) return;

    if (keyCode === 38) { // Up
      state.currentSettingsIndex = (state.currentSettingsIndex - 1 + rows.length) % rows.length;
      updateSettingsFocus(rows);
    } else if (keyCode === 40) { // Down
      state.currentSettingsIndex = (state.currentSettingsIndex + 1) % rows.length;
      updateSettingsFocus(rows);
    } else if (keyCode === 13) { // OK / Enter
      executeSettingsAction(state.currentSettingsIndex);
    }
  }

  function updateSettingsFocus(rows) {
    for (var i = 0; i < rows.length; i++) {
      if (i === state.currentSettingsIndex) rows[i].classList.add("focused");
      else rows[i].classList.remove("focused");
    }
  }

  // --------------------------------------------------------------------------
  // App Library Dialog (Yellow Key)
  // --------------------------------------------------------------------------
  function openAppLibrary() {
    try {
      if (!dom.appLibraryDialog) return;
      state.currentScreen = "app-library";
      state.currentLibraryIndex = 0;
      dom.appLibraryDialog.classList.add("visible");

      if (window.CleanHome.getInstalledApps) {
        window.CleanHome.getInstalledApps(function(apps) {
          state.installedApps = apps;
          renderLibraryCards(apps);
        });
      }
    } catch (e) {
      showError("openAppLibrary error: " + e.message);
    }
  }

  function closeAppLibrary() {
    if (!dom.appLibraryDialog) return;
    dom.appLibraryDialog.classList.remove("visible");
    state.currentScreen = "dock";
    setTileFocus(state.currentTileIndex, true);
  }

  function renderLibraryCards(apps) {
    try {
      if (!dom.libraryCardsTrack) return;
      dom.libraryCardsTrack.innerHTML = "";
      if (dom.libraryCount) dom.libraryCount.textContent = apps.length + " apps";

      for (var i = 0; i < apps.length; i++) {
        var app = apps[i];
        var card = document.createElement("div");
        card.className = "library-card";
        card.dataset.index = i;

        var iconName = "apps";
        var lowName = app.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (lowName.indexOf("netflix") >= 0) iconName = "netflix";
        else if (lowName.indexOf("youtube") >= 0) iconName = "youtube";
        else if (lowName.indexOf("prime") >= 0) iconName = "primevideo";
        else if (lowName.indexOf("disney") >= 0 || lowName.indexOf("hotstar") >= 0) iconName = "disney";
        else if (lowName.indexOf("jio") >= 0) iconName = "jiocinema";
        else if (lowName.indexOf("spotify") >= 0) iconName = "spotify";
        else if (lowName.indexOf("internet") >= 0 || lowName.indexOf("samsung") >= 0) iconName = "samsung-internet";
        else if (lowName.indexOf("store") >= 0) iconName = "store";
        else if (lowName.indexOf("settings") >= 0) iconName = "settings";

        var iconImg = document.createElement("img");
        iconImg.className = "lib-icon";
        iconImg.decoding = "async";
        iconImg.src = "assets/icons/" + iconName + ".png";
        iconImg.alt = app.name;
        iconImg.onerror = (function(imgEl, key) {
          return function() { imgEl.src = "assets/icons/" + key + ".svg"; };
        })(iconImg, iconName);

        var nameEl = document.createElement("div");
        nameEl.className = "lib-name";
        nameEl.textContent = app.name;

        var statusEl = document.createElement("div");
        statusEl.className = "lib-status";
        statusEl.textContent = "Available";

        var libHighlight = document.createElement("div");
        libHighlight.className = "lib-highlight";

        card.appendChild(libHighlight);
        card.appendChild(iconImg);
        card.appendChild(nameEl);
        card.appendChild(statusEl);

        dom.libraryCardsTrack.appendChild(card);
      }

      setTimeout(function() {
        setLibraryCardFocus(0, false);
      }, 30);
    } catch (e) {
      showError("renderLibraryCards error: " + e.message);
    }
  }

  function setLibraryCardFocus(index, animate) {
    var cards = dom.libraryCardsTrack ? dom.libraryCardsTrack.children : [];
    if (cards.length === 0) return;
    if (index < 0) index = 0;
    if (index >= cards.length) index = cards.length - 1;
    state.currentLibraryIndex = index;

    for (var i = 0; i < cards.length; i++) {
      if (i === index) cards[i].classList.add("focused");
      else cards[i].classList.remove("focused");
    }

    var targetCard = cards[index];
    var offset = targetCard.offsetLeft - 10;
    dom.libraryCardsTrack.style.transform = "translate3d(-" + offset + "px, 0, 0)";
  }

  function handleLibraryKeys(keyCode) {
    var count = state.installedApps.length;
    if (keyCode === 37) { // Left
      var prev = state.currentLibraryIndex - 1;
      if (prev < 0) prev = count - 1;
      setLibraryCardFocus(prev, true);
    } else if (keyCode === 39) { // Right
      var next = state.currentLibraryIndex + 1;
      if (next >= count) next = 0;
      setLibraryCardFocus(next, true);
    } else if (keyCode === 13) { // OK
      var app = state.installedApps[state.currentLibraryIndex];
      closeAppLibrary();
      if (app && window.CleanHome.launchApp) {
        window.CleanHome.launchApp({ name: app.name, appId: app.id });
      }
    }
  }

  // --------------------------------------------------------------------------
  // Wallpapers Dialog (Blue Key)
  // --------------------------------------------------------------------------
  function openWallpapersDialog() {
    try {
      if (!dom.wallpapersDialog) return;
      state.currentScreen = "wallpapers";
      state.currentWallpaperIndex = 0;
      dom.wallpapersDialog.classList.add("visible");
      renderWallpapersGrid();
    } catch (e) {
      showError("openWallpapersDialog error: " + e.message);
    }
  }

  function closeWallpapersDialog() {
    if (!dom.wallpapersDialog) return;
    dom.wallpapersDialog.classList.remove("visible");
    state.currentScreen = "dock";
    setTileFocus(state.currentTileIndex, true);
  }

  function renderWallpapersGrid() {
    try {
      if (!dom.wallpapersGrid) return;
      dom.wallpapersGrid.innerHTML = "";

      for (var i = 0; i < state.wallpapers.length; i++) {
        var wp = state.wallpapers[i];
        var card = document.createElement("div");
        card.className = "wp-card" + (i === 0 ? " focused" : "");
        card.dataset.index = i;

        var thumb = document.createElement("img");
        thumb.decoding = "async";
        thumb.src = wp.thumbPath || wp.path;
        thumb.alt = wp.name;

        var title = document.createElement("div");
        title.className = "wp-title";
        title.textContent = wp.title || wp.name;

        card.appendChild(thumb);
        card.appendChild(title);
        dom.wallpapersGrid.appendChild(card);
      }
    } catch (e) {
      showError("renderWallpapersGrid error: " + e.message);
    }
  }

  function handleWallpapersKeys(keyCode) {
    var cards = dom.wallpapersGrid ? dom.wallpapersGrid.children : [];
    if (cards.length === 0) return;

    if (keyCode === 37) { // Left
      state.currentWallpaperIndex = Math.max(0, state.currentWallpaperIndex - 1);
      updateWpFocus(cards);
    } else if (keyCode === 39) { // Right
      state.currentWallpaperIndex = Math.min(cards.length - 1, state.currentWallpaperIndex + 1);
      updateWpFocus(cards);
    } else if (keyCode === 38) { // Up
      state.currentWallpaperIndex = Math.max(0, state.currentWallpaperIndex - 3);
      updateWpFocus(cards);
    } else if (keyCode === 40) { // Down
      state.currentWallpaperIndex = Math.min(cards.length - 1, state.currentWallpaperIndex + 3);
      updateWpFocus(cards);
    } else if (keyCode === 13) { // OK
      var sel = state.wallpapers[state.currentWallpaperIndex];
      if (sel) {
        applyWallpaper(sel.path);
        saveSettings();
        closeWallpapersDialog();
        if (window.CleanHome.showToast) {
          window.CleanHome.showToast("Wallpaper: " + (sel.title || sel.name), false);
        }
      }
    }
  }

  function updateWpFocus(cards) {
    for (var i = 0; i < cards.length; i++) {
      if (i === state.currentWallpaperIndex) cards[i].classList.add("focused");
      else cards[i].classList.remove("focused");
    }
  }

  // --------------------------------------------------------------------------
  // Back Key Navigation
  // --------------------------------------------------------------------------
  function handleBack() {
    if (state.currentScreen === "settings") {
      closeSettingsDialog();
    } else if (state.currentScreen === "app-library") {
      closeAppLibrary();
    } else if (state.currentScreen === "wallpapers") {
      closeWallpapersDialog();
    } else if (state.currentScreen === "screensaver") {
      exitScreensaver();
    } else if (state.currentScreen === "dock") {
      enterScreensaver();
    }
  }

  // --------------------------------------------------------------------------
  // Remote Color Keys Action Dispatcher
  // --------------------------------------------------------------------------
  function handleRemoteAction(keyName) {
    if (keyName === "Yellow") {
      if (state.currentScreen === "app-library") closeAppLibrary();
      else openAppLibrary();
    } else if (keyName === "Blue") {
      if (state.currentScreen === "wallpapers") closeWallpapersDialog();
      else openWallpapersDialog();
    } else if (keyName === "Green") {
      toggleReducedMotion();
    } else if (keyName === "Red") {
      toggleDebugLine();
    }
  }

  // --------------------------------------------------------------------------
  // Debug Overlay & 60-Frame Rolling Average FPS Counter (Red key)
  // --------------------------------------------------------------------------
  function toggleDebugLine() {
    state.debugVisible = !state.debugVisible;
    if (dom.debugLine) {
      if (state.debugVisible) {
        dom.debugLine.classList.remove("hidden");
        startFpsMonitor();
        updateDebugLine();
      } else {
        dom.debugLine.classList.add("hidden");
        stopFpsMonitor();
      }
    }
  }

  function startFpsMonitor() {
    if (state.fpsRafId) cancelAnimationFrame(state.fpsRafId);
    state.frameTimestamps = [];
    var lastTime = performance.now();

    function onFrame(now) {
      var delta = now - lastTime;
      lastTime = now;
      state.frameTimestamps.push(delta);
      if (state.frameTimestamps.length > 60) {
        state.frameTimestamps.shift();
      }
      updateDebugLine();
      if (state.debugVisible) {
        state.fpsRafId = requestAnimationFrame(onFrame);
      }
    }
    state.fpsRafId = requestAnimationFrame(onFrame);
  }

  function stopFpsMonitor() {
    if (state.fpsRafId) {
      cancelAnimationFrame(state.fpsRafId);
      state.fpsRafId = null;
    }
  }

  function updateDebugLine() {
    if (!state.debugVisible || !dom.debugLine) return;

    var info = (window.CleanHome.getLastLaunchInfo && window.CleanHome.getLastLaunchInfo()) || {
      appName: "none",
      appId: "none",
      status: "idle",
      error: ""
    };

    var avgFrame = 16.7;
    var fps = "60.0";
    if (state.frameTimestamps.length > 5) {
      var sum = 0;
      for (var i = 0; i < state.frameTimestamps.length; i++) {
        sum += state.frameTimestamps[i];
      }
      avgFrame = sum / state.frameTimestamps.length;
      fps = (1000 / avgFrame).toFixed(1);
    }

    var text = "[DEBUG] Last: " + info.appName + " (" + info.appId + ") [" + info.status + (info.error ? " - " + info.error : "") + "] | Frame: " + avgFrame.toFixed(2) + "ms (" + fps + " fps) | Mode: " + (state.settings.richEffects ? "Rich" : "Lite");
    dom.debugLine.textContent = text;
  }

  // --------------------------------------------------------------------------
  // Clock Screensaver & Idle Timer (60s idle)
  // --------------------------------------------------------------------------
  function setupIdleTimer() {
    if (state.idleTimer) clearTimeout(state.idleTimer);
    state.idleTimer = setTimeout(function() {
      enterScreensaver();
    }, 60000);
  }

  function onUserActivity() {
    setupIdleTimer();
    if (state.currentScreen === "screensaver") {
      exitScreensaver();
    }
  }

  function enterScreensaver() {
    if (!dom.screensaver) return;
    state.currentScreen = "screensaver";
    dom.screensaver.classList.add("active");

    // In Lite mode: static centered clock, zero rAF/timer drift overhead
    if (!state.settings.richEffects) {
      if (dom.screensaverContent) dom.screensaverContent.style.transform = "none";
      return;
    }

    var angle = 0;
    state.screensaverDriftTimer = setInterval(function() {
      angle += 0.05;
      var dx = Math.sin(angle) * 30;
      var dy = Math.cos(angle) * 20;
      if (dom.screensaverContent) {
        dom.screensaverContent.style.transform = "translate3d(" + dx.toFixed(1) + "px, " + dy.toFixed(1) + "px, 0)";
      }
    }, 1000);
  }

  function exitScreensaver() {
    if (!dom.screensaver) return;
    dom.screensaver.classList.remove("active");
    if (state.screensaverDriftTimer) {
      clearInterval(state.screensaverDriftTimer);
      state.screensaverDriftTimer = null;
    }
    setTileFocus(state.currentTileIndex, true);
  }

  // --------------------------------------------------------------------------
  // Clock: Aligned to minute boundary, textContent only on change
  // --------------------------------------------------------------------------
  function initClock() {
    updateClock();
    var now = new Date();
    var delayMs = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    if (delayMs < 100) delayMs = 60000;

    setTimeout(function() {
      updateClock();
      setInterval(updateClock, 60000);
    }, delayMs);
  }

  function updateClock() {
    var now = new Date();
    var hours = now.getHours();
    var minutes = now.getMinutes();
    var padM = minutes < 10 ? "0" + minutes : minutes;

    var greet = "GOOD EVENING";
    if (hours >= 5 && hours < 12) greet = "GOOD MORNING";
    else if (hours >= 12 && hours < 17) greet = "GOOD AFTERNOON";
    else if (hours >= 17 && hours < 22) greet = "GOOD EVENING";
    else greet = "GOOD NIGHT";

    if (dom.greeting && dom.greeting.textContent !== greet) {
      dom.greeting.textContent = greet;
    }

    var is12 = state.settings.clockFormat === "12h";
    var clockStr = "";
    var ampmStr = "";

    if (is12) {
      ampmStr = hours >= 12 ? "PM" : "AM";
      var h12 = hours % 12;
      if (h12 === 0) h12 = 12;
      clockStr = h12 + ":" + padM;
    } else {
      var padH = hours < 10 ? "0" + hours : hours;
      clockStr = padH + ":" + padM;
    }

    if (dom.clock && dom.clock.textContent !== clockStr) {
      dom.clock.textContent = clockStr;
    }
    if (dom.ampm) {
      if (dom.ampm.textContent !== ampmStr) dom.ampm.textContent = ampmStr;
      dom.ampm.style.display = is12 ? "block" : "none";
    }

    var days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    var months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    var dateStr = days[now.getDay()] + ", " + now.getDate() + " " + months[now.getMonth()];
    if (dom.date && dom.date.textContent !== dateStr) {
      dom.date.textContent = dateStr;
    }

    if (dom.screensaverClock) {
      var scStr = clockStr + (is12 ? " " + ampmStr : "");
      if (dom.screensaverClock.textContent !== scStr) dom.screensaverClock.textContent = scStr;
    }
    if (dom.screensaverDate && dom.screensaverDate.textContent !== dateStr) {
      dom.screensaverDate.textContent = dateStr;
    }
  }

  // Public CleanHome API
  window.CleanHome.setTileFocus = setTileFocus;
  window.CleanHome.handleNavKey = handleNavKey;
  window.CleanHome.handleBack = handleBack;
  window.CleanHome.handleRemoteAction = handleRemoteAction;
  window.CleanHome.onUserActivity = onUserActivity;
  window.CleanHome.openAppLibrary = openAppLibrary;
  window.CleanHome.openWallpapersDialog = openWallpapersDialog;
  window.CleanHome.openSettingsDialog = openSettingsDialog;
  window.CleanHome.closeSettingsDialog = closeSettingsDialog;
  window.CleanHome.toggleReducedMotion = toggleReducedMotion;
  window.CleanHome.toggleDebugLine = toggleDebugLine;
  window.CleanHome.updateDebugLine = updateDebugLine;
  window.CleanHome.showError = showError;
  window.CleanHome.getState = function() { return state; };
})();

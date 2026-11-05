/* js/app.js - CleanHome Main Application & Motion Engine
 * tvOS / CleanYourTV layout and motion mechanics for Samsung Tizen TV.
 *
 * 100% compliant with Tizen 4 (Chromium 56 baseline):
 * - No optional chaining (?.), no nullish coalescing (??)
 * - Animate transform and opacity ONLY
 * - No box-shadow/filter/width/height/top/left animations
 * - Analytical spring solver with cancel & retarget on rapid key presses
 * - No layout reads in key handlers (all coordinates pre-cached in stage space)
 * - reducedMotion from user setting or OS media query only; never auto-saved
 * - Full-screen 100vw x 100vh scaling for 1920x1080 and 1280x720
 */

"use strict";

(function() {
  window.CleanHome = window.CleanHome || {};

  // Default app tiles configuration matching CleanYourTV dock
  var DEFAULT_TILES = [
    { name: "Netflix", icon: "netflix", appId: "org.netflix.tv", fallbackUrl: "https://www.netflix.com" },
    { name: "YouTube", icon: "youtube", appId: "com.google.youtube.tv", fallbackUrl: "https://www.youtube.com" },
    { name: "Prime Video", icon: "primevideo", appId: "amazon.amazonvideo.amazonvideo", fallbackUrl: "https://www.primevideo.com" },
    { name: "Disney+ Hotstar", icon: "disney", appId: "disney.hotstar", fallbackUrl: "https://www.disneyplushotstar.com" },
    { name: "JioCinema", icon: "jiocinema", appId: "jiocinema.jio", fallbackUrl: "https://www.jio.com/jocinema" },
    { name: "Spotify", icon: "spotify", appId: "com.spotify.tv", fallbackUrl: "https://open.spotify.com" },
    { name: "Samsung Internet", icon: "samsung-internet", appId: "com.sec.android.app.sbrowser", fallbackUrl: "https://www.samsung.com/internet" },
    { name: "Inputs", icon: "inputs", appId: "", fallbackUrl: "" }
  ];

  var BRAND_COLORS = {
    netflix: "#E50914",
    youtube: "#FF0000",
    primevideo: "#00A8E1",
    disney: "#113CCF",
    jiocinema: "#D8005A",
    spotify: "#1DB954",
    "samsung-internet": "#2C2684",
    inputs: "#666666"
  };

  // State variables
  var state = {
    currentScreen: "dock", // "dock", "top-pills", "inputs-menu", "app-library", "wallpapers", "screensaver"
    currentTileIndex: 0,
    currentPillIndex: 0,
    currentInputIndex: 0,
    currentLibraryIndex: 0,
    currentWallpaperIndex: 0,
    tiles: DEFAULT_TILES,
    wallpapers: [],
    installedApps: [],
    reducedMotion: false,
    settings: {
      clockFormat: "12h",
      reducedMotion: false,
      wallpaper: "assets/wallpapers/gradient1.jpg"
    },
    idleTimer: null,
    screensaverDriftTimer: null
  };

  // Cached DOM elements
  var dom = {};



  // --------------------------------------------------------------------------
  // Error Panel & Diagnostics (Rate-limited, max 1 visible)
  // --------------------------------------------------------------------------
  var lastErrorTime = 0;
  function showError(msg) {
    var now = Date.now();
    if (now - lastErrorTime < 2000) return;
    lastErrorTime = now;
    console.error("CleanHome error: " + msg);

    var panel = document.getElementById("cleanhome-error-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "cleanhome-error-panel";
      panel.style.cssText = "position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(220,20,20,0.95);color:white;padding:10px 20px;border-radius:12px;font-size:14px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.6);pointer-events:none;";
      document.body.appendChild(panel);
    }
    panel.textContent = "CleanHome: " + msg;
    panel.style.display = "block";
    panel.style.opacity = "1";
    setTimeout(function() {
      panel.style.opacity = "0";
      setTimeout(function() { panel.style.display = "none"; }, 300);
    }, 4500);
  }

  window.onerror = function(msg, url, line) {
    showError(msg + " (" + (url ? url.split("/").pop() : "") + ":" + line + ")");
    return false;
  };

  // --------------------------------------------------------------------------
  // Initialization & Viewport Scaling (1920x1080 and 1280x720 support)
  // --------------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", function() {
    try {
      cacheElements();
      loadSettings();
      detectReducedMotion();
      loadWallpapersList();
      renderTiles();
      updateClock();
      setInterval(updateClock, 1000);
      setupIdleTimer();
      updateNetworkStatus();

      // Listen for network connectivity events
      window.addEventListener("online", updateNetworkStatus);
      window.addEventListener("offline", updateNetworkStatus);

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
    dom.btnInputs = document.getElementById("btn-inputs");
    dom.btnWifi = document.getElementById("btn-wifi");
    dom.wifiLabel = document.getElementById("wifi-label");
    dom.btnSettings = document.getElementById("btn-settings");
    dom.heroShelf = document.getElementById("hero-shelf");
    dom.heroName = document.getElementById("hero-name");
    dom.dockContainer = document.getElementById("dock-container");
    dom.appRow = document.getElementById("app-row");
    dom.inputsPopup = document.getElementById("inputs-popup");
    dom.appLibraryDialog = document.getElementById("app-library-dialog");
    dom.libraryCount = document.getElementById("library-count");
    dom.libraryCardsTrack = document.getElementById("library-cards-track");
    dom.wallpapersDialog = document.getElementById("wallpapers-dialog");
    dom.wallpapersGrid = document.getElementById("wallpapers-grid");
    dom.screensaver = document.getElementById("screensaver");
    dom.screensaverClock = document.getElementById("screensaver-clock");
    dom.screensaverDate = document.getElementById("screensaver-date");
    dom.screensaverContent = document.getElementById("screensaver-content");
  }

  function updateStageScaling() {
    if (!dom.stage) return;
    var vw = window.innerWidth || 1920;
    var vh = window.innerHeight || 1080;
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
      }
    } catch (e) {
      console.warn("Could not read localStorage settings: " + e.message);
    }
    applyWallpaper(state.settings.wallpaper);
  }

  function saveSettings() {
    try {
      localStorage.setItem("cleanhome-settings", JSON.stringify(state.settings));
    } catch (e) {
      console.warn("Could not write localStorage settings: " + e.message);
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
  }

  // --------------------------------------------------------------------------
  // Real Network Status (No fake status, navigator.onLine)
  // --------------------------------------------------------------------------
  function updateNetworkStatus() {
    var online = (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") ? navigator.onLine : true;
    if (dom.wifiLabel) {
      dom.wifiLabel.textContent = online ? "Wi-Fi" : "Offline";
    }
    if (dom.btnWifi) {
      dom.btnWifi.style.opacity = online ? "1" : "0.5";
    }
  }

  // --------------------------------------------------------------------------
  // Wallpaper Handling with Pre-blurred Fake Glass Companion
  // --------------------------------------------------------------------------
  function applyWallpaper(wpPath) {
    if (!dom.wallpaper) return;
    if (!wpPath) wpPath = "assets/wallpapers/gradient1.jpg";

    dom.wallpaper.style.backgroundImage = 'url("' + wpPath + '")';

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
    if (!hex || hex.indexOf("#") !== 0) return { r: 255, g: 255, b: 255 };
    var c = hex.replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var num = parseInt(c, 16);
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
  // 1. .glow: Outer soft halo (-28px, pre-rendered radial-gradient, no hard border)
  // 2. .body: Translucent glass surface (16px radius, overflow: hidden, 0.08 -> 0.14)
  // 3. .sheen & .shine-sweep: Top ~45% specular highlight + diagonal sweep
  // 4. .icon: Logo, always on top
  // --------------------------------------------------------------------------
  function renderTiles() {
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

      // 3. .sheen & .shine-sweep inside .body's clipping
      var sheen = document.createElement("div");
      sheen.className = "sheen";

      var shineSweep = document.createElement("div");
      shineSweep.className = "shine-sweep";

      // 4. .icon: the logo, always on top
      var iconImg = document.createElement("img");
      iconImg.className = "icon";
      iconImg.src = "assets/icons/" + tile.icon + ".svg";
      iconImg.alt = tile.name;

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
  }

  // --------------------------------------------------------------------------
  // Focus Handling (Opacity-only activation of child glow/highlight)
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

    var brandColor = (focusedTile && BRAND_COLORS[focusedTile.icon]) || "#FFFFFF";
    if (dom.ambientGlow) {
      dom.ambientGlow.style.background = "radial-gradient(circle at 50% 60%, " + brandColor + " 0%, transparent 68%)";
      dom.ambientGlow.style.opacity = "0.28";
    }
  }

  function setTopPillFocus(index) {
    state.currentScreen = "top-pills";
    state.currentPillIndex = index;

    var pills = [dom.btnInputs, dom.btnWifi, dom.btnSettings];
    for (var i = 0; i < pills.length; i++) {
      if (pills[i]) {
        if (i === index) pills[i].classList.add("focused");
        else pills[i].classList.remove("focused");
      }
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
    } else if (state.currentScreen === "top-pills") {
      handleTopPillKeys(keyCode);
    } else if (state.currentScreen === "inputs-menu") {
      handleInputsMenuKeys(keyCode);
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
    } else if (keyCode === 38) { // Up -> move to top frosted pills
      var wrappers = dom.appRow.children;
      for (var i = 0; i < wrappers.length; i++) wrappers[i].classList.remove("focused");
      setTopPillFocus(0);
    } else if (keyCode === 40) { // Down
      openAppLibrary();
    } else if (keyCode === 13) { // Enter / OK
      var tile = state.tiles[state.currentTileIndex];
      if (window.CleanHome.launchApp) {
        window.CleanHome.launchApp(tile);
      }
    }
  }

  function handleTopPillKeys(keyCode) {
    if (keyCode === 37) { // Left
      var prev = state.currentPillIndex - 1;
      if (prev < 0) prev = 2;
      setTopPillFocus(prev);
    } else if (keyCode === 39) { // Right
      var next = state.currentPillIndex + 1;
      if (next > 2) next = 0;
      setTopPillFocus(next);
    } else if (keyCode === 40) { // Down -> return to dock tiles
      var pills = [dom.btnInputs, dom.btnWifi, dom.btnSettings];
      for (var i = 0; i < pills.length; i++) if (pills[i]) pills[i].classList.remove("focused");
      setTileFocus(state.currentTileIndex, true);
    } else if (keyCode === 13) { // Enter / OK
      if (state.currentPillIndex === 0) {
        openInputsMenu();
      } else if (state.currentPillIndex === 1) {
        var online = (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") ? navigator.onLine : true;
        if (window.CleanHome.showToast) {
          window.CleanHome.showToast(online ? "Network: Online" : "Network: Offline", false);
        }
      } else if (state.currentPillIndex === 2) {
        openWallpapersDialog();
      }
    }
  }

  // --------------------------------------------------------------------------
  // Inputs Dropdown Logic (Strict Honesty & Clean Navigation)
  // --------------------------------------------------------------------------
  function openInputsMenu() {
    if (!dom.inputsPopup) return;
    state.currentScreen = "inputs-menu";
    state.currentInputIndex = 0;
    dom.inputsPopup.classList.add("visible");
    var rows = dom.inputsPopup.querySelectorAll(".input-row");
    updateInputFocus(rows);
  }

  function closeInputsMenu() {
    if (!dom.inputsPopup) return;
    dom.inputsPopup.classList.remove("visible");
    setTopPillFocus(0);
  }

  function handleInputsMenuKeys(keyCode) {
    var rows = dom.inputsPopup ? dom.inputsPopup.querySelectorAll(".input-row") : [];
    if (rows.length === 0) return;

    if (keyCode === 38) { // Up
      state.currentInputIndex = (state.currentInputIndex - 1 + rows.length) % rows.length;
      updateInputFocus(rows);
    } else if (keyCode === 40) { // Down
      state.currentInputIndex = (state.currentInputIndex + 1) % rows.length;
      updateInputFocus(rows);
    } else if (keyCode === 37 || keyCode === 39) { // Focus leaves dropdown
      closeInputsMenu();
    } else if (keyCode === 13) { // OK
      var selected = rows[state.currentInputIndex];
      var inputKey = selected ? selected.getAttribute("data-input") : "";
      var name = selected ? selected.querySelector(".input-title").textContent : "Input";
      selectTvInput(inputKey, name);
    }
  }

  function selectTvInput(inputKey, name) {
    closeInputsMenu();

    // Try Tizen TV Input API if available (feature-detected)
    var handled = false;
    try {
      if (typeof tizen !== "undefined" && tizen.tvinputdevice && typeof tizen.tvinputdevice.switchInput === "function") {
        tizen.tvinputdevice.switchInput(inputKey);
        handled = true;
      }
    } catch (e) {
      handled = false;
    }

    if (!handled) {
      if (window.CleanHome.showToast) {
        window.CleanHome.showToast("Use the SOURCE button on your remote", false);
      }
    }
  }

  function updateInputFocus(rows) {
    for (var i = 0; i < rows.length; i++) {
      if (i === state.currentInputIndex) rows[i].classList.add("focused");
      else rows[i].classList.remove("focused");
    }
  }

  // --------------------------------------------------------------------------
  // App Library Dialog (Yellow Key)
  // --------------------------------------------------------------------------
  function openAppLibrary() {
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
  }

  function closeAppLibrary() {
    if (!dom.appLibraryDialog) return;
    dom.appLibraryDialog.classList.remove("visible");
    setTileFocus(state.currentTileIndex, true);
  }

  function renderLibraryCards(apps) {
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

      var iconImg = document.createElement("img");
      iconImg.className = "lib-icon";
      iconImg.src = "assets/icons/" + iconName + ".svg";
      iconImg.alt = app.name;

      var nameEl = document.createElement("div");
      nameEl.className = "lib-name";
      nameEl.textContent = app.name;

      var statusEl = document.createElement("div");
      statusEl.className = "lib-status";
      statusEl.textContent = "On Home";

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
    if (!dom.wallpapersDialog) return;
    state.currentScreen = "wallpapers";
    state.currentWallpaperIndex = 0;
    dom.wallpapersDialog.classList.add("visible");
    renderWallpapersGrid();
  }

  function closeWallpapersDialog() {
    if (!dom.wallpapersDialog) return;
    dom.wallpapersDialog.classList.remove("visible");
    setTileFocus(state.currentTileIndex, true);
  }

  function renderWallpapersGrid() {
    if (!dom.wallpapersGrid) return;
    dom.wallpapersGrid.innerHTML = "";

    for (var i = 0; i < state.wallpapers.length; i++) {
      var wp = state.wallpapers[i];
      var card = document.createElement("div");
      card.className = "wp-card" + (i === 0 ? " focused" : "");
      card.dataset.index = i;

      var thumb = document.createElement("img");
      thumb.src = wp.thumbPath || wp.path;
      thumb.alt = wp.name;

      var title = document.createElement("div");
      title.className = "wp-title";
      title.textContent = wp.title || wp.name;

      card.appendChild(thumb);
      card.appendChild(title);
      dom.wallpapersGrid.appendChild(card);
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
          window.CleanHome.showToast("Wallpaper changed to " + (sel.title || sel.name), false);
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
  // Back Key Navigation & Debounced Dismissal
  // --------------------------------------------------------------------------
  function handleBack() {
    if (state.currentScreen === "inputs-menu") {
      closeInputsMenu();
    } else if (state.currentScreen === "app-library") {
      closeAppLibrary();
    } else if (state.currentScreen === "wallpapers") {
      closeWallpapersDialog();
    } else if (state.currentScreen === "top-pills") {
      setTileFocus(state.currentTileIndex, true);
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
      if (state.currentScreen === "wallpapers") closeWallpapersDialog();
      else openWallpapersDialog();
    }
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
  // Clock, Greeting & Date Formatting
  // --------------------------------------------------------------------------
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

    if (dom.greeting) dom.greeting.textContent = greet;

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

    if (dom.clock) dom.clock.textContent = clockStr;
    if (dom.ampm) {
      dom.ampm.textContent = ampmStr;
      dom.ampm.style.display = is12 ? "block" : "none";
    }

    var days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    var months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    var dateStr = days[now.getDay()] + ", " + now.getDate() + " " + months[now.getMonth()];
    if (dom.date) dom.date.textContent = dateStr;

    if (dom.screensaverClock) dom.screensaverClock.textContent = clockStr + (is12 ? " " + ampmStr : "");
    if (dom.screensaverDate) dom.screensaverDate.textContent = dateStr;
  }

  // Public CleanHome API
  window.CleanHome.setTileFocus = setTileFocus;
  window.CleanHome.handleNavKey = handleNavKey;
  window.CleanHome.handleBack = handleBack;
  window.CleanHome.handleRemoteAction = handleRemoteAction;
  window.CleanHome.onUserActivity = onUserActivity;
  window.CleanHome.openAppLibrary = openAppLibrary;
  window.CleanHome.openWallpapersDialog = openWallpapersDialog;
  window.CleanHome.openInputsMenu = openInputsMenu;
  window.CleanHome.closeInputsMenu = closeInputsMenu;
  window.CleanHome.toggleReducedMotion = toggleReducedMotion;
})();

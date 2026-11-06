/* js/app.js - CleanHome Main Controller
 * 100% compliant with Samsung Tizen 4 / 5.5 (Chromium 56/69 baseline).
 *
 * STRICT TIZEN COMPATIBILITY:
 * - NO optional chaining (?.)
 * - NO nullish coalescing (??)
 * - NO flex/grid gap (margins used)
 * - NO CSS inset (top/bottom/left/right used)
 * - NO aspect-ratio, :is(), :where(), :focus-visible
 * - NO linear() easing
 * - will-change only on focused tile, dock track, and background layers
 */

"use strict";

(function() {
  window.CleanHome = window.CleanHome || {};

  // --------------------------------------------------------------------------
  // Application State
  // --------------------------------------------------------------------------
  var state = {
    isTV: (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.indexOf("Tizen") !== -1),
    currentScreen: "dock", // "dock", "settings", "app-library", "wallpapers", "screensaver", "top-pill"
    currentTileIndex: 0,
    currentSettingsIndex: 0,
    currentLibraryIndex: 0,
    currentWallpaperIndex: 0,
    tiles: [],
    installedApps: [],
    wallpapers: [],
    heroConfig: {},
    brandColors: {},
    activeBgLayer: 0,
    currentBgPath: "",
    debugVisible: false,
    frameTimestamps: [],
    fpsRafId: null,
    idleTimer: null,
    screensaverDriftTimer: null,
    settings: {
      reducedMotion: false,
      clockFormat: "12h",
      wallpaper: "assets/hero_backgrounds/netflix.jpg",
      richEffects: true,
      profileName: "C",
      showWeather: false
    }
  };

  // --------------------------------------------------------------------------
  // Cached DOM Elements
  // --------------------------------------------------------------------------
  var dom = {};

  function initDom() {
    dom.stage = document.getElementById("stage");
    dom.bgLayers = [
      document.getElementById("bg-layer-0"),
      document.getElementById("bg-layer-1")
    ];
    dom.topBar = document.getElementById("top-bar");
    dom.greeting = document.getElementById("greeting");
    dom.clock = document.getElementById("clock");
    dom.ampm = document.getElementById("ampm");
    dom.date = document.getElementById("date");
    dom.topPill = document.getElementById("top-pill");
    dom.pillWifi = document.getElementById("pill-wifi");
    dom.pillWeather = document.getElementById("pill-weather");
    dom.pillAvatar = document.getElementById("pill-avatar");
    dom.heroContainer = document.getElementById("hero-container");
    dom.heroBlock = document.getElementById("hero-block");
    dom.heroLabel = document.getElementById("hero-label");
    dom.heroTitle = document.getElementById("hero-title");
    dom.heroSubtitle = document.getElementById("hero-subtitle");
    dom.heroPosterContainer = document.getElementById("hero-poster-container");
    dom.heroPosterImg = document.getElementById("hero-poster-img");
    dom.dockContainer = document.getElementById("dock-container");
    dom.dockBar = document.getElementById("dock-bar");
    dom.dockTrack = document.getElementById("dock-track");
    dom.groupLabelsRow = document.getElementById("group-labels-row");
    dom.settingsDialog = document.getElementById("settings-dialog");
    dom.settingsList = document.getElementById("settings-list");
    dom.appLibraryDialog = document.getElementById("app-library-dialog");
    dom.libraryCardsTrack = document.getElementById("library-cards-track");
    dom.libraryCount = document.getElementById("library-count");
    dom.libraryHint = document.getElementById("library-hint");
    dom.wallpapersDialog = document.getElementById("wallpapers-dialog");
    dom.wallpapersGrid = document.getElementById("wallpapers-grid");
    dom.screensaver = document.getElementById("screensaver");
    dom.screensaverContent = document.getElementById("screensaver-content");
    dom.screensaverClock = document.getElementById("screensaver-clock");
    dom.screensaverDate = document.getElementById("screensaver-date");
    dom.errorPanel = document.getElementById("error-panel");
    dom.debugLine = document.getElementById("debug-line");
    dom.toastContainer = document.getElementById("toast-container");
  }

  // --------------------------------------------------------------------------
  // Global Error Display Panel (Requirement: never a silent blank screen)
  // --------------------------------------------------------------------------
  function showError(message) {
    console.error("[CleanHome Error]", message);
    if (!dom.errorPanel) dom.errorPanel = document.getElementById("error-panel");
    if (dom.errorPanel) {
      dom.errorPanel.textContent = message;
      dom.errorPanel.classList.remove("hidden");
      setTimeout(function() {
        if (dom.errorPanel) dom.errorPanel.classList.add("hidden");
      }, 7000);
    }
  }

  // --------------------------------------------------------------------------
  // Viewport Scaling (Scales proportional 1920x1080 stage to fill viewport)
  // --------------------------------------------------------------------------
  function updateViewportScale() {
    try {
      if (!dom.stage) return;
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var scaleX = vw / 1920;
      var scaleY = vh / 1080;
      dom.stage.style.transform = "scale(" + scaleX + ", " + scaleY + ")";
    } catch (e) {
      showError("Viewport scaling error: " + e.message);
    }
  }

  // --------------------------------------------------------------------------
  // Load Settings from LocalStorage
  // --------------------------------------------------------------------------
  function loadSettings() {
    try {
      var saved = localStorage.getItem("cleanhome_settings");
      if (saved) {
        var parsed = JSON.parse(saved);
        if (typeof parsed.reducedMotion === "boolean") state.settings.reducedMotion = parsed.reducedMotion;
        if (parsed.clockFormat === "12h" || parsed.clockFormat === "24h") state.settings.clockFormat = parsed.clockFormat;
        if (typeof parsed.richEffects === "boolean") state.settings.richEffects = parsed.richEffects;
        if (parsed.profileName) state.settings.profileName = parsed.profileName;
        if (typeof parsed.showWeather === "boolean") state.settings.showWeather = parsed.showWeather;
      } else {
        // Defaults: TV defaults to Lite mode (richEffects: false); Desktop defaults to Rich mode (richEffects: true)
        if (state.isTV) {
          state.settings.richEffects = false;
        } else {
          state.settings.richEffects = true;
        }
      }
    } catch (e) {
      console.warn("Could not load settings from localStorage: " + e.message);
    }

    applyReducedMotion();
    applyRichEffects();
    updatePill();
  }

  function saveSettings() {
    try {
      localStorage.setItem("cleanhome_settings", JSON.stringify(state.settings));
    } catch (e) {
      console.warn("Could not save settings to localStorage: " + e.message);
    }
  }

  function applyReducedMotion() {
    if (state.settings.reducedMotion) {
      document.documentElement.setAttribute("data-reduced-motion", "true");
    } else {
      document.documentElement.removeAttribute("data-reduced-motion");
    }
  }

  function toggleReducedMotion() {
    state.settings.reducedMotion = !state.settings.reducedMotion;
    saveSettings();
    applyReducedMotion();
    if (window.CleanHome.showToast) {
      window.CleanHome.showToast("Reduced Motion: " + (state.settings.reducedMotion ? "ON" : "OFF"), false);
    }
    if (state.currentScreen === "settings") {
      renderSettingsList();
    }
  }

  function applyRichEffects() {
    if (state.settings.richEffects) {
      document.body.classList.remove("tv-lite");
      if (dom.dockBar) {
        dom.dockBar.style.backdropFilter = "blur(24px)";
        dom.dockBar.style.webkitBackdropFilter = "blur(24px)";
      }
    } else {
      document.body.classList.add("tv-lite");
      if (dom.dockBar) {
        dom.dockBar.style.backdropFilter = "none";
        dom.dockBar.style.webkitBackdropFilter = "none";
      }
    }
    updateDebugLine();
  }

  // --------------------------------------------------------------------------
  // Top-Right Pill State (Wi-Fi, Weather, Profile Avatar)
  // --------------------------------------------------------------------------
  function updatePill() {
    if (dom.pillWifi) {
      var isOnline = (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") ? navigator.onLine : true;
      if (isOnline) {
        dom.pillWifi.classList.remove("offline");
      } else {
        dom.pillWifi.classList.add("offline");
      }
    }

    if (dom.pillAvatar) {
      var initial = (state.settings.profileName || "C").charAt(0).toUpperCase();
      dom.pillAvatar.textContent = initial;
    }

    if (dom.pillWeather) {
      if (state.settings.showWeather === true) {
        dom.pillWeather.classList.remove("hidden");
      } else {
        dom.pillWeather.classList.add("hidden");
      }
    }
  }

  // --------------------------------------------------------------------------
  // Pre-blurred Background Crossfade (Requirement 5)
  // Opacity crossfade between exactly two layers (300-400 ms)
  // --------------------------------------------------------------------------
  function updateHeroBackground(tile) {
    if (!tile) return;
    try {
      var appHero = state.heroConfig[tile.appId] || state.heroConfig[tile.icon] || {};
      var targetBg = appHero.backgroundImage || ("assets/hero_backgrounds/" + tile.icon + ".jpg");

      if (state.currentBgPath === targetBg) return;
      state.currentBgPath = targetBg;

      var currentActiveLayer = dom.bgLayers[state.activeBgLayer];
      var nextLayerIdx = 1 - state.activeBgLayer;
      var nextLayer = dom.bgLayers[nextLayerIdx];

      if (!nextLayer) return;

      // Set image on incoming layer
      nextLayer.style.backgroundImage = 'url("' + targetBg + '")';

      // Crossfade opacity
      nextLayer.classList.add("active");
      if (currentActiveLayer) {
        currentActiveLayer.classList.remove("active");
      }

      state.activeBgLayer = nextLayerIdx;
    } catch (e) {
      showError("updateHeroBackground error: " + e.message);
    }
  }

  // --------------------------------------------------------------------------
  // Hero Text & Poster Block (Requirement 4: Honest Content Only)
  // --------------------------------------------------------------------------
  function updateHeroBlock(tile) {
    if (!tile) return;
    try {
      var hero = state.heroConfig[tile.appId] || state.heroConfig[tile.icon] || {};

      // Defaults when nothing configured: label "OPEN", title = app's name, no poster
      var label = hero.label || "OPEN";
      var title = hero.title || tile.name;
      var subtitle = hero.subtitle || "";
      var posterImage = hero.posterImage || null;

      if (dom.heroLabel) dom.heroLabel.textContent = label;
      if (dom.heroTitle) dom.heroTitle.textContent = title;

      if (dom.heroSubtitle) {
        if (subtitle) {
          dom.heroSubtitle.textContent = subtitle;
          dom.heroSubtitle.style.display = "block";
        } else {
          dom.heroSubtitle.textContent = "";
          dom.heroSubtitle.style.display = "none";
        }
      }

      // Show poster card ONLY if posterImage exists
      if (dom.heroPosterContainer && dom.heroPosterImg) {
        if (posterImage) {
          dom.heroPosterImg.src = posterImage;
          dom.heroPosterContainer.classList.remove("hidden");
        } else {
          dom.heroPosterContainer.classList.add("hidden");
          dom.heroPosterImg.src = "";
        }
      }
    } catch (e) {
      showError("updateHeroBlock error: " + e.message);
    }
  }

  // --------------------------------------------------------------------------
  // Color Helpers
  // --------------------------------------------------------------------------
  function hexToRgb(hex) {
    var clean = (hex || "#555555").replace("#", "");
    var num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  // --------------------------------------------------------------------------
  // Dock & Tiles Rendering (Requirement 1, 2, 3, 8)
  // --------------------------------------------------------------------------
  function renderDock() {
    try {
      if (!dom.dockTrack) return;
      dom.dockTrack.innerHTML = "";
      if (dom.groupLabelsRow) dom.groupLabelsRow.innerHTML = "";

      var currentGroup = null;
      var tileStep = 134; // 114px tile + 20px margin
      var separatorWidth = 29; // 1px line + 28px margin

      for (var i = 0; i < state.tiles.length; i++) {
        var tile = state.tiles[i];
        var tileGroup = tile.group || "";

        // Check if group transition occurred
        if (i > 0 && tileGroup !== currentGroup && tileGroup !== "") {
          // Insert 1px group separator line (20% white)
          var sep = document.createElement("div");
          sep.className = "group-separator";
          dom.dockTrack.appendChild(sep);
        }

        // Render Tile Wrapper
        var wrapper = document.createElement("div");
        wrapper.className = "tile-wrapper" + (i === state.currentTileIndex ? " focused" : "");
        wrapper.setAttribute("role", "gridcell");
        wrapper.setAttribute("tabindex", "0");
        wrapper.dataset.index = i;
        wrapper.dataset.name = tile.name;
        if (tile.appId) wrapper.dataset.appId = tile.appId;
        if (tileGroup) wrapper.dataset.group = tileGroup;

        // 1. .glow: Outer soft halo using app's accent colour
        var glow = document.createElement("div");
        glow.className = "glow";
        var accentHex = state.brandColors[tile.icon] || "#888888";
        var rgb = hexToRgb(accentHex);
        glow.style.background = "radial-gradient(circle, rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ", 0.55) 0%, rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ", 0) 70%)";
        wrapper.appendChild(glow);

        // 2. .card: Frosted rounded square
        var card = document.createElement("div");
        card.className = "card";

        // 3. .icon: App logo with async decoding
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

        card.appendChild(iconImg);
        wrapper.appendChild(card);

        // Click / Touch Listener
        (function(idx, tileObj) {
          wrapper.addEventListener("click", function() {
            setTileFocus(idx, false);
            if (tileObj.name === "Settings") {
              openSettingsDialog();
            } else if (window.CleanHome.launchApp) {
              window.CleanHome.launchApp(tileObj);
            }
          });
        })(i, tile);

        dom.dockTrack.appendChild(wrapper);

        // Group Label under first tile of each group
        if (tileGroup && tileGroup !== currentGroup && dom.groupLabelsRow) {
          currentGroup = tileGroup;
          var labelEl = document.createElement("div");
          labelEl.className = "group-label";
          labelEl.textContent = tileGroup;
          labelEl.dataset.group = tileGroup;
          labelEl.dataset.firstTileIndex = i;
          dom.groupLabelsRow.appendChild(labelEl);
        } else if (!tileGroup) {
          currentGroup = null;
        }
      }

      // Initial focus & background sync
      setTileFocus(state.currentTileIndex, false);
      updateGroupLabelPositions();
    } catch (e) {
      showError("renderDock error: " + e.message);
    }
  }

  function updateGroupLabelPositions() {
    if (!dom.groupLabelsRow || !dom.dockTrack) return;
    var labels = dom.groupLabelsRow.children;
    var tiles = dom.dockTrack.querySelectorAll(".tile-wrapper");

    for (var k = 0; k < labels.length; k++) {
      var label = labels[k];
      var firstIdx = parseInt(label.dataset.firstTileIndex, 10);
      if (tiles[firstIdx]) {
        var tileLeft = tiles[firstIdx].offsetLeft;
        label.style.left = (tileLeft + 16) + "px";
      }
    }
  }

  // --------------------------------------------------------------------------
  // Tile Focus Management & Mathematical Scrolling
  // --------------------------------------------------------------------------
  function setTileFocus(index, userInitiated) {
    if (index < 0 || index >= state.tiles.length) return;
    state.currentTileIndex = index;
    state.currentScreen = "dock";

    var wrappers = dom.dockTrack ? dom.dockTrack.querySelectorAll(".tile-wrapper") : [];
    for (var i = 0; i < wrappers.length; i++) {
      if (i === index) wrappers[i].classList.add("focused");
      else wrappers[i].classList.remove("focused");
    }

    var focusedTile = state.tiles[index];
    if (focusedTile) {
      updateHeroBlock(focusedTile);
      updateHeroBackground(focusedTile);
    }

    // Scroll dock horizontally if needed using ONE translate3d calculation
    scrollDockToTile(index, wrappers);
    updateDebugLine();
  }

  function scrollDockToTile(index, wrappers) {
    if (!dom.dockTrack || !dom.dockBar) return;

    var dockWidth = dom.dockBar.clientWidth || 1824;
    var targetWrapper = wrappers && wrappers[index];

    if (!targetWrapper) return;

    var tileLeft = targetWrapper.offsetLeft;
    var tileWidth = targetWrapper.offsetWidth || 114;
    var tileCenter = tileLeft + (tileWidth / 2);

    var targetScroll = tileCenter - (dockWidth / 2);
    if (targetScroll < 0) targetScroll = 0;

    var maxScroll = Math.max(0, dom.dockTrack.scrollWidth - dockWidth + 40);
    if (targetScroll > maxScroll) targetScroll = maxScroll;

    dom.dockTrack.style.transform = "translate3d(-" + targetScroll.toFixed(1) + "px, 0, 0)";
    if (dom.groupLabelsRow) {
      dom.groupLabelsRow.style.transform = "translate3d(-" + targetScroll.toFixed(1) + "px, 0, 0)";
    }
  }

  // --------------------------------------------------------------------------
  // Top-Pill Focus State
  // --------------------------------------------------------------------------
  function setTopPillFocus(focused) {
    if (!dom.topPill) return;
    if (focused) {
      state.currentScreen = "top-pill";
      dom.topPill.classList.add("focused");
    } else {
      dom.topPill.classList.remove("focused");
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
    } else if (state.currentScreen === "top-pill") {
      handleTopPillKeys(keyCode);
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
    } else if (keyCode === 38) { // Up -> Focus Top-Right Pill
      setTopPillFocus(true);
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

  function handleTopPillKeys(keyCode) {
    if (keyCode === 40 || keyCode === 37 || keyCode === 39) { // Down, Left, Right -> Return to dock
      setTopPillFocus(false);
      setTileFocus(state.currentTileIndex, true);
    } else if (keyCode === 13) { // OK / Enter -> Open Settings
      setTopPillFocus(false);
      openSettingsDialog();
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

        var iconName = app.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        var iconImg = document.createElement("img");
        iconImg.className = "lib-icon";
        iconImg.decoding = "async";
        iconImg.src = "assets/icons/" + iconName + ".png";
        iconImg.alt = app.name;
        iconImg.onerror = (function(imgEl, key) {
          return function() { imgEl.src = "assets/icons/" + key + ".svg"; };
        })(iconImg, iconName);

        var nameDiv = document.createElement("div");
        nameDiv.className = "lib-name";
        nameDiv.textContent = app.name;

        card.appendChild(iconImg);
        card.appendChild(nameDiv);

        (function(idx, appObj) {
          card.addEventListener("click", function() {
            closeAppLibrary();
            if (window.CleanHome.launchApp) {
              window.CleanHome.launchApp({ name: appObj.name, appId: appObj.id, icon: "apps" });
            }
          });
        })(i, app);

        dom.libraryCardsTrack.appendChild(card);
      }

      setLibraryCardFocus(0, false);
    } catch (e) {
      showError("renderLibraryCards error: " + e.message);
    }
  }

  function setLibraryCardFocus(index, smooth) {
    if (!dom.libraryCardsTrack) return;
    state.currentLibraryIndex = index;
    var cards = dom.libraryCardsTrack.children;
    for (var i = 0; i < cards.length; i++) {
      if (i === index) cards[i].classList.add("focused");
      else cards[i].classList.remove("focused");
    }

    var targetCard = cards[index];
    if (!targetCard) return;

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
        window.CleanHome.launchApp({ name: app.name, appId: app.id, icon: "apps" });
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
        card.className = "wp-card" + (i === state.currentWallpaperIndex ? " focused" : "");
        card.dataset.index = i;

        var thumb = document.createElement("img");
        thumb.decoding = "async";
        thumb.src = wp.thumbPath || wp.path;
        thumb.alt = wp.name;

        var title = document.createElement("div");
        title.className = "wp-title";
        title.textContent = wp.title;

        card.appendChild(thumb);
        card.appendChild(title);

        (function(idx, wpObj) {
          card.addEventListener("click", function() {
            selectWallpaper(wpObj);
            closeWallpapersDialog();
          });
        })(i, wp);

        dom.wallpapersGrid.appendChild(card);
      }
    } catch (e) {
      showError("renderWallpapersGrid error: " + e.message);
    }
  }

  function setWallpaperCardFocus(index) {
    if (!dom.wallpapersGrid) return;
    state.currentWallpaperIndex = index;
    var cards = dom.wallpapersGrid.children;
    for (var i = 0; i < cards.length; i++) {
      if (i === index) cards[i].classList.add("focused");
      else cards[i].classList.remove("focused");
    }
  }

  function handleWallpapersKeys(keyCode) {
    var count = state.wallpapers.length;
    if (keyCode === 37) { // Left
      var prev = state.currentWallpaperIndex - 1;
      if (prev < 0) prev = count - 1;
      setWallpaperCardFocus(prev);
    } else if (keyCode === 39) { // Right
      var next = state.currentWallpaperIndex + 1;
      if (next >= count) next = 0;
      setWallpaperCardFocus(next);
    } else if (keyCode === 13) { // OK
      var wp = state.wallpapers[state.currentWallpaperIndex];
      if (wp) {
        selectWallpaper(wp);
        closeWallpapersDialog();
      }
    }
  }

  function selectWallpaper(wp) {
    if (!wp) return;
    state.settings.wallpaper = wp.path;
    saveSettings();
    if (dom.bgLayers[state.activeBgLayer]) {
      dom.bgLayers[state.activeBgLayer].style.backgroundImage = 'url("' + wp.path + '")';
    }
    if (window.CleanHome.showToast) {
      window.CleanHome.showToast("Wallpaper: " + wp.title, false);
    }
  }

  // --------------------------------------------------------------------------
  // Back Key Navigation
  // --------------------------------------------------------------------------
  function handleBack() {
    if (state.currentScreen === "settings") {
      closeSettingsDialog();
    } else if (state.currentScreen === "top-pill") {
      setTopPillFocus(false);
      setTileFocus(state.currentTileIndex, true);
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
  // Debug Line & 60-Frame Live Rolling FPS (Requirement 1 & Part 4)
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
  // Idle Screensaver Management
  // --------------------------------------------------------------------------
  function setupIdleTimer() {
    if (state.idleTimer) clearTimeout(state.idleTimer);
    state.idleTimer = setTimeout(function() {
      enterScreensaver();
    }, 60000); // 60s idle threshold
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
  // Minute-Aligned Clock
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

    var timeStr = "";
    var ampmStr = "";
    if (state.settings.clockFormat === "24h") {
      var padH = hours < 10 ? "0" + hours : hours;
      timeStr = padH + ":" + padM;
      ampmStr = "";
    } else {
      var h12 = hours % 12;
      if (h12 === 0) h12 = 12;
      timeStr = h12 + ":" + padM;
      ampmStr = hours >= 12 ? "PM" : "AM";
    }

    if (dom.clock && dom.clock.textContent !== timeStr) {
      dom.clock.textContent = timeStr;
    }
    if (dom.ampm) {
      if (dom.ampm.textContent !== ampmStr) dom.ampm.textContent = ampmStr;
      dom.ampm.style.display = ampmStr ? "block" : "none";
    }

    var days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    var months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    var dateStr = days[now.getDay()] + ", " + now.getDate() + " " + months[now.getMonth()];

    if (dom.date && dom.date.textContent !== dateStr) {
      dom.date.textContent = dateStr;
    }

    if (dom.screensaverClock && dom.screensaverClock.textContent !== timeStr) {
      dom.screensaverClock.textContent = timeStr;
    }
    if (dom.screensaverDate && dom.screensaverDate.textContent !== dateStr) {
      dom.screensaverDate.textContent = dateStr;
    }
  }

  // --------------------------------------------------------------------------
  // Config Loading
  // --------------------------------------------------------------------------
  function loadConfigs(callback) {
    var loaded = 0;
    var total = 3;

    function checkDone() {
      loaded++;
      if (loaded >= total && callback) callback();
    }

    // 1. apps.json
    var xhrApps = new XMLHttpRequest();
    xhrApps.open("GET", "config/apps.json", true);
    xhrApps.onload = function() {
      if (xhrApps.status === 200) {
        try {
          var data = JSON.parse(xhrApps.responseText);
          if (data.tiles) state.tiles = data.tiles;
          if (data["brand-colors"]) state.brandColors = data["brand-colors"];
        } catch (e) {
          console.warn("Failed to parse apps.json: " + e.message);
        }
      }
      checkDone();
    };
    xhrApps.onerror = checkDone;
    xhrApps.send();

    // 2. hero.json
    var xhrHero = new XMLHttpRequest();
    xhrHero.open("GET", "config/hero.json", true);
    xhrHero.onload = function() {
      if (xhrHero.status === 200) {
        try {
          state.heroConfig = JSON.parse(xhrHero.responseText);
        } catch (e) {
          console.warn("Failed to parse hero.json: " + e.message);
        }
      }
      checkDone();
    };
    xhrHero.onerror = checkDone;
    xhrHero.send();

    // 3. wallpapers.json
    var xhrWp = new XMLHttpRequest();
    xhrWp.open("GET", "config/wallpapers.json", true);
    xhrWp.onload = function() {
      if (xhrWp.status === 200) {
        try {
          var dataWp = JSON.parse(xhrWp.responseText);
          if (Array.isArray(dataWp)) state.wallpapers = dataWp;
        } catch (e) {
          console.warn("Failed to parse wallpapers.json: " + e.message);
        }
      }
      checkDone();
    };
    xhrWp.onerror = checkDone;
    xhrWp.send();
  }

  // --------------------------------------------------------------------------
  // Application Bootstrap
  // --------------------------------------------------------------------------
  function init() {
    try {
      initDom();

      if (state.isTV) {
        document.documentElement.dataset.tv = "1";
      }

      loadSettings();
      updateViewportScale();
      window.addEventListener("resize", updateViewportScale);

      // Network online/offline event listeners
      window.addEventListener("online", updatePill);
      window.addEventListener("offline", updatePill);

      // Top pill click handler
      if (dom.topPill) {
        dom.topPill.addEventListener("click", function() {
          openSettingsDialog();
        });
      }

      initClock();
      setupIdleTimer();

      loadConfigs(function() {
        renderDock();
      });
    } catch (e) {
      showError("Initialization error: " + e.message);
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  // --------------------------------------------------------------------------
  // Global API Exposure
  // --------------------------------------------------------------------------
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

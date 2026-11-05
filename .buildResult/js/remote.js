/* js/remote.js - CleanHome Remote & Keyboard Navigation
 * Tizen TV input device registration with desktop browser fallbacks.
 *
 * Mappings:
 * - Up (38) / Down (40) / Left (37) / Right (39)
 * - Enter / OK (13)
 * - Back (10009 on Tizen, 27/8 on desktop) with debounce
 * - Yellow (405 / 'y') -> App Library
 * - Blue (406 / 'b') -> Wallpapers
 * - Red (403 / 'r') -> Settings
 * - Green (404 / 'g') -> Toggle Reduced Motion
 */

"use strict";

(function() {
  window.CleanHome = window.CleanHome || {};

  var lastBackTime = 0;
  var BACK_DEBOUNCE_MS = 250;

  function onRemoteKey(keyName) {
    if (!window.CleanHome || typeof window.CleanHome.handleRemoteAction !== "function") return;
    window.CleanHome.handleRemoteAction(keyName);
  }

  // Handle color keys on Tizen devices
  function registerTizenKeys() {
    if (typeof tizen === "undefined" || !tizen.tvinputdevice || typeof tizen.tvinputdevice.registerKey !== "function") {
      return;
    }
    var keys = ["Yellow", "Blue", "Green", "Red"];
    for (var i = 0; i < keys.length; i++) {
      try {
        tizen.tvinputdevice.registerKey(keys[i], function(event) {
          onRemoteKey(event.keyName);
        });
      } catch (e) {
        console.warn("Could not register Tizen key " + keys[i] + ": " + e.message);
      }
    }
  }

  document.addEventListener("DOMContentLoaded", function() {
    registerTizenKeys();
  });

  // Global keydown handler covering Tizen remote codes and desktop keys
  document.addEventListener("keydown", function(e) {
    var keyCode = e.keyCode || e.which;

    // Reset idle screensaver timer on any key press
    if (window.CleanHome && typeof window.CleanHome.onUserActivity === "function") {
      window.CleanHome.onUserActivity();
    }

    // Yellow key (405 on Tizen or 'y'/'Y')
    if (keyCode === 405 || e.key === "y" || e.key === "Y" || e.key === "Yellow") {
      e.preventDefault();
      onRemoteKey("Yellow");
      return;
    }

    // Blue key (406 on Tizen or 'b'/'B')
    if (keyCode === 406 || e.key === "b" || e.key === "B" || e.key === "Blue") {
      e.preventDefault();
      onRemoteKey("Blue");
      return;
    }

    // Red key (403 on Tizen or 'r'/'R')
    if (keyCode === 403 || e.key === "r" || e.key === "R" || e.key === "Red") {
      e.preventDefault();
      onRemoteKey("Red");
      return;
    }

    // Green key (404 on Tizen or 'g'/'G')
    if (keyCode === 404 || e.key === "g" || e.key === "G" || e.key === "Green") {
      e.preventDefault();
      onRemoteKey("Green");
      return;
    }

    // Back key (10009 on Tizen, 27 Escape, 8 Backspace)
    if (keyCode === 10009 || keyCode === 27 || keyCode === 8) {
      e.preventDefault();
      var now = Date.now();
      if (now - lastBackTime < BACK_DEBOUNCE_MS) {
        return; // Debounce rapid back presses
      }
      lastBackTime = now;
      if (window.CleanHome && typeof window.CleanHome.handleBack === "function") {
        window.CleanHome.handleBack();
      }
      return;
    }

    // Directional and action keys: Left, Right, Up, Down, Enter
    if (keyCode === 37 || keyCode === 39 || keyCode === 38 || keyCode === 40 || keyCode === 13) {
      if (window.CleanHome && typeof window.CleanHome.handleNavKey === "function") {
        e.preventDefault();
        window.CleanHome.handleNavKey(keyCode);
      }
    }
  });

  window.CleanHome.onRemoteKey = onRemoteKey;
})();

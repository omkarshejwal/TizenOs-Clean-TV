/* js/launcher.js - CleanHome Application Launcher & Discovery
 * Tizen application launch with fallback URLs and desktop mock support.
 */

"use strict";

(function() {
  window.CleanHome = window.CleanHome || {};

  function showToast(message, isError) {
    var container = document.getElementById("toast-container");
    if (!container) return;

    var toast = document.createElement("div");
    toast.className = "toast" + (isError ? " error" : "");
    toast.textContent = message;
    container.innerHTML = "";
    container.appendChild(toast);

    setTimeout(function() {
      toast.classList.add("show");
    }, 10);

    setTimeout(function() {
      toast.classList.remove("show");
      setTimeout(function() {
        if (container.contains(toast)) {
          container.removeChild(toast);
        }
      }, 250);
    }, 2800);
  }

  function launchApp(tile) {
    if (!tile) return;

    if (tile.name === "Inputs") {
      if (window.CleanHome && typeof window.CleanHome.openInputsMenu === "function") {
        window.CleanHome.openInputsMenu();
      }
      return;
    }

    if (tile.name === "Store") {
      showToast("Opening Apps Store...", false);
      if (typeof tizen !== "undefined" && tizen.application) {
        try {
          tizen.application.launch("org.tizen.tizenstore", null, function() {
            showToast("Apps Store opened", false);
          });
          return;
        } catch (e) {
          console.warn("Store launch failed: " + e.message);
        }
      }
      showToast("Store: Opening Samsung Apps (desktop preview)", false);
      return;
    }

    if (tile.name === "Wallpapers") {
      if (window.CleanHome && typeof window.CleanHome.openWallpapersDialog === "function") {
        window.CleanHome.openWallpapersDialog();
      }
      return;
    }

    showToast("Launching " + tile.name + "...", false);

    if (typeof tizen !== "undefined" && tizen.application && typeof tizen.application.launch === "function" && tile.appId) {
      try {
        tizen.application.launch(
          tile.appId,
          function() {
            showToast(tile.name + " launched successfully", false);
          },
          function(err) {
            console.warn("Tizen launch failed for " + tile.name + ": " + (err ? err.message : ""));
            if (tile.fallbackUrl) {
              openFallback(tile.fallbackUrl, tile.name);
            } else {
              showToast("Could not open " + tile.name, true);
            }
          }
        );
        return;
      } catch (e) {
        console.warn("Exception during Tizen launch for " + tile.name + ": " + e.message);
      }
    }

    // Desktop mock or fallback
    if (tile.fallbackUrl) {
      openFallback(tile.fallbackUrl, tile.name);
    } else {
      showToast("Mock: " + tile.name + " launched", false);
    }
  }

  function openFallback(url, name) {
    showToast("Opening " + name + " fallback...", false);
    if (typeof tizen !== "undefined" && tizen.application) {
      try {
        var appControl = new tizen.ApplicationControl("http://tizen.org/appcontrol/operation/view", url);
        tizen.application.launchAppControl(appControl, null, null, null, null);
        return;
      } catch (e) {
        console.warn("ApplicationControl fallback failed: " + e.message);
      }
    }
    // Desktop preview mode
    console.log("Desktop preview: fallback URL for " + name + " -> " + url);
  }

  function getInstalledApps(callback) {
    if (typeof tizen !== "undefined" && tizen.application && typeof tizen.application.getAppsInfo === "function") {
      try {
        tizen.application.getAppsInfo(function(apps) {
          if (callback) callback(apps || []);
        });
        return;
      } catch (e) {
        console.warn("getAppsInfo failed: " + e.message);
      }
    }

    // Default mock list for desktop testing
    setTimeout(function() {
      if (callback) {
        callback([
          { id: "org.netflix.tv", name: "Netflix" },
          { id: "com.google.youtube.tv", name: "YouTube" },
          { id: "amazon.amazonvideo.amazonvideo", name: "Prime Video" },
          { id: "disney.hotstar", name: "Disney+ Hotstar" },
          { id: "jiocinema.jio", name: "JioCinema" },
          { id: "com.spotify.tv", name: "Spotify" },
          { id: "com.sec.android.app.sbrowser", name: "Samsung Internet" },
          { id: "org.tizen.tizenstore", name: "Store" }
        ]);
      }
    }, 50);
  }

  window.CleanHome.launchApp = launchApp;
  window.CleanHome.showToast = showToast;
  window.CleanHome.getInstalledApps = getInstalledApps;
})();

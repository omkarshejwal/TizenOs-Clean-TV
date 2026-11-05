/* js/launcher.js - CleanHome Application Launcher & Discovery
 * Tizen application launch with launchAppControl fallback and zero web URLs by default.
 */

"use strict";

(function() {
  window.CleanHome = window.CleanHome || {};

  var lastLaunchInfo = {
    appId: "none",
    appName: "none",
    method: "none",
    status: "idle",
    error: ""
  };

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
    }, 3200);
  }

  function setLastLaunch(appName, appId, status, method, errorText) {
    lastLaunchInfo.appName = appName || "unknown";
    lastLaunchInfo.appId = appId || "none";
    lastLaunchInfo.status = status;
    lastLaunchInfo.method = method;
    lastLaunchInfo.error = errorText || "";

    if (window.CleanHome && typeof window.CleanHome.updateDebugLine === "function") {
      window.CleanHome.updateDebugLine();
    }
  }

  function launchApp(tile) {
    if (!tile) return;

    // Built-in special actions
    if (tile.name === "Settings") {
      if (window.CleanHome && typeof window.CleanHome.openSettingsDialog === "function") {
        window.CleanHome.openSettingsDialog();
      }
      return;
    }

    if (tile.name === "Store") {
      showToast("Opening Apps Store...", false);
      if (typeof tizen !== "undefined" && tizen.application) {
        try {
          tizen.application.launch("org.tizen.tizenstore", null, function() {
            setLastLaunch("Store", "org.tizen.tizenstore", "SUCCESS", "launch", "");
            showToast("Apps Store opened", false);
          });
          return;
        } catch (e) {
          console.warn("Store launch failed: " + e.message);
        }
      }
      setLastLaunch("Store", "org.tizen.tizenstore", "MOCK", "mock", "");
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

    // Physical Tizen TV runtime
    if (typeof tizen !== "undefined" && tizen.application && typeof tizen.application.launch === "function" && tile.appId) {
      try {
        tizen.application.launch(
          tile.appId,
          function() {
            setLastLaunch(tile.name, tile.appId, "SUCCESS", "tizen.application.launch", "");
            showToast(tile.name + " launched successfully", false);
          },
          function(launchErr) {
            console.warn("tizen.application.launch failed for " + tile.name + ": " + (launchErr ? (launchErr.name + " " + launchErr.message) : ""));

            // Secondary attempt: launchAppControl with the app ID
            tryLaunchAppControl(tile, launchErr);
          }
        );
        return;
      } catch (e) {
        console.warn("Exception during Tizen launch for " + tile.name + ": " + e.message);
        tryLaunchAppControl(tile, e);
        return;
      }
    }

    // Desktop mock or fallback
    if (tile.allowWebFallback === true && tile.fallbackUrl) {
      openFallback(tile.fallbackUrl, tile.name);
      setLastLaunch(tile.name, tile.appId, "FALLBACK_WEB", "web", tile.fallbackUrl);
    } else {
      setLastLaunch(tile.name, tile.appId, "MOCK_SUCCESS", "desktop-mock", "");
      showToast("Mock: " + tile.name + " launched" + (tile.appId ? " (" + tile.appId + ")" : ""), false);
    }
  }

  function tryLaunchAppControl(tile, initialErr) {
    if (typeof tizen !== "undefined" && tizen.application && typeof tizen.application.launchAppControl === "function" && tile.appId) {
      try {
        var appControl = new tizen.ApplicationControl("http://tizen.org/appcontrol/operation/default", null, null, null, null);
        tizen.application.launchAppControl(
          appControl,
          tile.appId,
          function() {
            setLastLaunch(tile.name, tile.appId, "SUCCESS", "launchAppControl", "");
            showToast(tile.name + " launched via ApplicationControl", false);
          },
          function(controlErr) {
            handleLaunchFailure(tile, initialErr, controlErr);
          },
          null
        );
        return;
      } catch (ctrlEx) {
        handleLaunchFailure(tile, initialErr, ctrlEx);
        return;
      }
    }
    handleLaunchFailure(tile, initialErr, null);
  }

  function handleLaunchFailure(tile, initialErr, controlErr) {
    var errObj = initialErr || controlErr || {};
    var errName = errObj.name || "LaunchError";
    var errMsg = errObj.message || (controlErr ? controlErr.message : "App not found or launch rejected");
    var errorSummary = errName + " - " + errMsg;

    setLastLaunch(tile.name, tile.appId, "FAILED", "failed", errorSummary);

    // Show toast with REAL error details: error.name, error.message, and app ID tried
    var toastMsg = tile.name + ": " + errName + " (" + errMsg + ", id " + (tile.appId || "none") + ")";
    showToast(toastMsg, true);

    // Only if explicitly allowed will web fallback run
    if (tile.allowWebFallback === true && tile.fallbackUrl) {
      openFallback(tile.fallbackUrl, tile.name);
    }
  }

  function openFallback(url, name) {
    if (typeof tizen !== "undefined" && tizen.application) {
      try {
        var appControl = new tizen.ApplicationControl("http://tizen.org/appcontrol/operation/view", url);
        tizen.application.launchAppControl(appControl, null, null, null, null);
        return;
      } catch (e) {
        console.warn("ApplicationControl fallback failed: " + e.message);
      }
    }
    console.log("Desktop preview fallback: " + name + " -> " + url);
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
  window.CleanHome.getLastLaunchInfo = function() { return lastLaunchInfo; };
})();

/* js/motion-config.js - CleanHome Motion & Glass Configuration
 * Derived directly from CleanYourTV reference (Motion.java, GlassView.java, MainActivity.java, AppAdapter.java).
 *
 * All values translated into web standards compatible with Tizen 4+ (Chromium 56/69 baseline).
 * STRICT TIZEN RULES:
 * - Only transform and opacity are animated.
 * - No box-shadow/filter/width/height/top/left animations.
 * - No backdrop-filter by default (fake glass via pre-blurred wallpaper + translucent gradients).
 * - will-change only on focused tile and wallpaper.
 * - No optional chaining (?.), no flex gap, no inset, no linear() easing.
 * - reducedMotion is ON only from user setting or OS prefers-reduced-motion media query. Never auto-saved.
 */

"use strict";

window.MotionConfig = {
  // Spring Physics & Conversion
  // Android SpringForce formula: x'' + 2*zeta*omega*x' + omega^2*x = 0
  // 1) Critically damped (focusOvershoot = false):
  //    stiffness k = 440 (or 520), zeta = 1.0. omega = sqrt(440) = 20.98 rad/s.
  //    Step response: x(t) = 1 - (1 + omega*t) * exp(-omega*t).
  //    Settling time (99%): t ~ 6.64 / 20.98 = 316ms.
  //    Equivalent CSS curve: cubic-bezier(0.2, 0.8, 0.2, 1.0), duration: 300ms.
  //
  // 2) Overshoot spring (focusOvershoot = true):
  //    stiffness k = 260, zeta = 0.58. omega_n = 16.12 rad/s, omega_d = 13.14 rad/s.
  //    Peak overshoot: t_peak = pi / 13.14 = 239ms, overshoot ratio = 10.7%.
  //    Settling time: ~420ms.
  //    Equivalent CSS curve: cubic-bezier(0.34, 1.4, 0.64, 1.0), duration: 400ms.
  //
  // 3) Reduced Motion (Motion.java):
  //    stiffness = 15000, zeta = 1.0, REDUCED_MS = 90ms.
  //    Settles in ~5 frames (<90ms).
  //    Equivalent CSS curve: cubic-bezier(0.1, 0.9, 0.2, 1.0), duration: 90ms.

  spring: {
    criticallyDamped: {
      stiffness: 440,
      dampingRatio: 1.0,
      durationMs: 300,
      cubicBezier: "cubic-bezier(0.2, 0.8, 0.2, 1.0)"
    },
    overshoot: {
      stiffness: 260,
      dampingRatio: 0.58,
      durationMs: 400,
      cubicBezier: "cubic-bezier(0.34, 1.4, 0.64, 1.0)"
    },
    reduced: {
      stiffness: 15000,
      dampingRatio: 1.0,
      durationMs: 90,
      cubicBezier: "cubic-bezier(0.1, 0.9, 0.2, 1.0)"
    }
  },

  // Tile Dimensions & Focus Dynamics (from AppAdapter.java & item_app.xml)
  tile: {
    width: 180,
    height: 101,
    cornerRadius: 16,
    scaleFocused: 1.12,
    scaleRest: 1.0,
    liftY: -4,           // translateY(-4px) on focus
    durationFocusMs: 220,
    durationUnfocusMs: 170,
    durationReducedFocusMs: 90,
    durationReducedUnfocusMs: 60,
    easing: "cubic-bezier(0.0, 0.0, 0.2, 1.0)" // DecelerateInterpolator(1.5f)
  },

  // Banner Artwork Inside Tile
  banner: {
    scaleFocused: 1.035,
    scaleRest: 1.0,
    durationMs: 280
  },

  // Name Label Below Tile
  tileName: {
    width: 180,
    height: 22,
    marginTop: 7,        // top of name = 108px from card top (101 + 7)
    fontSize: 14,
    textColor: "#F2FFFFFF",
    letterSpacing: "0.02em",
    unfocusedTranslationY: -6,
    focusedTranslationY: 4,
    durationMs: 220
  },

  // Single Floating Glass Highlight (from GlassView.java)
  glass: {
    pad: 6,              // 6px padding for glow inset on each side
    width: 214,          // 180 * 1.12 + 12px padding
    height: 125,         // 101 * 1.12 + 12px padding
    cornerRadius: 18,    // 16px * 1.12
    strokeWidth: 1.5,
    rimColorDefault: "rgba(255, 255, 255, 0.80)",     // 0xCCFFFFFF
    rimColorAccentAlpha: 0.90,                         // 0xE6
    fillGradient: "linear-gradient(180deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0.07) 100%)",
    specularGradient: "linear-gradient(180deg, rgba(255, 255, 255, 0.40) 0%, rgba(255, 255, 255, 0.0) 100%)",
    outerGlowDefault: "0 0 16px rgba(255, 255, 255, 0.19)",
    outerGlowAccentAlpha: 0.44,                        // 0x70
    fadeInMs: 180,
    fadeOutMs: 160
  },

  // Top Shelf Hero Title
  hero: {
    marginLeft: 68,
    fontSize: 48,
    fontWeight: 300,
    letterSpacing: "-0.02em",
    fadeInMs: 220,
    fadeOutMs: 160
  },

  // Ambient Glow
  ambient: {
    fadeInMs: 220,
    fadeOutMs: 220,
    glowColors: {
      netflix: "#E50914",
      youtube: "#FF0000",
      primevideo: "#00A8E1",
      disney: "#113CCF",
      jiocinema: "#D8005A",
      spotify: "#1DB954",
      "samsung-internet": "#2C2684",
      inputs: "#666666"
    }
  },

  // Top Bar Frosted Buttons (Pills)
  topButton: {
    height: 42,
    cornerRadius: 21,
    scaleFocused: 1.04,
    durationMs: 160,
    durationReducedMs: 90,
    unfocusedBg: "linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.08) 100%)",
    unfocusedBorder: "1px solid rgba(255, 255, 255, 0.22)",
    focusedBg: "#F5FFFFFF",
    focusedTextColor: "#111111",
    unfocusedTextColor: "#FFFFFFFF"
  },

  // Dock Band (DockDecoration.java)
  dock: {
    cornerRadius: 26,
    bandBg: "rgba(20, 20, 22, 0.80)",                  // 0xCC141416
    bandBorder: "1px solid rgba(255, 255, 255, 0.12)", // 0x1FFFFFFF
    paddingVertical: 14,
    paddingHorizontal: 22
  },

  // App Library Dialog (AppLibraryDialog.java)
  appLibrary: {
    width: 800,
    height: 280,
    cornerRadius: 20,
    cardWidth: 132,
    cardHeight: 170,
    cardMargin: 6,
    cardRadius: 18,
    iconSize: 60,
    panelBg: "linear-gradient(180deg, #2A2A2E 0%, #161618 100%)",
    panelBorder: "1px solid rgba(255, 255, 255, 0.20)",
    dimBehind: 0.55,
    fadeInMs: 180,
    springStiffness: 260,
    springDamping: 0.58
  },

  // Inputs Popup (popup_inputs.xml)
  inputsPopup: {
    width: 220,
    itemHeight: 42,
    cornerRadius: 20,
    itemRadius: 13,
    panelBg: "linear-gradient(180deg, #2A2A2E 0%, #161618 100%)",
    panelBorder: "1px solid rgba(255, 255, 255, 0.20)",
    fadeInMs: 220
  }
};


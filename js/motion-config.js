/* js/motion-config.js - CleanHome Motion & Glass Configuration
 * Measured and calibrated for the 1920x1080 reference layout.
 *
 * STRICT TIZEN RULES:
 * - Only transform and opacity are animated.
 * - No box-shadow/filter/width/height/top/left animations.
 * - will-change only on focused tile and dock row.
 * - No optional chaining (?.), no flex gap, no inset, no linear() easing.
 */

"use strict";

window.MotionConfig = {
  // 1920x1080 Design Coordinate System
  layout: {
    designWidth: 1920,
    designHeight: 1080,
    tvSafePadding: 48
  },

  // Top Bar Layout
  topBar: {
    paddingTop: 48,
    paddingLeft: 48,
    greetingSize: 24,
    clockSize: 64,
    ampmSize: 24,
    dateSize: 24
  },

  // Top-Right Frosted Glass Pill
  topPill: {
    height: 56,
    radius: 28,
    avatarSize: 42,
    marginRight: 48,
    marginTop: 48
  },

  // Hero Block (Middle-Left)
  hero: {
    left: 48,
    bottomOffsetFromDock: 32,
    labelSize: 24,
    titleSize: 52,
    titleWeight: 300
  },

  // Hero Poster Card (Right side)
  poster: {
    width: 360,
    height: 520,
    radius: 24,
    right: 48,
    bottom: 120
  },

  // Bottom Frosted Glass Dock
  dock: {
    height: 154,
    radius: 36,
    left: 48,
    right: 48,
    bottom: 64,
    paddingHorizontal: 22,
    paddingVertical: 18
  },

  // Tile Dimensions & Focus Dynamics
  tile: {
    width: 114,
    height: 114,
    radius: 24,
    marginHorizontal: 10,
    scaleFocusedRich: 1.15,
    scaleFocusedLite: 1.08,
    liftY: -8,
    glowPad: 28,
    glowOpacity: 0.85
  },

  // Group Labels and Separators
  group: {
    labelSize: 24,
    separatorWidth: 1,
    separatorMargin: 16
  },

  // Animation Timing & Durations
  timing: {
    dockScrollMs: 220,
    dockScrollEasing: "cubic-bezier(0.2, 0.0, 0.0, 1.0)",
    bgCrossfadeMs: 350,
    bgCrossfadeEasing: "ease",
    tileFocusMs: 160,
    tileFocusEasing: "cubic-bezier(0.2, 0.8, 0.2, 1.0)",
    reducedMotionMs: 90
  }
};

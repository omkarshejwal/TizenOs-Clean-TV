# CleanHome Animation Specification

Derived from CleanYourTV Android TV launcher Motion.java

## Spring Parameters (Android to CSS/JS Conversion)

### Android Spring Settings
- **Stiffness**: 15000 (N/m equivalent)
- **Damping Ratio**: `DAMPING_RATIO_NO_BOUNCY` (critically damped, no bounce)
- **Minimum Visible Change**: 2 pixels
- **Max Animation Duration**: 90 ms (REDUCED_MS)

### CSS/JS Equivalent
Since Tizen's old Chromium engine doesn't support `SpringAnimation`, we use cubic-bezier approximations:

```css
/* Standard spring ease */
.c-spring { 
  transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Reduced motion (stiff, no bounce) */
.c-spring-rm { 
  transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
  transition-duration: 90ms;
}
```

### Conversion Math
- Android: `omega_n = sqrt(stiffness/mass) = sqrt(15000) ≈ 122.47 rad/s`
- Damping ratio `zeta = 0.3` (underdamped, no bounce)
- Settling time `≈ 4/(zeta*omega_n) ≈ 0.1s`
- For Tizen, we pre-compute the cubic-bezier curve that best approximates this spring behavior

### Key Frames & Easing

| Property | From → To | Duration | Easing |
|----------|-----------|----------|--------|
| Scale (focus) | 1.0 → 1.12 | 90ms | cubic-bezier(0.34, 1.56, 0.64, 1) |
| Opacity (focus) | 1.0 → 1.0 | 90ms | cubic-bezier(0.34, 1.56, 0.64, 1) |
| Neighbor dim | opacity 1.0 → 0.85 | 90ms | cubic-bezier(0.34, 1.56, 0.64, 1) |
| Row scroll | translateX | 150ms | cubic-bezier(0.34, 1.56, 0.64, 1) |

### Reduced Motion Override
- `REDUCED_MS = 90` ms max duration
- `REDUCED_STIFFNESS = 15000` but simplified to `cubic-bezier(0.34, 1.56, 0.64, 1)`
- `REDUCED_MIN_CHANGE = 2` pixels (ignore changes < 2px)

### CSS Variables for Tuning (js/motion-config.js)

```javascript
export const ANIMATION = {
  DURATION: {
    FOCUS_SCALE: 90,     // ms
    NEIGHBOR: 90,        // ms
    ROW_SCROLL: 150,     // ms
    TOAST: 300,          // ms
    DEBOUNCE: 500,       // ms (back key)
  },
  EASING: {
    STANDARD: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    REDUCED: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  SPRING: {
    STIFFNESS: 15000,    // Android equivalent
    DAMPING: 0.3,        // no bounce
    MIN_CHANGE: 2,       // pixels
    MAX_DURATION: 90,    // ms
  }
};
```

### Tizen Constraints (Strict)
- ✅ Animate only: `transform` and `opacity`
- ❌ No: `box-shadow`, `filter`, `width`/`height`/`top`/`-left`, `layout` reads
- ✅ `will-change: transform` only on focused tile and wallpaper layer
- ✅ One shared animation scheduler (no animation queue buildup)
- ✅ Cancel/retarget animations on rapid key presses
- ❌ No `layout reads` (offsetWidth, getBoundingClientRect) in key handlers
- ❌ No `flex-gap` in CSS
- ❌ No `CSS inset` property
- ❌ No `linear()` easing (precompute spring curves into cubic-bezier)

### Reduced Motion Policy
- ON only if: user set it in Settings, OR OS reports `prefers-reduced-motion: reduce`
- ❌ Never auto-saved or auto-detected from frame times during this session
- Frame-time auto-detect is disabled per user setting request
- Keep earlier fix for reducedMotion logic
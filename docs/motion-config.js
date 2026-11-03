/**
 * CleanHome Motion Configuration
 * 
 * All animation durations, easings, and spring settings are defined in one place
 * so they can be tuned without modifying animation logic.
 * 
 * @see docs/ANIMATION-SPEC.md for derivation from CleanYourTV Android project
 */
export const ANIMATION = {
  /** Duration in milliseconds */
  DURATION: {
    /** Focus scale/glow/tilt animation duration */
    FOCUS_SCALE: 90,
    /** Neighbor tile dim animation duration */
    NEIGHBOR: 90,
    /** Row scroll animation duration */
    ROW_SCROLL: 150,
    /** Toast show/hide duration */
    TOAST: 300,
    /** Back key debounce duration */
    DEBOUNCE: 500,
    /** Reduced motion max duration */
    REDUCED: 90,
  },

  /** Easing functions */
  EASING: {
    /** Standard cubic-bezier approximation from Android stiffness=15000 */
    STANDARD: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    /** Reduced motion easing (same as standard for consistency) */
    REDUCED: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  /** Spring configuration (Android equivalents) */
  SPRING: {
    /** Stiffness value (15000 = critically damped, no bounce) */
    STIFFNESS: 15000,
    /** Damping ratio (0.3 = underdamped, no bounce) */
    DAMPING: 0.3,
    /** Minimum pixel change to register (2px) */
    MIN_CHANGE: 2,
    /** Max duration for reduced motion (90ms) */
    MAX_DURATION: 90,
  },
};

/**
 * Get animation duration based on reduced motion setting
 * @param {boolean} isReduced - whether reduced motion is enabled
 * @returns {number} duration in milliseconds
 */
export const getAnimationDuration = (isReduced) => {
  return isReduced ? ANIMATION.DURATION.REDUCED : ANIMATION.DURATION.FOCUS_SCALE;
};

/**
 * Get the easing function based on reduced motion setting
 * @param {boolean} isReduced - whether reduced motion is enabled
 * @returns {string} easing function string
 */
export const getEasing = (isReduced) => {
  return ANIMATION.EASING.REDUCED; // Same as standard for consistency
};

/**
 * Check if the given CSS property is animatable under Tizen constraints
 * @param {string} property - CSS property name
 * @returns {boolean} true if animatable
 */
export const isAnimatableProperty = (property) => {
  const allowed = [
    'transform',
    'opacity',
    'scale',
    'rotate',
    'translateX',
    'translateY',
    'scaleX',
    'translateY',
  ];
  return allowed.includes(property.toLowerCase());
};

/**
 * Get the will-change value for a given element type
 * @param {'focus' | 'wallpaper' | 'neighbor'} type - element type
 * @returns {string} will-change value
 */
export const getWillChange = (type) => {
  const map = {
    focus: 'transform, opacity',
    wallpaper: 'transform',
    neighbor: 'opacity',
  };
  return map[type] || 'transform';
};
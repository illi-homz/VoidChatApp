/**
 * Manual mock for react-native-reanimated (v4.x).
 * Provides NOOP stubs for all Reanimated APIs used across the project.
 */

const NOOP = () => {};
const NOOP_FACTORY = () => NOOP;
const ID = t => t;

// Shared value mock
function createSharedValue(init) {
  const value = { value: init };
  return new Proxy(value, {
    get(target, prop) {
      if (prop === 'value') return target.value;
      return target[prop];
    },
    set(target, prop, newValue) {
      if (prop === 'value') {
        target.value = newValue;
        return true;
      }
      return false;
    },
  });
}

const Easing = {
  linear: ID,
  ease: ID,
  quad: ID,
  cubic: ID,
  poly: ID,
  sin: ID,
  circle: ID,
  exp: ID,
  elastic: ID,
  back: ID,
  bounce: ID,
  bezier: () => ({ factory: ID }),
  bezierFn: ID,
  steps: ID,
  in: ID,
  out: ID,
  inOut: ID,
};

// Animation mock
const animation = {
  cancelAnimation: NOOP,
  withDecay: (_userConfig, callback) => {
    callback?.(true);
    return 0;
  },
  withDelay: (_delayMs, nextAnimation) => nextAnimation,
  withRepeat: ID,
  withSequence: () => 0,
  withSpring: (toValue, _userConfig, callback) => {
    callback?.(true);
    return toValue;
  },
  withTiming: (toValue, _userConfig, callback) => {
    callback?.(true);
    return toValue;
  },
};

// Hooks
const hook = {
  useAnimatedProps: cb => cb(),
  useAnimatedStyle: cb => cb(),
  useAnimatedReaction: NOOP,
  useAnimatedRef: () => ({ current: null }),
  useAnimatedScrollHandler: NOOP_FACTORY,
  useDerivedValue: processor => {
    const result = processor();
    return { value: result, get: () => result };
  },
  useAnimatedSensor: () => ({
    sensor: {
      value: { x: 0, y: 0, z: 0 },
    },
    unregister: NOOP,
    isAvailable: false,
    config: {},
  }),
  useAnimatedKeyboard: () => ({ height: 0, state: 0 }),
  useScrollViewOffset: () => ({ value: 0 }),
  useScrollOffset: () => ({ value: 0 }),
  useSharedValue: createSharedValue,
  useEvent: () => NOOP,
};

// Core utilities
const core = {
  runOnJS: ID,
  runOnUI: ID,
  createWorkletRuntime: NOOP,
  runOnRuntime: NOOP,
  makeMutable: ID,
  createSerializable: ID,
  isReanimated3: () => true,
  enableLayoutAnimations: NOOP,
};

// Base animation builder mock (for layout animations like FadeInDown)
class BaseAnimationMock {
  duration() { return this; }
  delay() { return this; }
  springify() { return this; }
  damping() { return this; }
  stiffness() { return this; }
  mass() { return this; }
  easing(_) { return this; }
  rotate(_) { return this; }
  withCallback() { return this; }
  build() {
    return () => ({ initialValues: {}, animations: {} });
  }
  reduceMotion() { return this; }
}

// Layout animations
const layoutReanimation = {
  BaseAnimationBuilder: BaseAnimationMock,
  ComplexAnimationBuilder: BaseAnimationMock,
  FadeIn: new BaseAnimationMock(),
  FadeInDown: new BaseAnimationMock(),
  FadeInUp: new BaseAnimationMock(),
  FadeInLeft: new BaseAnimationMock(),
  FadeInRight: new BaseAnimationMock(),
  FadeOut: new BaseAnimationMock(),
  FadeOutDown: new BaseAnimationMock(),
  FadeOutUp: new BaseAnimationMock(),
  FadeOutLeft: new BaseAnimationMock(),
  FadeOutRight: new BaseAnimationMock(),
  SlideInRight: new BaseAnimationMock(),
  SlideInLeft: new BaseAnimationMock(),
  SlideInUp: new BaseAnimationMock(),
  SlideInDown: new BaseAnimationMock(),
  SlideOutRight: new BaseAnimationMock(),
  SlideOutLeft: new BaseAnimationMock(),
  SlideOutUp: new BaseAnimationMock(),
  SlideOutDown: new BaseAnimationMock(),
  ZoomIn: new BaseAnimationMock(),
  ZoomInRotate: new BaseAnimationMock(),
  ZoomOut: new BaseAnimationMock(),
  BounceIn: new BaseAnimationMock(),
  BounceInDown: new BaseAnimationMock(),
  BounceInUp: new BaseAnimationMock(),
  BounceOut: new BaseAnimationMock(),
  Layout: new BaseAnimationMock(),
  LinearTransition: new BaseAnimationMock(),
  FadingTransition: new BaseAnimationMock(),
  SequencedTransition: new BaseAnimationMock(),
  JumpingTransition: new BaseAnimationMock(),
  CurvedTransition: new BaseAnimationMock(),
  EntryExitTransition: new BaseAnimationMock(),
  Keyframe: BaseAnimationMock,
};

// Platform helpers
const platformFunctions = {
  measure: () => ({ x: 0, y: 0, width: 0, height: 0, pageX: 0, pageY: 0 }),
  scrollTo: NOOP,
};

// Reanimated Animated components
const Animated = {
  View: require('react-native').View,
  Text: require('react-native').Text,
  Image: require('react-native').Image,
  ScrollView: require('react-native').ScrollView,
  FlatList: require('react-native').FlatList,
  createAnimatedComponent: ID,
  Extrapolate: 'extend',
  interpolate: NOOP,
  interpolateColor: NOOP,
  clamp: NOOP,
  addWhitelistedUIProps: NOOP,
  addWhitelistedNativeProps: NOOP,
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...animation,
  ...hook,
  ...core,
  ...layoutReanimation,
  ...platformFunctions,
  Easing,
  Animated,
};

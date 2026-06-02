import { NativeModules } from 'react-native';

export interface ScreenCaptureInterface {
  allowScreenCapture: () => Promise<void>;
  disallowScreenCapture: () => Promise<void>;
}

const { ScreenCapture } = NativeModules;

function createFallback(): ScreenCaptureInterface {
  return {
    allowScreenCapture: async () => {},
    disallowScreenCapture: async () => {},
  };
}

export const screenCapture: ScreenCaptureInterface = ScreenCapture
  ? {
      allowScreenCapture: async () => {
        try {
          await ScreenCapture.allowScreenCapture();
        } catch (e) {
          console.warn('[ScreenCapture] allowScreenCapture failed:', e);
        }
      },
      disallowScreenCapture: async () => {
        try {
          await ScreenCapture.disallowScreenCapture();
        } catch (e) {
          console.warn('[ScreenCapture] disallowScreenCapture failed:', e);
        }
      },
    }
  : createFallback();

import { NativeModules } from 'react-native';

export interface AudioRouterInterface {
  setSpeakerphoneOn: (on: boolean) => Promise<void>;
  startAudioSession: () => Promise<void>;
  stopAudioSession: () => Promise<void>;
  setMicrophoneMute: (mute: boolean) => Promise<void>;
  rawToCache: (rawResourceName: string, cacheFileName: string) => Promise<string>;
}

const { AudioRouter } = NativeModules;

function createFallback(): AudioRouterInterface {
  return {
    setSpeakerphoneOn: async (_on: boolean) => {},
    startAudioSession: async () => {},
    stopAudioSession: async () => {},
    setMicrophoneMute: async (_mute: boolean) => {},
    rawToCache: async (_rawResourceName: string, _cacheFileName: string) => {
      throw new Error('AudioRouter native module not available');
    },
  };
}

export const audioRouter: AudioRouterInterface = AudioRouter
  ? {
      setSpeakerphoneOn: async (on: boolean) => {
        try {
          await AudioRouter.setSpeakerphoneOn(on);
        } catch (e) {
          console.warn('[AudioRouter] setSpeakerphoneOn failed:', e);
        }
      },
      startAudioSession: async () => {
        try {
          await AudioRouter.startAudioSession();
        } catch (e) {
          console.warn('[AudioRouter] startAudioSession failed:', e);
        }
      },
      stopAudioSession: async () => {
        try {
          await AudioRouter.stopAudioSession();
        } catch (e) {
          console.warn('[AudioRouter] stopAudioSession failed:', e);
        }
      },
      setMicrophoneMute: async (mute: boolean) => {
        try {
          await AudioRouter.setMicrophoneMute(mute);
        } catch (e) {
          console.warn('[AudioRouter] setMicrophoneMute failed:', e);
        }
      },
      rawToCache: async (rawResourceName: string, cacheFileName: string) => {
        return AudioRouter.rawToCache(rawResourceName, cacheFileName);
      },
    }
  : createFallback();

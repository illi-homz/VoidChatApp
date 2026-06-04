// Mock for react-native-nitro-sound
const Sound = {
  startRecorder: jest.fn().mockResolvedValue({ path: '/tmp/test_voice.m4a' }),
  stopRecorder: jest.fn().mockResolvedValue({ path: '/tmp/test_voice.m4a' }),
  pauseRecorder: jest.fn().mockResolvedValue({}),
  resumeRecorder: jest.fn().mockResolvedValue({}),
  addRecordBackListener: jest.fn(),
  removeRecordBackListener: jest.fn(),
  startPlayer: jest.fn().mockResolvedValue({}),
  stopPlayer: jest.fn(),
  pausePlayer: jest.fn().mockResolvedValue({}),
  resumePlayer: jest.fn().mockResolvedValue({}),
  seekToPlayer: jest.fn().mockResolvedValue({}),
  setPlaybackSpeed: jest.fn().mockResolvedValue({}),
  setVolume: jest.fn().mockResolvedValue({}),
  addPlayBackListener: jest.fn(),
  removePlayBackListener: jest.fn(),
  addPlaybackEndListener: jest.fn(),
  removePlaybackEndListener: jest.fn(),
  mmssss: jest.fn().mockReturnValue('0:00'),
};

export default Sound;

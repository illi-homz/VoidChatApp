/**
 * @format
 */

// Мок для react-native-callkeep (NativeEventEmitter требует реальный NativeModules)
jest.mock('react-native-callkeep', () => {
  const addEventListener = jest.fn().mockReturnValue({ remove: jest.fn() });
  return {
    setup: jest.fn().mockResolvedValue(undefined),
    setAvailable: jest.fn(),
    startCall: jest.fn(),
    setCurrentCallActive: jest.fn(),
    displayIncomingCall: jest.fn(),
    endCall: jest.fn(),
    updateDisplay: jest.fn(),
    addEventListener,
    removeEventListener: jest.fn(),
    reportEndCallWithUUID: jest.fn(),
  };
});

// Мок для AudioRouter (используется CallStore)
jest.mock('../src/services/AudioRouter', () => ({
  audioRouter: {
    setSpeakerphoneOn: jest.fn(),
    startAudioSession: jest.fn(),
    stopAudioSession: jest.fn(),
    setMicrophoneMute: jest.fn(),
  },
}));

// Мок для WebRTCService
jest.mock('../src/services/WebRTCService', () => ({
  webrtcService: {
    setMicrophoneEnabled: jest.fn(),
    stopCall: jest.fn(),
  },
}));

import { callStore } from '../src/stores/CallStore';

describe('CallStore', () => {
  beforeEach(() => {
    callStore.reset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should start in idle state', () => {
    expect(callStore.status).toBe('idle');
    expect(callStore.callId).toBeNull();
    expect(callStore.contactId).toBeNull();
    expect(callStore.duration).toBe(0);
    expect(callStore.isMuted).toBe(false);
    expect(callStore.isSpeakerOn).toBe(false);
    expect(callStore.error).toBeNull();
    expect(callStore.hasRemoteStream).toBe(false);
  });

  it('should transition to calling on outgoing call', () => {
    callStore.startOutgoingCall({
      callId: 'test-call-1',
      contactId: 'user-2',
      contactName: 'Test User',
    });

    expect(callStore.status).toBe('calling');
    expect(callStore.callId).toBe('test-call-1');
    expect(callStore.contactId).toBe('user-2');
    expect(callStore.contactName).toBe('Test User');
    expect(callStore.direction).toBe('outgoing');
  });

  it('should reset state before starting a new outgoing call', () => {
    // Сначала задаём состояние
    callStore.startOutgoingCall({
      callId: 'old-call',
      contactId: 'old-contact',
      contactName: 'Old User',
    });
    callStore.toggleMute();
    callStore.toggleSpeaker();
    callStore.setConnected();

    // Затем новый звонок (должен сбросить)
    callStore.startOutgoingCall({
      callId: 'new-call',
      contactId: 'new-contact',
      contactName: 'New User',
    });

    expect(callStore.status).toBe('calling');
    expect(callStore.callId).toBe('new-call');
    expect(callStore.isMuted).toBe(false);
    expect(callStore.isSpeakerOn).toBe(false);
    expect(callStore.duration).toBe(0);
  });

  it('should transition to ringing on incoming call', () => {
    callStore.startIncomingCall({
      callId: 'test-call-2',
      fromUserId: 'user-1',
      contactName: 'Caller',
    });

    expect(callStore.status).toBe('ringing');
    expect(callStore.direction).toBe('incoming');
    expect(callStore.callId).toBe('test-call-2');
    expect(callStore.contactId).toBe('user-1');
    expect(callStore.contactName).toBe('Caller');
  });

  it('should transition to connected', () => {
    callStore.startOutgoingCall({
      callId: 'test-call-3',
      contactId: 'user-2',
      contactName: 'Test User',
    });
    callStore.setConnected();

    expect(callStore.status).toBe('connected');
    expect(callStore.duration).toBe(0);
    expect(callStore.hasRemoteStream).toBe(false);
  });

  it('should increment duration every second when connected', () => {
    callStore.startOutgoingCall({
      callId: 'test-call-4',
      contactId: 'user-2',
      contactName: 'Test User',
    });
    callStore.setConnected();

    // Симулируем 2.5 секунды
    jest.advanceTimersByTime(2500);

    expect(callStore.duration).toBeGreaterThanOrEqual(2);
    expect(callStore.duration).toBeLessThanOrEqual(3);
  });

  it('should stop duration timer on endCall', () => {
    callStore.startOutgoingCall({
      callId: 'test-call-5',
      contactId: 'user-2',
      contactName: 'Test User',
    });
    callStore.setConnected();

    jest.advanceTimersByTime(3000);
    expect(callStore.duration).toBe(3);

    callStore.endCall();

    // Таймер остановлен — duration не должен расти
    const frozenDuration = callStore.duration;
    jest.advanceTimersByTime(5000);
    expect(callStore.duration).toBe(frozenDuration);
  });

  it('should toggle mute', () => {
    callStore.startOutgoingCall({
      callId: 'test-call-6',
      contactId: 'user-2',
      contactName: 'Test User',
    });

    expect(callStore.isMuted).toBe(false);

    callStore.toggleMute();
    expect(callStore.isMuted).toBe(true);

    callStore.toggleMute();
    expect(callStore.isMuted).toBe(false);
  });

  it('should toggle speaker', () => {
    callStore.startOutgoingCall({
      callId: 'test-call-7',
      contactId: 'user-2',
      contactName: 'Test User',
    });

    expect(callStore.isSpeakerOn).toBe(false);

    callStore.toggleSpeaker();
    expect(callStore.isSpeakerOn).toBe(true);

    callStore.toggleSpeaker();
    expect(callStore.isSpeakerOn).toBe(false);
  });

  it('should return CallRecord on endCall when connected', () => {
    callStore.startOutgoingCall({
      callId: 'test-call-8',
      contactId: 'user-2',
      contactName: 'Test User',
    });
    callStore.setConnected();

    // Симулируем 5 секунд разговора
    jest.advanceTimersByTime(5000);

    const record = callStore.endCall();

    expect(record).not.toBeNull();
    expect(record!.contactId).toBe('user-2');
    expect(record!.direction).toBe('outgoing');
    expect(record!.status).toBe('completed');
    expect(record!.duration).toBe(5);
    expect(record!.timestamp).toBeGreaterThan(0);
    expect(record!.callType).toBe('audio');
  });

  it('should return missed CallRecord on endCall when not connected', () => {
    callStore.startOutgoingCall({
      callId: 'test-call-9',
      contactId: 'user-2',
      contactName: 'Test User',
    });

    const record = callStore.endCall();

    expect(record).not.toBeNull();
    expect(record!.status).toBe('missed');
    expect(record!.duration).toBe(0);
  });

  it('should return null on endCall when contactId is null (already reset)', () => {
    const record = callStore.endCall();
    expect(record).toBeNull();
  });

  it('should set status to ended after endCall', () => {
    callStore.startOutgoingCall({
      callId: 'test-call-10',
      contactId: 'user-2',
      contactName: 'Test User',
    });
    callStore.setConnected();

    callStore.endCall();
    expect(callStore.status).toBe('ended');
  });

  it('should set failed state', () => {
    callStore.startOutgoingCall({
      callId: 'test-call-11',
      contactId: 'user-2',
      contactName: 'Test User',
    });

    callStore.setFailed('Connection error');

    expect(callStore.status).toBe('failed');
    expect(callStore.error).toBe('Connection error');
  });

  it('should not start duration timer when setFailed is called', () => {
    callStore.setFailed('Failed before connect');

    jest.advanceTimersByTime(5000);
    expect(callStore.duration).toBe(0);
  });

  it('should update contact name with setContactName', () => {
    callStore.startOutgoingCall({
      callId: 'test-call-12',
      contactId: 'user-2',
      contactName: 'Old Name',
    });

    callStore.setContactName('New Name');
    expect(callStore.contactName).toBe('New Name');
  });

  it('should reset all state completely', () => {
    callStore.startOutgoingCall({
      callId: 'test-call-13',
      contactId: 'user-2',
      contactName: 'Test User',
    });
    callStore.setConnected();
    callStore.toggleMute();
    callStore.toggleSpeaker();
    callStore.hasRemoteStream = true;

    callStore.reset();

    expect(callStore.status).toBe('idle');
    expect(callStore.callId).toBeNull();
    expect(callStore.contactId).toBeNull();
    expect(callStore.contactName).toBe('');
    expect(callStore.duration).toBe(0);
    expect(callStore.isMuted).toBe(false);
    expect(callStore.isSpeakerOn).toBe(false);
    expect(callStore.hasRemoteStream).toBe(false);
    expect(callStore.error).toBeNull();
    expect(callStore.direction).toBe('outgoing');
  });

  it('should handle endCall followed by reset gracefully', () => {
    callStore.startOutgoingCall({
      callId: 'test-call-14',
      contactId: 'user-2',
      contactName: 'Test User',
    });
    callStore.setConnected();

    callStore.endCall();
    callStore.reset();

    expect(callStore.status).toBe('idle');
    expect(callStore.callId).toBeNull();
  });

  it('should set failed and preserve error message until reset', () => {
    callStore.setFailed('User declined');

    expect(callStore.error).toBe('User declined');
    expect(callStore.status).toBe('failed');

    callStore.reset();
    expect(callStore.error).toBeNull();
  });
});

/**
 * @format
 */

// ---- Моки нативных модулей ----

jest.mock('react-native-incall-manager', () => ({
  start: jest.fn(),
  stop: jest.fn(),
  startRingtone: jest.fn(),
  stopRingtone: jest.fn(),
  setMicrophoneMute: jest.fn(),
  setSpeakerphoneOn: jest.fn(),
}));

jest.mock('react-native-webrtc', () => ({
  mediaDevices: {
    getUserMedia: jest.fn(() =>
      Promise.resolve({ getTracks: () => [], getAudioTracks: () => [] }),
    ),
  },
  RTCPeerConnection: jest.fn(() => ({
    createOffer: jest.fn(),
    createAnswer: jest.fn(),
    setLocalDescription: jest.fn(),
    setRemoteDescription: jest.fn(),
    addIceCandidate: jest.fn(),
    addTrack: jest.fn(),
    close: jest.fn(),
    onicecandidate: null,
    ontrack: null,
    onconnectionstatechange: null,
    connectionState: 'new',
  })),
  RTCSessionDescription: jest.fn(),
  RTCIceCandidate: jest.fn(),
}));

jest.mock('../src/services/WebRTCService', () => {
  const mockWebrtc = {
    createOffer: jest.fn().mockResolvedValue('{"type":"offer","sdp":"mock-sdp"}'),
    createAnswer: jest.fn().mockResolvedValue('{"type":"answer","sdp":"mock-answer-sdp"}'),
    setRemoteDescription: jest.fn().mockResolvedValue(undefined),
    addIceCandidate: jest.fn().mockResolvedValue(undefined),
    stopCall: jest.fn(),
    handleRenegotiationOffer: jest
      .fn()
      .mockResolvedValue('{"type":"answer","sdp":"mock-reneg-sdp"}'),
    setMicrophoneEnabled: jest.fn(),
    onError: null,
    onConnectionState: null,
    onRenegotiationNeeded: null,
    onIceCandidate: null,
    onRemoteStream: null,
  };
  return { webrtcService: mockWebrtc };
});

jest.mock('../src/services/socket', () => {
  const mockSocket = {
    sendCallOffer: jest.fn(),
    sendCallAccept: jest.fn(),
    sendCallHangup: jest.fn(),
    sendIceCandidate: jest.fn(),
    onCallOfferSent: jest.fn(() => jest.fn()),
    onCallAccepted: jest.fn(() => jest.fn()),
    onCallDeclined: jest.fn(() => jest.fn()),
    onCallEnded: jest.fn(() => jest.fn()),
    onCallTimedOut: jest.fn(() => jest.fn()),
    onIceCandidate: jest.fn(() => jest.fn()),
    onCallIncoming: jest.fn(() => jest.fn()),
  };
  return { socketService: mockSocket };
});

// Мок навигации
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ goBack: jest.fn(), setOptions: jest.fn() }),
    useRoute: () => ({
      params: {
        contactId: 'user-2',
        contactName: 'Test User',
        direction: 'outgoing' as const,
        sdp: null,
        callId: null,
      },
    }),
  };
});

jest.mock('../src/components/Toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('mobx-react-lite', () => ({
  observer: <P,>(component: React.ComponentType<P>): React.ComponentType<P> => component,
}));

import React from 'react';
import TestRenderer from 'react-test-renderer';
import { CallScreen } from '../src/screens/CallScreen';
import { callStore } from '../src/stores/CallStore';

describe('CallScreen', () => {
  beforeEach(() => {
    callStore.reset();
  });

  it('renders without crashing for outgoing call', async () => {
    let tree: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(() => {
      tree = TestRenderer.create(<CallScreen />);
    });

    expect(tree!).toBeDefined();
    const root = tree!.root;

    // Должен показывать имя контакта из route params
    const nameElements = root.findAllByType('Text' as any).filter((node: any) => {
      const children = node.props.children;
      return typeof children === 'string' && children === 'Test User';
    });
    expect(nameElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows end call button', async () => {
    let tree: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(() => {
      tree = TestRenderer.create(<CallScreen />);
    });

    // Ищем кнопку с accessibilityLabel "Завершить звонок"
    const endButtons = tree!.root.findAllByProps({
      accessibilityLabel: 'Завершить звонок',
    } as any);
    expect(endButtons.length).toBeGreaterThanOrEqual(1);
  });
});

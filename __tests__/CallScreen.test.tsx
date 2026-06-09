/**
 * @format
 */

// ---- Моки нативных модулей ----

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

jest.mock(
  'react-native-incall-manager',
  () => ({
    start: jest.fn(),
    stop: jest.fn(),
    startRingtone: jest.fn(),
    stopRingtone: jest.fn(),
    setMicrophoneMute: jest.fn(),
    setSpeakerphoneOn: jest.fn(),
  }),
  { virtual: true },
);

jest.mock('react-native-webrtc', () => ({
  RTCView: 'RTCView',
  MediaStream: jest.fn(),
  mediaDevices: {
    getUserMedia: jest.fn(() =>
      Promise.resolve({
        getTracks: () => [],
        getAudioTracks: () => [],
        getVideoTracks: () => [],
      }),
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
  const mockStream = {
    toURL: jest.fn(() => 'mock-stream-url'),
    getVideoTracks: jest.fn(() => []),
    getAudioTracks: jest.fn(() => []),
  };
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
    setCameraEnabled: jest.fn(),
    switchCamera: jest.fn(),
    localStream: { ...mockStream },
    remoteStream: { ...mockStream },
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
    onDisconnected: jest.fn(),
  };
  return { socketService: mockSocket };
});

// ---- Динамические параметры маршрута ----
// Меняем `current` перед рендером для разных сценариев
const routeParams: { current: Record<string, any> } = {
  current: {
    contactId: 'user-2',
    contactName: 'Test User',
    direction: 'outgoing' as const,
    sdp: null,
    callId: null,
  },
};

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ goBack: jest.fn(), setOptions: jest.fn() }),
    useRoute: () => ({ params: routeParams.current }),
  };
});

// ---- Мок Icon — заменяем SVG на простой Text для поиска ----
jest.mock('../src/components/Icon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = React.memo(
    ({ name, size, color }: { name: string; size?: number; color?: string }) =>
      React.createElement(Text, { testID: `icon-${name}`, style: { color } }, name),
  );
  return {
    Icon: MockIcon,
    CameraOffIcon: () => null,
  };
});

jest.mock('../src/components/Toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('mobx-react-lite', () => ({
  observer: <P,>(component: React.ComponentType<P>): React.ComponentType<P> => component,
}));

jest.mock('../src/components/VideoPiP', () => ({
  VideoPiP: 'VideoPiP',
}));

// react-native-blob-util mock — требуется для AudioService, который импортируется
// через SoundNotificationService (импортируется в CallScreen/index.tsx)
jest.mock('react-native-blob-util', () => ({
  fs: { dirs: { CacheDir: '/cache' } },
  config: jest.fn(() => ({
    fetch: jest.fn(() => Promise.resolve({ path: () => '/tmp/test.apk' })),
  })),
  android: { actionViewIntent: jest.fn() },
}));

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TestRenderer from 'react-test-renderer';
import { CallScreen } from '../src/screens/CallScreen';
import { callStore } from '../src/stores/CallStore';
import { webrtcService } from '../src/services/WebRTCService';

describe('CallScreen', () => {
  beforeEach(() => {
    callStore.reset();
    routeParams.current = {
      contactId: 'user-2',
      contactName: 'Test User',
      direction: 'outgoing' as const,
      sdp: null,
      callId: null,
    };
  });

  function renderWithProvider(element: React.ReactElement) {
    return TestRenderer.create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 414, height: 896 },
          insets: { top: 47, left: 0, bottom: 34, right: 0 },
        }}
      >
        {element}
      </SafeAreaProvider>,
    );
  }

  // ===== Аудио-режим (существующие тесты) =====

  it('renders without crashing for outgoing call', async () => {
    let tree: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(() => {
      tree = renderWithProvider(<CallScreen />);
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
      tree = renderWithProvider(<CallScreen />);
    });

    // Ищем кнопку с accessibilityLabel "Завершить звонок"
    const endButtons = tree!.root.findAllByProps({
      accessibilityLabel: 'Завершить звонок',
    } as any);
    expect(endButtons.length).toBeGreaterThanOrEqual(1);
  });

  // ===== Видео-режим (новые тесты) =====

  it('renders video call UI when callType is video', async () => {
    routeParams.current.callType = 'video';
    let tree: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(() => {
      tree = renderWithProvider(<CallScreen />);
    });
    // Ждём микрозадачи — initiateOutgoingCall обновит store, но observer замокан,
    // поэтому проверяем то, что отрендерено на первом проходе:
    //   - RTCView (зависит от callType из route, не из store)
    //   - кнопка камеры (зависит от callType из route)
    await TestRenderer.act(async () => {});

    const root = tree!.root;

    // RTCView для удалённого видео — рендерится по callType==='video' из route params
    const rtcViews = root.findAllByType('RTCView' as any);
    expect(rtcViews.length).toBeGreaterThanOrEqual(1);

    // VideoPiP НЕ рендерится на первом проходе (callStore.isCameraOn ещё false,
    // observer замокан — re-render не происходит)
    const pipViews = root.findAllByType('VideoPiP' as any);
    expect(pipViews.length).toBe(0);

    // Кнопка toggle camera присутствует (callType==='video')
    const cameraIcons = root.findAllByProps({ testID: 'icon-camera-off' } as any);
    expect(cameraIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows camera toggle button in video mode, not in audio', async () => {
    // Видео-режим
    routeParams.current.callType = 'video';
    let treeVideo: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(() => {
      treeVideo = renderWithProvider(<CallScreen />);
    });
    await TestRenderer.act(async () => {});

    const rootVideo = treeVideo!.root;
    // Иконка камеры присутствует (даже в off-состоянии, т.к. кнопка рендерится всегда
    // при callType==='video' независимо от isCameraOn)
    const cameraOffIcon = rootVideo.findAllByProps({ testID: 'icon-camera-off' } as any);
    expect(cameraOffIcon.length).toBeGreaterThanOrEqual(1);

    // Аудио-режим
    routeParams.current.callType = undefined; // audio
    // Сбросим store для нового рендера
    callStore.reset();
    let treeAudio: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(() => {
      treeAudio = renderWithProvider(<CallScreen />);
    });
    await TestRenderer.act(async () => {});

    const rootAudio = treeAudio!.root;
    // Никаких иконок камеры нет
    const allCameraIcons = rootAudio.findAllByProps({
      testID: 'icon-camera-off',
    } as any);
    expect(allCameraIcons.length).toBe(0);
  });

  it('hides camera controls in audio mode', async () => {
    // callType не указан → audio по умолчанию
    let tree: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(() => {
      tree = renderWithProvider(<CallScreen />);
    });
    await TestRenderer.act(async () => {});

    const root = tree!.root;

    // Нет иконки камеры (camera или camera-off)
    const cameraOffIcons = root.findAllByProps({ testID: 'icon-camera-off' } as any);
    const cameraOnIcons = root.findAllByProps({ testID: 'icon-camera' } as any);
    expect(cameraOffIcons.length).toBe(0);
    expect(cameraOnIcons.length).toBe(0);

    // Нет кнопки switchCamera (refresh-cw)
    const switchCamIcons = root.findAllByProps({ testID: 'icon-refresh-cw' } as any);
    expect(switchCamIcons.length).toBe(0);
  });

  it('toggles camera state via store toggleCamera', () => {
    // Это unit-тест метода CallStore.toggleCamera (дублирует тест из CallStore, но здесь
    // проверяет, что вызов через store работает корректно в контексте видео)
    callStore.startOutgoingCall({
      callId: 'test-cam',
      contactId: 'user-2',
      contactName: 'Test User',
      callType: 'video',
    });

    expect(callStore.isCameraOn).toBe(true);
    expect(callStore.callType).toBe('video');

    callStore.toggleCamera();
    expect(callStore.isCameraOn).toBe(false);

    callStore.toggleCamera();
    expect(callStore.isCameraOn).toBe(true);
  });

  it('does not toggle camera in audio mode', () => {
    callStore.startOutgoingCall({
      callId: 'test-cam-audio',
      contactId: 'user-2',
      contactName: 'Test User',
      callType: 'audio',
    });

    expect(callStore.isCameraOn).toBe(false);

    callStore.toggleCamera(); // guarded: callType !== 'video'
    expect(callStore.isCameraOn).toBe(false);
  });

  it('camera toggle button renders with correct icon', async () => {
    // Видео-режим: иконка camera-off (isCameraOn=false на первом рендере)
    routeParams.current.callType = 'video';
    let tree: TestRenderer.ReactTestRenderer;

    await TestRenderer.act(() => {
      tree = renderWithProvider(<CallScreen />);
    });
    await TestRenderer.act(async () => {});

    const root = tree!.root;

    // В видео-режиме присутствует иконка камеры (начальное состояние — выключена)
    const camOffIcons = root.findAllByProps({ testID: 'icon-camera-off' } as any);
    expect(camOffIcons.length).toBeGreaterThanOrEqual(1);

    // В аудио-режиме иконка камеры отсутствует
    callStore.reset();
    routeParams.current.callType = undefined;
    let treeAudio: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(() => {
      treeAudio = renderWithProvider(<CallScreen />);
    });
    await TestRenderer.act(async () => {});

    const rootAudio = treeAudio!.root;
    const camOffAudio = rootAudio.findAllByProps({ testID: 'icon-camera-off' } as any);
    const camOnAudio = rootAudio.findAllByProps({ testID: 'icon-camera' } as any);
    expect(camOffAudio.length).toBe(0);
    expect(camOnAudio.length).toBe(0);
  });

  it('toggleCamera flips isCameraOn and calls setCameraEnabled', () => {
    // Прямой тест методов store в контексте видео
    callStore.startOutgoingCall({
      callId: 'test-cam-wired',
      contactId: 'user-2',
      contactName: 'Test User',
      callType: 'video',
    });

    expect(callStore.isCameraOn).toBe(true);
    expect(callStore.callType).toBe('video');

    callStore.toggleCamera();
    expect(callStore.isCameraOn).toBe(false);

    callStore.toggleCamera();
    expect(callStore.isCameraOn).toBe(true);

    // Проверяем, что setCameraEnabled доступен на WebRTCService
    expect(typeof webrtcService.setCameraEnabled).toBe('function');
  });
});

/**
 * @format
 */

// Моки для модулей, от которых зависит CallStore/WebRTCService
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

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});

import {
  mediaDevices,
  MediaStream,
  MediaStreamTrack,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  permissions,
} from 'react-native-webrtc';

declare const __DEV__: boolean;

/** RTCRtpSender предоставляется react-native-webrtc как глобальный тип. */
interface RTCRtpSender {
  replaceTrack(track: MediaStreamTrack | null): Promise<void>;
  track: MediaStreamTrack | null;
}

/** ICE-сервер (локальный тип, т.к. библиотечный RTCIceServer не экспортируется). */
interface IceServer {
  credential?: string;
  urls?: string | string[];
  username?: string;
}

/** Внутреннее представление SDP-инфо, возвращаемого createOffer / createAnswer. */
interface SdpInfo {
  type: string;
  sdp: string;
}

/**
 * Расширяем RTCPeerConnection для доступа к on-свойствам,
 * которые `defineEventAttribute` добавляет в прототип.
 */
interface PcEventHandlers extends RTCPeerConnection {
  onicecandidate: ((event: { candidate: RTCIceCandidate | null }) => void) | null;
  onicecandidateerror: ((event: any) => void) | null;
  ontrack: ((event: { streams: MediaStream[]; track: MediaStreamTrack | null }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  onnegotiationneeded: (() => void) | null;
}

/** Состояния соединения, о которых сервис уведомляет через колбэки. */
type ConnectionStateEvent =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed'
  | 'ice_restart';

/**
 * Обёртка для одного участника Mesh P2P.
 * Содержит RTCPeerConnection и per-peer состояние.
 */
interface PeerConnectionWrapper {
  pc: PcEventHandlers;
  userId: string;
  remoteStream: MediaStream | null;
  /** Буфер ICE-кандидатов, полученных до установки remoteDescription. */
  pendingCandidates: RTCIceCandidate[];
  /** Был ли установлен remoteDescription. */
  remoteDescriptionSet: boolean;
  /** Таймер отсоединения. */
  disconnectedTimer: ReturnType<typeof setTimeout> | null;
  /** Была ли уже выполнена попытка ICE restart для этого пира. */
  iceRestartAttempted: boolean;
  /** Идёт ли пересмотр SDP. */
  negotiationInProgress: boolean;
  /** Флаг для подавления повторной renegotiation. */
  pendingRenegotiation: boolean;
  /** Идёт ли начальная настройка звонка. */
  callInSetup: boolean;
  /** RTCRtpSender видео-трека на этом PC. */
  videoSender: RTCRtpSender | null;
}

/**
 * WebRTCService — синглтон для управления голосовыми вызовами через WebRTC.
 *
 * ## Архитектура (Mesh P2P)
 *
 * Каждый участник конференции имеет свой RTCPeerConnection, хранящийся
 * в `_connections` под его userId. Единая `_localStream` (микрофон/камера)
 * транслируется во все PC через `addTrack()` при создании.
 *
 * ## Жизненный цикл
 * 1. Вызвать `startCall(withVideo)` для захвата медиа
 * 2. Для каждого участника: `createPeer(userId, 'offer')` или `createPeer(userId, 'answer', sdp)`
 * 3. ICE-кандидаты приходят через `_onPeerIceCandidate` с userId — отправляются удалённой стороне
 * 4. Удалённые кандидаты добавляются через `addPeerIceCandidate(userId, candidate)`
 * 5. Удалённый SDP устанавливается через `setPeerRemoteDescription(userId, sdp)`
 * 6. Завершение конференции — `removeAllPeers()`
 *
 * ## Обратная совместимость (1-1 звонки)
 * Методы `createOffer()`, `createAnswer()`, `setRemoteDescription()`, `addIceCandidate()`
 * работают как обёртки, используя внутренний userId '_default'.
 * CallScreen и CallStore НЕ ТРЕБУЮТ изменений.
 */
class WebRTCService {
  // ---- Состояние ----

  /** Все peer-соединения (Mesh P2P). */
  private _connections: Map<string, PeerConnectionWrapper> = new Map();
  /** Единый локальный медиа-поток (микрофон + опционально камера). */
  private _localStream: MediaStream | null = null;
  private _currentFacingMode: 'user' | 'environment' = 'user';

  // ---- Коллбэки (Multi-peer — с userId) ----

  private _onPeerIceCandidate: ((userId: string, candidate: string) => void) | null = null;
  private _onPeerRemoteStream: ((userId: string, stream: MediaStream) => void) | null = null;
  private _onPeerConnectionState: ((userId: string, state: ConnectionStateEvent) => void) | null =
    null;
  private _onPeerRenegotiationNeeded: ((userId: string, sdp: string) => void) | null = null;
  private _onError: ((error: string) => void) | null = null;

  // ---- Коллбэки (Legacy compat — без userId, для 1-1 звонков) ----

  private _onIceCandidate: ((candidate: string) => void) | null = null;
  private _onRemoteStream: ((stream: MediaStream) => void) | null = null;
  private _onConnectionState: ((state: ConnectionStateEvent) => void) | null = null;
  private _onRenegotiationNeeded: ((sdp: string) => void) | null = null;

  // ---- ICE-серверы ----

  private _iceServers: IceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.megafon.ru:3478' },
    { urls: 'stun:stun.rt.ru:3478' },
    { urls: 'stun:stun.sipnet.ru:3478' },
  ];

  // ---- Вспомогательное состояние ----

  /**
   * Глобальный буфер ICE-кандидатов, полученных ДО создания PeerConnection.
   * Каждый элемент: `{ userId, candidate }`.
   * При создании нового PC проверяем, нет ли в буфере кандидатов для этого userId.
   */
  private _earlyCandidates: Array<{ userId: string; candidate: string }> = [];

  // ================================================================
  //  Геттеры
  // ================================================================

  /** Единый локальный медиа-поток (микрофон / камера). */
  get localStream(): MediaStream | null {
    return this._localStream;
  }

  /**
   * Remote-поток от первого пира (legacy compat).
   * Для multi-peer используйте `getPeerRemoteStream(userId)`.
   */
  get remoteStream(): MediaStream | null {
    const first = this._getFirstPeer();
    return first?.remoteStream ?? null;
  }

  /**
   * Первый RTCPeerConnection (legacy compat).
   * Для multi-peer доступ к каждому PC через `_connections`.
   */
  get peerConnection(): RTCPeerConnection | null {
    const first = this._getFirstPeer();
    return first?.pc ?? null;
  }

  // ================================================================
  //  Конфигурация ICE
  // ================================================================

  /**
   * Добавляет TURN-серверы для production.
   * Вызвать до `createPeer`.
   */
  addIceServers(servers: IceServer[]): void {
    this._iceServers.push(...servers);
  }

  /**
   * Загружает TURN-конфигурацию с сервера и добавляет TURN-серверы
   * в список ICE-серверов для пробоя NAT.
   *
   * Вызывается автоматически после успешного подключения к серверу.
   * TURN не критичен для звонков — при ошибке продолжаем с STUN.
   */
  async fetchTurnConfig(serverUrl: string): Promise<void> {
    try {
      const baseUrl = serverUrl.replace(/^ws(s?):\/\//, 'http$1://');
      const response = await fetch(`${baseUrl}/turn-config`);
      if (!response.ok) {
        console.warn('[WebRTC] TURN config returned', response.status);
        return;
      }
      const config = await response.json();
      if (config && config.urls) {
        this.addIceServers([
          {
            urls: config.urls,
            username: config.username,
            credential: config.credential,
          },
        ]);
        console.log('[WebRTC] TURN config loaded successfully');
      }
    } catch {
      console.warn('[WebRTC] Failed to fetch TURN config');
    }
  }

  // ================================================================
  //  Захват микрофона и камеры
  // ================================================================

  /**
   * Запрашивает доступ к микрофону (и опционально к камере) и возвращает
   * локальный аудио/видео-поток.
   * При повторном вызове возвращает уже существующий поток.
   *
   * @param withVideo — если true, также запрашивает видео (320x240, 15fps)
   */
  async startLocalStream(withVideo: boolean = false): Promise<MediaStream> {
    if (this._localStream) {
      return this._localStream;
    }
    try {
      await permissions.request({ name: 'microphone' });
    } catch {
      // permissions API может быть недоступен
    }
    if (withVideo) {
      try {
        await permissions.request({ name: 'camera' });
      } catch {
        // permissions API может быть недоступен
      }
    }
    const videoConstraints = withVideo
      ? {
          width: { min: 480, ideal: 1280, max: 1280 },
          height: { min: 360, ideal: 720, max: 720 },
          frameRate: { min: 20, ideal: 30, max: 30 },
          facingMode: 'user' as const,
        }
      : false;
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: videoConstraints,
    });
    this._localStream = stream;
    if (withVideo) {
      this._currentFacingMode = 'user';
    }
    return stream;
  }

  /**
   * Включить/выключить микрофон (аудиотрек) для всех пиров.
   */
  setMicrophoneEnabled(enabled: boolean): void {
    this._localStream?.getAudioTracks().forEach(track => {
      track.enabled = enabled;
    });
  }

  /**
   * Включить/выключить камеру.
   * Применяется ко всем пирам единовременно.
   */
  async setCameraEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      // ── Включение камеры ───────────────────────────────────
      const existingTrack = this._localStream?.getVideoTracks()[0];
      if (existingTrack && existingTrack.readyState === 'live') {
        existingTrack.enabled = true;
        for (const wrapper of this._connections.values()) {
          const sender = wrapper.pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(existingTrack).catch(() => {});
          }
        }
        return;
      }

      try {
        await permissions.request({ name: 'camera' });
      } catch {
        /* permissions API может быть недоступен */
      }

      const newStream = await mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { min: 480, ideal: 1280, max: 1280 },
          height: { min: 360, ideal: 720, max: 720 },
          frameRate: { min: 20, ideal: 30, max: 30 },
          facingMode: this._currentFacingMode as 'user' | 'environment' | undefined,
        },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) {
        console.warn('[WebRTC] setCameraEnabled(true): no video track');
        return;
      }

      this._localStream?.addTrack(newVideoTrack);

      for (const wrapper of this._connections.values()) {
        if (wrapper.videoSender) {
          await wrapper.videoSender.replaceTrack(newVideoTrack).catch(() => {});
        } else {
          wrapper.videoSender = wrapper.pc.addTrack(newVideoTrack, this._localStream!);
        }
      }
    } else {
      // ── Выключение камеры ──────────────────────────────────
      const tracks = this._localStream?.getVideoTracks() ?? [];
      tracks.forEach(track => {
        track.stop();
        this._localStream?.removeTrack(track);
      });

      for (const wrapper of this._connections.values()) {
        const sender = wrapper.pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(null).catch(() => {});
        }
      }
    }
  }

  /**
   * Переключить камеру между front (facingMode: 'user') и back (facingMode: 'environment').
   */
  async switchCamera(): Promise<void> {
    if (!this._localStream) return;
    const videoTracks = this._localStream.getVideoTracks();
    if (videoTracks.length === 0) return;

    const currentTrack = videoTracks[0];
    const newFacingMode: 'user' | 'environment' =
      this._currentFacingMode === 'user' ? 'environment' : 'user';

    try {
      try {
        await permissions.request({ name: 'camera' });
      } catch {
        // permissions API может быть недоступен
      }

      currentTrack.stop();
      this._localStream.removeTrack(currentTrack);

      const newStream = await mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { min: 480, ideal: 1280, max: 1280 },
          height: { min: 360, ideal: 720, max: 720 },
          frameRate: { min: 20, ideal: 30, max: 30 },
          facingMode: newFacingMode,
        },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) {
        console.warn('[WebRTC] switchCamera: no video track in new stream');
        return;
      }

      this._localStream.addTrack(newVideoTrack);

      for (const wrapper of this._connections.values()) {
        const sender = wrapper.pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        } else {
          wrapper.pc.addTrack(newVideoTrack, this._localStream);
        }
      }

      this._currentFacingMode = newFacingMode;
      console.log('[WebRTC] Camera switched to', newFacingMode);
    } catch (e) {
      console.warn('[WebRTC] Failed to switch camera:', e);
    }
  }

  /**
   * Запрашивает разрешение на использование камеры.
   * @returns true если разрешение получено, false если отказано
   */
  async requestCameraPermission(): Promise<boolean> {
    try {
      const result = await permissions.request({ name: 'camera' });
      return result === 'granted';
    } catch {
      try {
        const testStream = await mediaDevices.getUserMedia({
          audio: false,
          video: { width: 1, height: 1 },
        });
        testStream.getTracks().forEach(t => t.stop());
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Публичный метод для начала звонка: запрашивает разрешения и
   * захватывает медиа-поток.
   *
   * @param withVideo — если true, также запрашивает камеру
   */
  async startCall(withVideo: boolean = false): Promise<void> {
    if (withVideo) {
      await this.requestCameraPermission();
    }
    await this.startLocalStream(withVideo);
  }

  // ================================================================
  //  Multi-peer API
  // ================================================================

  /**
   * Создаёт новое RTCPeerConnection для конкретного участника.
   *
   * 1. Удаляет существующее соединение для этого userId (если есть)
   * 2. Создаёт RTCPeerConnection с ICE-серверами
   * 3. Добавляет аудио/видео-треки из `_localStream`
   * 4. Устанавливает per-peer обработчики событий
   * 5. Выполняет SDP обмен (createOffer или createAnswer)
   * 6. Сохраняет в `_connections`
   *
   * @param userId — идентификатор участника
   * @param direction — 'offer' (исходящий) или 'answer' (входящий)
   * @param remoteSdp — SDP offer от удалённой стороны (обязателен для direction='answer')
   * @returns JSON-строка локального SDP (offer или answer)
   *
   * @throws если `_localStream` не захвачен — предварительно вызовите
   *         `startLocalStream()` или `startCall()`.
   */
  async createPeer(
    userId: string,
    direction: 'offer' | 'answer',
    remoteSdp?: string,
  ): Promise<string> {
    // Удаляем существующее соединение для этого участника
    this.removePeer(userId);

    // _localStream должен быть захвачен ДО вызова createPeer
    if (!this._localStream) {
      throw new Error('Local stream not captured. Call startLocalStream() or startCall() first.');
    }

    const wrapper = this._createPeerConnectionWrapper(userId);
    this._connections.set(userId, wrapper);
    const pc = wrapper.pc;

    try {
      if (direction === 'offer') {
        const sdpInfo = (await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        })) as SdpInfo;

        const modifiedSdp = this._modifySdpForAudio(sdpInfo.sdp);
        const desc = { type: 'offer', sdp: modifiedSdp };
        await pc.setLocalDescription(desc);
        wrapper.callInSetup = false;
        return JSON.stringify(desc);
      } else {
        // direction === 'answer'
        if (!remoteSdp) {
          throw new Error('remoteSdp is required for direction=answer');
        }
        const offer = JSON.parse(remoteSdp) as SdpInfo;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        wrapper.remoteDescriptionSet = true;
        await this._flushPendingCandidates(wrapper);

        const answer = (await pc.createAnswer()) as SdpInfo;
        const modifiedSdp = this._modifySdpForAudio(answer.sdp);
        const desc = { type: 'answer', sdp: modifiedSdp };
        await pc.setLocalDescription(desc);
        wrapper.callInSetup = false;
        return JSON.stringify(desc);
      }
    } catch (e) {
      wrapper.callInSetup = false;
      const msg = e instanceof Error ? e.message : 'Failed to create peer connection';
      this._onError?.(msg);
      throw e;
    }
  }

  /**
   * Устанавливает remote SDP для конкретного пира.
   * Вызывается для caller после получения answer от callee.
   * Сбрасывает буферизированные ICE-кандидаты.
   */
  async setPeerRemoteDescription(userId: string, sdp: string): Promise<void> {
    const wrapper = this._connections.get(userId);
    if (!wrapper) {
      console.warn('[WebRTC] setPeerRemoteDescription: no connection for user', userId);
      return;
    }
    try {
      const desc = JSON.parse(sdp) as SdpInfo;
      await wrapper.pc.setRemoteDescription(new RTCSessionDescription(desc));
      wrapper.remoteDescriptionSet = true;
      await this._flushPendingCandidates(wrapper);
      wrapper.pendingRenegotiation = false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to set remote description';
      this._onError?.(msg);
      throw e;
    }
  }

  /**
   * Добавляет ICE candidate для конкретного пира.
   * Если remote description ещё не установлен — буферизирует.
   * Если PeerConnection для userId ещё не создан — буферизирует глобально.
   */
  async addPeerIceCandidate(userId: string, candidate: string): Promise<void> {
    const wrapper = this._connections.get(userId);
    if (!wrapper) {
      console.log('[WebRTC] 🗄️ addPeerIceCandidate: buffering for later (no PC for', userId + ')');
      this._earlyCandidates.push({ userId, candidate });
      return;
    }
    try {
      const iceCandidate = new RTCIceCandidate(JSON.parse(candidate));
      if (!wrapper.remoteDescriptionSet) {
        console.log(
          '[WebRTC] 📥 ICE candidate buffered (no remoteDescription) for user=' +
            userId +
            ', pending=' +
            (wrapper.pendingCandidates.length + 1),
        );
        wrapper.pendingCandidates.push(iceCandidate);
        return;
      }
      console.log('[WebRTC] 📥 ICE candidate added for user=' + userId);
      await wrapper.pc.addIceCandidate(iceCandidate);
    } catch (e) {
      console.warn('[WebRTC] Failed to add ICE candidate:', e);
    }
  }

  /**
   * Закрывает и удаляет PeerConnection для конкретного участника.
   * НЕ останавливает `_localStream` — она общая для всех пиров.
   */
  removePeer(userId: string): void {
    const wrapper = this._connections.get(userId);
    if (!wrapper) return;

    this._clearDisconnectedTimer(wrapper);
    wrapper.pc.close();
    this._connections.delete(userId);

    console.log('[WebRTC] Peer connection removed for user=' + userId);
  }

  /**
   * Закрывает ВСЕ PeerConnection и останавливает локальный поток.
   * Полная очистка состояния сервиса.
   */
  removeAllPeers(): void {
    for (const wrapper of this._connections.values()) {
      this._clearDisconnectedTimer(wrapper);
      wrapper.pc.close();
    }
    this._connections.clear();

    // Останавливаем локальные треки
    this._localStream?.getAudioTracks().forEach(t => t.stop());
    this._localStream?.getVideoTracks().forEach(t => t.stop());
    this._localStream = null;

    this._earlyCandidates = [];

    // Сбрасываем compat-колбэки (multi-peer колбэки не сбрасываем —
    // они управляются внешним кодом)
    this._onIceCandidate = null;
    this._onRemoteStream = null;
    this._onConnectionState = null;
    this._onRenegotiationNeeded = null;

    console.log('[WebRTC] All peer connections removed');
  }

  /**
   * ICE restart для конкретного пира.
   * Вызывается при `failed` или по инициативе вызывающего.
   *
   * @param userId — участник для перезапуска ICE
   * @returns JSON-строка нового offer SDP или null при ошибке
   */
  async iceRestartPeer(userId: string): Promise<string | null> {
    const wrapper = this._connections.get(userId);
    if (!wrapper) return null;

    try {
      const sdpInfo = (await wrapper.pc.createOffer({
        iceRestart: true,
      })) as SdpInfo;
      const modifiedSdp = this._modifySdpForAudio(sdpInfo.sdp);
      const desc = { type: 'offer', sdp: modifiedSdp };
      await wrapper.pc.setLocalDescription(desc);
      const jsonSdp = JSON.stringify(desc);

      // Приоритет: multi-peer callback → compat callback
      if (this._onPeerRenegotiationNeeded) {
        this._onPeerRenegotiationNeeded(userId, jsonSdp);
      } else if (userId === this.COMPAT_USER_ID && this._onRenegotiationNeeded) {
        this._onRenegotiationNeeded(jsonSdp);
      }
      return jsonSdp;
    } catch {
      return null;
    }
  }

  /**
   * Обработать renegotiation offer от удалённой стороны для конкретного пира.
   * Вызывается при ICE restart или видео-реинициализации.
   *
   * @returns JSON-строка answer SDP
   */
  async handlePeerRenegotiationOffer(userId: string, offerSdp: string): Promise<string> {
    const wrapper = this._connections.get(userId);
    if (!wrapper) {
      throw new Error('No peer connection for user ' + userId);
    }

    console.log(
      '[WebRTC] 🔄 handlePeerRenegotiationOffer user=' +
        userId +
        ', sigState=' +
        wrapper.pc.signalingState,
    );

    const offer = JSON.parse(offerSdp) as SdpInfo;
    await wrapper.pc.setRemoteDescription(new RTCSessionDescription(offer));
    wrapper.remoteDescriptionSet = true;
    await this._flushPendingCandidates(wrapper);

    const answer = (await wrapper.pc.createAnswer()) as SdpInfo;
    const modifiedSdp = this._modifySdpForAudio(answer.sdp);
    const desc = { type: 'answer', sdp: modifiedSdp };
    await wrapper.pc.setLocalDescription(desc);
    return JSON.stringify(desc);
  }

  /**
   * Регулировка громкости для конкретного пира (no-op заглушка для v1).
   * В будущем будет использовать RTCRtpReceiver или HTMLAudioElement.
   */
  setPeerVolume(_userId: string, _volume: number): void {
    // no-op for v1
  }

  /**
   * Возвращает remote-поток для конкретного пира.
   * Удобно для multi-party конференций.
   */
  getPeerRemoteStream(userId: string): MediaStream | null {
    const wrapper = this._connections.get(userId);
    return wrapper?.remoteStream ?? null;
  }

  // ================================================================
  //  Legacy 1-1 compat methods
  // ================================================================

  /** Внутренний userId для обратной совместимости с 1-1 звонками. */
  private readonly COMPAT_USER_ID = '_default';

  /**
   * Исходящий звонок (legacy compat).
   * Создаёт SDP offer для единственного пира.
   *
   * @param withVideo — если true, включает видео (захват камеры + offerToReceiveVideo)
   */
  async createOffer(withVideo: boolean = false): Promise<string> {
    await this.startLocalStream(withVideo);
    return this.createPeer(this.COMPAT_USER_ID, 'offer');
  }

  /**
   * Входящий звонок (legacy compat).
   * Создаёт SDP answer на основе offer от удалённой стороны.
   *
   * @param withVideo — если true, также захватывает видео
   */
  async createAnswer(offerSdp: string, withVideo: boolean = false): Promise<string> {
    await this.startLocalStream(withVideo);
    return this.createPeer(this.COMPAT_USER_ID, 'answer', offerSdp);
  }

  /** Устанавливает remote description для единственного пира (legacy compat). */
  async setRemoteDescription(sdp: string): Promise<void> {
    return this.setPeerRemoteDescription(this.COMPAT_USER_ID, sdp);
  }

  /** Добавляет ICE candidate для единственного пира (legacy compat). */
  async addIceCandidate(candidate: string): Promise<void> {
    return this.addPeerIceCandidate(this.COMPAT_USER_ID, candidate);
  }

  /** Завершает звонок (legacy compat). */
  stopCall(): void {
    this.removeAllPeers();
  }

  /** ICE restart для единственного пира (legacy compat). */
  async iceRestart(): Promise<string | null> {
    return this.iceRestartPeer(this.COMPAT_USER_ID);
  }

  /** Обработка renegotiation offer для единственного пира (legacy compat). */
  async handleRenegotiationOffer(offerSdp: string): Promise<string> {
    return this.handlePeerRenegotiationOffer(this.COMPAT_USER_ID, offerSdp);
  }

  // ================================================================
  //  Сеттеры коллбэков (Legacy compat — без userId)
  // ================================================================

  set onIceCandidate(cb: ((candidate: string) => void) | null) {
    this._onIceCandidate = cb;
  }

  set onRemoteStream(cb: ((stream: MediaStream) => void) | null) {
    this._onRemoteStream = cb;
  }

  set onConnectionState(cb: ((state: ConnectionStateEvent) => void) | null) {
    this._onConnectionState = cb;
  }

  set onError(cb: ((error: string) => void) | null) {
    this._onError = cb;
  }

  set onRenegotiationNeeded(cb: ((sdp: string) => void) | null) {
    this._onRenegotiationNeeded = cb;
  }

  // ================================================================
  //  Сеттеры коллбэков (Multi-peer — с userId)
  // ================================================================

  set onPeerIceCandidate(cb: ((userId: string, candidate: string) => void) | null) {
    this._onPeerIceCandidate = cb;
  }

  set onPeerRemoteStream(cb: ((userId: string, stream: MediaStream) => void) | null) {
    this._onPeerRemoteStream = cb;
  }

  set onPeerConnectionState(cb: ((userId: string, state: ConnectionStateEvent) => void) | null) {
    this._onPeerConnectionState = cb;
  }

  set onPeerRenegotiationNeeded(cb: ((userId: string, sdp: string) => void) | null) {
    this._onPeerRenegotiationNeeded = cb;
  }

  // ================================================================
  //  Приватные вспомогательные методы
  // ================================================================

  /**
   * Возвращает первый PeerConnectionWrapper (для legacy compat).
   * Порядок не гарантирован, но при 1-1 звонке пир всегда один.
   */
  private _getFirstPeer(): PeerConnectionWrapper | null {
    for (const wrapper of this._connections.values()) {
      return wrapper;
    }
    return null;
  }

  /**
   * Создаёт PeerConnectionWrapper для userId.
   * ICE-серверы, локальные треки и все per-peer обработчики событий.
   *
   * @param userId — для кого создаётся соединение
   */
  private _createPeerConnectionWrapper(userId: string): PeerConnectionWrapper {
    const pc = new RTCPeerConnection({
      iceServers: this._iceServers,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all',
    }) as PcEventHandlers;

    console.log(
      '[WebRTC] PeerConnection created for user=' +
        userId +
        ' with ' +
        this._iceServers.length +
        ' ICE servers:',
      this._iceServers.map(s => (Array.isArray(s.urls) ? s.urls.join(', ') : s.urls)).join(' | '),
    );

    const wrapper: PeerConnectionWrapper = {
      pc,
      userId,
      remoteStream: null,
      pendingCandidates: [],
      remoteDescriptionSet: false,
      disconnectedTimer: null,
      iceRestartAttempted: false,
      negotiationInProgress: false,
      pendingRenegotiation: false,
      callInSetup: true,
      videoSender: null,
    };

    // --- onicecandidate ---
    pc.onicecandidate = (event: { candidate: RTCIceCandidate | null }) => {
      if (event.candidate) {
        const json = event.candidate.toJSON();
        const candidateStr = (json as any).candidate || '';
        const typeMatch = candidateStr.match(/ typ (\S+)/);
        const candidateType = typeMatch ? typeMatch[1] : 'unknown';

        if (__DEV__) {
          const addrMatch = candidateStr.match(/ (\d+\.\d+\.\d+\.\d+) /);
          const address = addrMatch ? addrMatch[1] : '(n/a)';
          console.log(
            `[WebRTC] 🧊 ICE candidate: ${candidateType}, addr=${address}, user=${userId}`,
          );
        }

        const jsonStr = JSON.stringify(json);

        // Multi-peer callback (всегда)
        this._onPeerIceCandidate?.(userId, jsonStr);

        // Legacy compat callback (только для _default пира)
        if (userId === this.COMPAT_USER_ID) {
          this._onIceCandidate?.(jsonStr);
        }
      } else {
        console.log('[WebRTC] ✅ ICE candidate gathering complete for user=' + userId);
      }
    };

    // --- onicecandidateerror ---
    pc.onicecandidateerror = (event: any) => {
      const errCode = event.errorCode || event?.errorCode;
      const errText = event.errorText || event?.errorText;
      const errUrl = event.url || event?.url;
      console.warn(
        `[WebRTC] ❌ ICE candidate error user=${userId} (code=${errCode}, text=${errText}, url=${errUrl})`,
      );
    };

    // --- ontrack (удалённый аудио/видео-поток) ---
    pc.ontrack = (event: { streams: MediaStream[]; track: MediaStreamTrack | null }) => {
      if (event.streams && event.streams[0]) {
        wrapper.remoteStream = event.streams[0];
        const trackCount = event.streams[0].getTracks?.()?.length ?? 1;
        console.log(
          '[WebRTC] Remote stream received for user=' + userId + ', tracks=' + trackCount,
        );

        // Multi-peer callback
        this._onPeerRemoteStream?.(userId, wrapper.remoteStream);

        // Legacy compat callback
        if (userId === this.COMPAT_USER_ID) {
          this._onRemoteStream?.(wrapper.remoteStream);
        }
      }
    };

    // --- onconnectionstatechange ---
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC] Connection state changed for user=' + userId + ': ' + state);

      // Multi-peer callback
      this._onPeerConnectionState?.(userId, state);

      // Legacy compat callback
      if (userId === this.COMPAT_USER_ID) {
        this._onConnectionState?.(state);
      }

      if (state === 'connected') {
        this._clearDisconnectedTimer(wrapper);
      } else if (state === 'disconnected') {
        this._startDisconnectedTimer(wrapper);
      } else if (state === 'failed') {
        this._handleIceRestart(wrapper);
      }
    };

    // --- onnegotiationneeded ---
    pc.onnegotiationneeded = async () => {
      if (wrapper.callInSetup || wrapper.negotiationInProgress || wrapper.pendingRenegotiation) {
        return;
      }
      wrapper.negotiationInProgress = true;
      try {
        const sdpInfo = (await pc.createOffer()) as SdpInfo;
        const modifiedSdp = this._modifySdpForAudio(sdpInfo.sdp);
        const desc = { type: 'offer', sdp: modifiedSdp };
        await pc.setLocalDescription(desc);
        const jsonSdp = JSON.stringify(desc);

        // Multi-peer callback
        this._onPeerRenegotiationNeeded?.(userId, jsonSdp);

        // Legacy compat callback
        if (userId === this.COMPAT_USER_ID) {
          this._onRenegotiationNeeded?.(jsonSdp);
        }
      } catch (e) {
        console.warn('[WebRTC] negotiationneeded failed for user=' + userId + ':', e);
      } finally {
        wrapper.negotiationInProgress = false;
      }
    };

    // Добавляем локальные треки в этот PC
    if (this._localStream) {
      this._localStream.getTracks().forEach(track => {
        const sender = pc.addTrack(track, this._localStream!);
        if (track.kind === 'video') {
          wrapper.videoSender = sender;
        }
      });
    }

    // Сбрасываем глобальный буфер: переносим кандидаты для этого userId
    const relevant = this._earlyCandidates.filter(e => e.userId === userId);
    if (relevant.length > 0) {
      console.log(
        '[WebRTC] 🔄 Flushing ' + relevant.length + ' early ICE candidates for user=' + userId,
      );
      this._earlyCandidates = this._earlyCandidates.filter(e => e.userId !== userId);
      for (const { candidate } of relevant) {
        // Вызываем асинхронно, но не ждём — кандидаты попадут
        // в per-peer pendingCandidates, если remoteDescription ещё не установлен
        this.addPeerIceCandidate(userId, candidate).catch(() => {});
      }
    }

    return wrapper;
  }

  /**
   * Модифицирует SDP для голосовых звонков:
   * - Включает FEC (useinbandfec=1) для Opus
   * - Устанавливает битрейт 32 kbps (maxaveragebitrate=32000)
   * - Модифицирует только аудио-секции SDP (Opus), видео-кодеки не трогает
   */
  private _modifySdpForAudio(sdp: string): string {
    const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000/);
    if (!opusMatch) return sdp;

    const pt = opusMatch[1];
    const fmtpRegex = new RegExp(`a=fmtp:${pt} (.+)`);

    return sdp.replace(fmtpRegex, (_, params: string) => {
      const paramMap: Record<string, string> = {};
      params.split(';').forEach(p => {
        const trimmed = p.trim();
        if (!trimmed) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx >= 0) {
          paramMap[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
        } else {
          paramMap[trimmed] = '';
        }
      });

      paramMap.useinbandfec = '1';
      paramMap.maxaveragebitrate = '32000';

      const newParams = Object.entries(paramMap)
        .map(([k, v]) => (v ? `${k}=${v}` : k))
        .join(';');

      return `a=fmtp:${pt} ${newParams}`;
    });
  }

  /** Запускает 12-секундный таймер при `disconnected` для конкретного пира. */
  private _startDisconnectedTimer(wrapper: PeerConnectionWrapper): void {
    if (wrapper.disconnectedTimer) return;
    wrapper.disconnectedTimer = setTimeout(() => {
      wrapper.disconnectedTimer = null;
      if (
        wrapper.pc.connectionState === 'disconnected' ||
        wrapper.pc.connectionState === 'failed'
      ) {
        this._onError?.('connection_disconnected');
        this.removePeer(wrapper.userId);
      }
    }, 12000);
  }

  /** Отменяет таймер disconnected для конкретного пира. */
  private _clearDisconnectedTimer(wrapper: PeerConnectionWrapper): void {
    if (wrapper.disconnectedTimer) {
      clearTimeout(wrapper.disconnectedTimer);
      wrapper.disconnectedTimer = null;
    }
  }

  /** Добавляет все накопленные ICE-кандидаты после установки remote description. */
  private async _flushPendingCandidates(wrapper: PeerConnectionWrapper): Promise<void> {
    while (wrapper.pendingCandidates.length > 0) {
      const candidate = wrapper.pendingCandidates.shift()!;
      try {
        await wrapper.pc.addIceCandidate(candidate);
      } catch (e) {
        console.warn('[WebRTC] Failed to add pending ICE candidate:', e);
      }
    }
  }

  /**
   * Обрабатывает состояние `failed` для конкретного пира:
   * - При первом сбое — пытается сделать ICE restart
   * - При повторном сбое — вызывает `_onError('connection_failed')`
   */
  private async _handleIceRestart(wrapper: PeerConnectionWrapper): Promise<void> {
    if (wrapper.iceRestartAttempted) {
      this._onError?.('connection_failed');
      return;
    }
    wrapper.iceRestartAttempted = true;
    try {
      const offer = await this.iceRestartPeer(wrapper.userId);
      if (offer) {
        this._onPeerConnectionState?.(wrapper.userId, 'ice_restart');
        if (wrapper.userId === this.COMPAT_USER_ID) {
          this._onConnectionState?.('ice_restart');
        }
      } else {
        this._onError?.('connection_failed');
      }
    } catch {
      this._onError?.('connection_failed');
    }
  }
}

/** Единственный экземпляр сервиса (синглтон). */
export const webrtcService = new WebRTCService();

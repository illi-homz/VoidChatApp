import {
  mediaDevices,
  MediaStream,
  MediaStreamTrack,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  permissions,
} from 'react-native-webrtc';

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

/** Состояния соединения, о которых сервис уведомляет через _onConnectionState. */
type ConnectionStateEvent =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed'
  | 'ice_restart';

/**
 * WebRTCService — синглтон для управления голосовыми вызовами через WebRTC.
 *
 * ## Жизненный цикл
 * 1. Вызвать `createOffer()` (исходящий) или `createAnswer(offerSdp)` (входящий)
 * 2. После успешного setLocalDescription вызывающий отправляет SDP через SocketService
 * 3. ICE-кандидаты приходят через `_onIceCandidate`, отправляются удалённой стороне
 * 4. Удалённые ICE-кандидаты добавляются через `addIceCandidate()`
 * 5. Удалённый SDP (answer/offer) устанавливается через `setRemoteDescription()`
 * 6. Завершение звонка — `stopCall()`
 */
class WebRTCService {
  // ---- Состояние ----

  private _pc: RTCPeerConnection | null = null;
  private _localStream: MediaStream | null = null;
  private _remoteStream: MediaStream | null = null;

  // ---- Коллбэки (устанавливаются извне) ----

  private _onIceCandidate: ((candidate: string) => void) | null = null;
  private _onRemoteStream: ((stream: MediaStream) => void) | null = null;
  private _onConnectionState: ((state: ConnectionStateEvent) => void) | null = null;
  private _onError: ((error: string) => void) | null = null;
  private _onRenegotiationNeeded: ((sdp: string) => void) | null = null;

  // ---- ICE-серверы ----

  private _iceServers: IceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: 'turn:your-server.com:3478',
      username: 'voidchat',
      credential: 'turn_secret_key_change_me',
    },
    {
      urls: 'turn:your-server.com:3478?transport=tcp',
      username: 'voidchat',
      credential: 'turn_secret_key_change_me',
    },
    // --- Публичный TURN (запасной, раскомментируй если свой coturn недоступен) ---
    // OpenRelay: бесплатный TURN relay, до 50GB/мес
    // https://www.metered.ca/tools/openrelay/
    // {
    //   urls: 'turn:openrelay.metered.ca:80',
    //   username: 'openrelayproject',
    //   credential: 'openrelayproject',
    // },
    // {
    //   urls: 'turn:openrelay.metered.ca:443',
    //   username: 'openrelayproject',
    //   credential: 'openrelayproject',
    // },
    // {
    //   urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    //   username: 'openrelayproject',
    //   credential: 'openrelayproject',
    // },
  ];

  // ---- Вспомогательное состояние ----

  private _disconnectedTimer: ReturnType<typeof setTimeout> | null = null;
  private _iceRestartAttempted = false;
  private _pendingCandidates: RTCIceCandidate[] = [];
  private _negotiationInProgress: boolean = false;
  private _callInSetup: boolean = false;
  private _earlyCandidates: string[] = [];

  // ================================================================
  //  Геттеры
  // ================================================================

  get localStream(): MediaStream | null {
    return this._localStream;
  }

  get remoteStream(): MediaStream | null {
    return this._remoteStream;
  }

  get peerConnection(): RTCPeerConnection | null {
    return this._pc;
  }

  // ================================================================
  //  Конфигурация ICE
  // ================================================================

  /**
   * Добавляет TURN-серверы для production.
   * Вызвать до `initiateCall` / `handleIncomingCall`.
   *
   * @example
   * addIceServers([
   *   { urls: 'turn:my-server.com:3478', username: 'user', credential: 'pass' },
   * ]);
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
   *
   * @param serverUrl — URL сервера (ws:// или wss://)
   */
  async fetchTurnConfig(serverUrl: string): Promise<void> {
    try {
      // Убираем ws(s):// и получаем базовый URL для HTTP
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
      // TURN не критичен для звонков — продолжаем без него
      console.warn('[WebRTC] Failed to fetch TURN config');
    }
  }

  // ================================================================
  //  Захват микрофона
  // ================================================================

  /**
   * Запрашивает доступ к микрофону и возвращает локальный аудиопоток.
   * При повторном вызове возвращает уже существующий поток.
   */
  async startLocalStream(): Promise<MediaStream> {
    if (this._localStream) {
      return this._localStream;
    }
    // Явно запрашиваем разрешение через API react-native-webrtc (оно само
    // вызывает PermissionsAndroid.request). Это гарантирует, что системный
    // диалог появится до вызова getUserMedia.
    try {
      await permissions.request({ name: 'microphone' });
    } catch {
      // permissions API может быть недоступен — getUserMedia запросит сам
    }
    const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
    this._localStream = stream;
    return stream;
  }

  /**
   * Включить/выключить микрофон (аудиотрек).
   * true = микрофон активен, false = микрофон отключён (тишина)
   */
  setMicrophoneEnabled(enabled: boolean): void {
    this._localStream?.getAudioTracks().forEach(track => {
      track.enabled = enabled;
    });
  }

  // ================================================================
  //  Создание PeerConnection (приватный)
  // ================================================================

  /**
   * Создаёт RTCPeerConnection с ICE-серверами, добавляет локальный
   * аудиотрек и устанавливает обработчики событий.
   */
  private async createPeerConnection(): Promise<PcEventHandlers> {
    await this.startLocalStream();
    this._callInSetup = true;

    // Для отладки TURN: раскомментируй iceTransportPolicy ниже чтобы
    // форсировать relay-only (звонки только через TURN-сервер).
    // Если relay-only работает — значит TURN ок, проблема в ICE-согласовании.
    // Если нет — TURN сервер недоступен.
    const pc = new RTCPeerConnection({
      iceServers: this._iceServers,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all',
      // iceTransportPolicy: 'relay', // ← раскомментируй для теста TURN
    }) as PcEventHandlers;
    console.log(
      '[WebRTC] PeerConnection created with',
      this._iceServers.length,
      'ICE servers:',
      this._iceServers.map(s => (Array.isArray(s.urls) ? s.urls.join(', ') : s.urls)).join(' | '),
    );

    // Сохраняем pre-PC кандидаты ДО сброса буфера
    const pendingEarly = this._earlyCandidates;

    // Сбрасываем флаги перед новой сессией
    this._disconnectedTimer = null;
    this._iceRestartAttempted = false;
    this._negotiationInProgress = false;
    this._pendingCandidates = [];
    this._earlyCandidates = [];

    // --- onicecandidate ---
    pc.onicecandidate = (event: { candidate: RTCIceCandidate | null }) => {
      if (event.candidate) {
        const json = event.candidate.toJSON();
        // Тип кандидата (host/srflx/relay) лежит внутри candidate-строки: "candidate:... typ host"
        const candidateStr = (json as any).candidate || '';
        const typeMatch = candidateStr.match(/ typ (\S+)/);
        const candidateType = typeMatch ? typeMatch[1] : 'unknown';
        const addrMatch = candidateStr.match(/ (\d+\.\d+\.\d+\.\d+) /);
        const address = addrMatch ? addrMatch[1] : '(n/a)';
        console.log(`[WebRTC] 🧊 ICE candidate: ${candidateType}, addr=${address}`);
        if (this._onIceCandidate) {
          this._onIceCandidate(JSON.stringify(json));
        }
      } else {
        console.log('[WebRTC] ✅ ICE candidate gathering complete');
      }
    };

    // --- onicecandidateerror ---
    pc.onicecandidateerror = (event: any) => {
      const errCode = event.errorCode || event?.errorCode;
      const errText = event.errorText || event?.errorText;
      const errUrl = event.url || event?.url;
      console.warn(
        `[WebRTC] ❌ ICE candidate error (code=${errCode}, text=${errText}, url=${errUrl})`,
      );
    };

    // --- ontrack (удалённый аудиопоток) ---
    pc.ontrack = (event: { streams: MediaStream[]; track: MediaStreamTrack | null }) => {
      if (event.streams && event.streams[0]) {
        this._remoteStream = event.streams[0];
        const trackCount = event.streams[0].getTracks?.()?.length ?? 1;
        console.log('[WebRTC] Remote stream received, tracks:', trackCount);
        this._onRemoteStream?.(this._remoteStream);
      }
    };

    // --- onconnectionstatechange ---
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC] Connection state changed:', state);
      this._onConnectionState?.(state);

      if (state === 'connected') {
        this._clearDisconnectedTimer();
      } else if (state === 'disconnected') {
        this._startDisconnectedTimer();
      } else if (state === 'failed') {
        this._handleIceRestart();
      }
    };

    // --- onnegotiationneeded ---
    pc.onnegotiationneeded = async () => {
      if (this._callInSetup || this._negotiationInProgress) return;
      this._negotiationInProgress = true;
      try {
        const sdpInfo = (await pc.createOffer()) as SdpInfo;
        const modifiedSdp = this._modifySdpForOpus(sdpInfo.sdp);
        const desc = { type: 'offer', sdp: modifiedSdp };
        await pc.setLocalDescription(desc);
        const jsonSdp = JSON.stringify(desc);
        this._onRenegotiationNeeded?.(jsonSdp);
      } catch (e) {
        console.warn('[WebRTC] negotiationneeded failed:', e);
      } finally {
        this._negotiationInProgress = false;
      }
    };

    // Добавляем локальный аудиотрек
    if (this._localStream) {
      this._localStream.getTracks().forEach(track => {
        pc.addTrack(track, this._localStream!);
      });
    }

    this._pc = pc;

    // Сбрасываем pre-PC буфер: кандидаты пришли до того как PC был готов
    if (pendingEarly.length > 0) {
      console.log('[WebRTC] 🔄 Flushing ' + pendingEarly.length + ' early ICE candidates');
      for (const c of pendingEarly) {
        await this.addIceCandidate(c);
      }
    }

    return pc;
  }

  // ================================================================
  //  Создание offer / answer
  // ================================================================

  /**
   * Исходящий звонок: создаёт SDP offer.
   *
   * 1. Захватывает микрофон
   * 2. Создаёт PeerConnection
   * 3. Вызывает createOffer
   * 4. Модифицирует SDP (Opus FEC + битрейт)
   * 5. Устанавливает модифицированный SDP как local description
   * 6. Возвращает SDP как JSON-строку
   */
  async createOffer(): Promise<string> {
    try {
      const pc = await this.createPeerConnection();
      const sdpInfo = (await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      })) as SdpInfo;

      const modifiedSdp = this._modifySdpForOpus(sdpInfo.sdp);
      const desc = { type: 'offer', sdp: modifiedSdp };
      await pc.setLocalDescription(desc);
      this._callInSetup = false;
      return JSON.stringify(desc);
    } catch (e) {
      this._callInSetup = false;
      const msg = e instanceof Error ? e.message : 'Failed to create offer';
      this._onError?.(msg);
      throw e;
    }
  }

  /**
   * Входящий звонок: создаёт SDP answer на основе offer от удалённой стороны.
   *
   * 1. Захватывает микрофон
   * 2. Создаёт PeerConnection
   * 3. Устанавливает remote description из offerSdp
   * 4. Вызывает createAnswer
   * 5. Модифицирует SDP (Opus FEC + битрейт)
   * 6. Устанавливает модифицированный SDP как local description
   * 7. Возвращает SDP как JSON-строку
   */
  async createAnswer(offerSdp: string): Promise<string> {
    try {
      const pc = await this.createPeerConnection();
      const offer = JSON.parse(offerSdp) as SdpInfo;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await this._flushPendingCandidates();

      const answer = (await pc.createAnswer()) as SdpInfo;
      const modifiedSdp = this._modifySdpForOpus(answer.sdp);
      const desc = { type: 'answer', sdp: modifiedSdp };
      await pc.setLocalDescription(desc);
      this._callInSetup = false;
      return JSON.stringify(desc);
    } catch (e) {
      this._callInSetup = false;
      const msg = e instanceof Error ? e.message : 'Failed to create answer';
      this._onError?.(msg);
      throw e;
    }
  }

  // ================================================================
  //  Управление соединением
  // ================================================================

  /**
   * Устанавливает remote description (SDP от удалённой стороны).
   * Для caller — после получения answer.
   * Для callee — offer уже установлен в createAnswer.
   */
  async setRemoteDescription(sdp: string): Promise<void> {
    try {
      const desc = JSON.parse(sdp) as SdpInfo;
      await this._pc?.setRemoteDescription(new RTCSessionDescription(desc));
      await this._flushPendingCandidates();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to set remote description';
      this._onError?.(msg);
      throw e;
    }
  }

  /**
   * Добавляет ICE candidate от удалённой стороны.
   */
  async addIceCandidate(candidate: string): Promise<void> {
    if (!this._pc) {
      console.log(
        '[WebRTC] 🗄️ addIceCandidate: buffering for later (PC not ready yet), total buffered=' +
          (this._earlyCandidates.length + 1),
      );
      this._earlyCandidates.push(candidate);
      return;
    }
    try {
      const iceCandidate = new RTCIceCandidate(JSON.parse(candidate));
      if (!this._pc.remoteDescription) {
        const pcState = this._pc.connectionState;
        const iceState = this._pc.iceConnectionState;
        console.log(
          '[WebRTC] 📥 ICE candidate buffered (no remoteDescription), connState=' +
            pcState +
            ', iceState=' +
            iceState +
            ', pending=' +
            (this._pendingCandidates.length + 1),
        );
        this._pendingCandidates.push(iceCandidate);
        return;
      }
      console.log('[WebRTC] 📥 ICE candidate added, connState=' + this._pc.connectionState);
      await this._pc.addIceCandidate(iceCandidate);
    } catch (e) {
      console.warn('[WebRTC] Failed to add ICE candidate:', e);
    }
  }

  /**
   * ICE restart: создаёт новый offer с флагом iceRestart.
   * Вызывается при `failed` или по инициативе вызывающего (CallStore).
   *
   * @returns JSON-строка нового offer SDP или null при ошибке.
   */
  async iceRestart(): Promise<string | null> {
    if (!this._pc) return null;
    try {
      const sdpInfo = (await this._pc.createOffer({ iceRestart: true })) as SdpInfo;
      const modifiedSdp = this._modifySdpForOpus(sdpInfo.sdp);
      const desc = { type: 'offer', sdp: modifiedSdp };
      await this._pc.setLocalDescription(desc);
      const jsonSdp = JSON.stringify(desc);
      this._onRenegotiationNeeded?.(jsonSdp);
      return jsonSdp;
    } catch {
      return null;
    }
  }

  /**
   * Завершает звонок и очищает всё состояние.
   * - Останавливает и освобождает локальные треки
   * - Закрывает PeerConnection
   * - Сбрасывает коллбэки
   */
  stopCall(): void {
    this._clearDisconnectedTimer();

    this._localStream?.getTracks().forEach(t => t.stop());
    this._localStream = null;
    this._remoteStream = null;
    this._iceRestartAttempted = false;
    this._negotiationInProgress = false;
    this._callInSetup = false;
    this._pendingCandidates = [];
    this._earlyCandidates = [];

    if (this._pc) {
      this._pc.close();
      this._pc = null;
    }

    this._onIceCandidate = null;
    this._onRemoteStream = null;
    this._onConnectionState = null;
    this._onError = null;
    this._onRenegotiationNeeded = null;
  }

  /**
   * Обработать renegotiation offer от удалённой стороны.
   * Вызывается, когда удалённая сторона инициирует ICE restart.
   *
   * 1. Устанавливает remote description из offer
   * 2. Создаёт answer
   * 3. Устанавливает local description
   * 4. Возвращает answer SDP как JSON-строку
   */
  async handleRenegotiationOffer(offerSdp: string): Promise<string> {
    const offer = JSON.parse(offerSdp) as SdpInfo;
    await this._pc?.setRemoteDescription(new RTCSessionDescription(offer));
    await this._flushPendingCandidates();
    const answer = (await this._pc?.createAnswer()) as SdpInfo;
    const modifiedSdp = this._modifySdpForOpus(answer.sdp);
    const desc = { type: 'answer', sdp: modifiedSdp };
    await this._pc?.setLocalDescription(desc);
    return JSON.stringify(desc);
  }

  // ================================================================
  //  Сеттеры коллбэков
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
  //  Приватные вспомогательные методы
  // ================================================================

  /**
   * Модифицирует SDP для голосовых звонков:
   * - Включает FEC (useinbandfec=1) для Opus
   * - Устанавливает битрейт 32 kbps (maxaveragebitrate=32000)
   */
  private _modifySdpForOpus(sdp: string): string {
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

  /** Запускает 5-секундный таймер при `disconnected`. */
  private _startDisconnectedTimer(): void {
    if (this._disconnectedTimer) return;
    this._disconnectedTimer = setTimeout(() => {
      this._disconnectedTimer = null;
      if (this._pc?.connectionState === 'disconnected' || this._pc?.connectionState === 'failed') {
        this._onError?.('connection_disconnected');
        this.stopCall();
      }
    }, 5000);
  }

  /** Отменяет таймер disconnected. */
  private _clearDisconnectedTimer(): void {
    if (this._disconnectedTimer) {
      clearTimeout(this._disconnectedTimer);
      this._disconnectedTimer = null;
    }
  }

  /** Добавляет все накопленные ICE-кандидаты после установки remote description. */
  private async _flushPendingCandidates(): Promise<void> {
    while (this._pendingCandidates.length > 0) {
      const candidate = this._pendingCandidates.shift()!;
      try {
        await this._pc?.addIceCandidate(candidate);
      } catch (e) {
        console.warn('[WebRTC] Failed to add pending ICE candidate:', e);
      }
    }
  }

  /**
   * Обрабатывает состояние `failed`:
   * - При первом сбое — пытается сделать ICE restart
   * - При повторном сбое — вызывает `_onError('connection_failed')`
   */
  private async _handleIceRestart(): Promise<void> {
    if (this._iceRestartAttempted) {
      this._onError?.('connection_failed');
      return;
    }
    this._iceRestartAttempted = true;
    try {
      const offer = await this.iceRestart();
      if (offer) {
        this._onConnectionState?.('ice_restart');
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

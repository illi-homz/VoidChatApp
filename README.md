# VoidChat Client

Эфемерный E2E-зашифрованный мессенджер. Клиент на React Native CLI.

## Архитектура

```
┌──────────────┐     WSS + E2E      ┌──────────────┐
│  Клиент A    │ ◄──────────────►  │   Сервер     │
│  (RN App)    │     relay only    │  (Node.js)   │
└──────────────┘                   └──────────────┘
```

- **Клиент** генерирует ключи, шифрует/расшифровывает, хранит контакты локально
- **Сервер** — relay: принимает шифротекст от A, передаёт B; не хранит ничего на диске

## Быстрый старт

```bash
npm install
cd ios && pod install && cd ..
npm start
# В другом терминале:
npm run ios        # iOS
npm run android    # Android

# Запуск сервера (отдельный репозиторий):
cd ../voidchat-server && npm install && npm run dev
```

Сервер по умолчанию на `ws://127.0.0.1:9001`.

### Деплой на удалённый VPS

Скрипт лежит в корне репозитория `voidchat-server`:

```bash
curl -sS https://raw.githubusercontent.com/illi-homz/voidchat-server/main/deploy.sh | bash

Скрипт сам установит Node.js, скачает сервер, соберёт, настроит фаервол и запустит через pm2. После деплоя введите полученный IP:Port на экране добавления сервера в приложении.

После деплоя для обновления сервера используйте `./update.sh` в директории сервера.
Для полного удаления сервера с VPS — `./uninstall.sh`.

> **Важно:** при первом запуске Android может потребоваться очистка кэша эмулятора:
> `adb -s emulator-5554 uninstall com.voidchatapp && adb -s emulator-5554 shell pm trim-caches 99999999999`

## Структура проекта

```
src/
├── components/          # (пусто) — сюда выносить переиспользуемые UI
├── hooks/               # (пусто) — сюда выносить кастомные хуки
├── utils/               # (пусто) — сюда выносить утилиты
├── navigation/
│   ├── AppNavigator.tsx # Stack навигатор (6 экранов)
│   └── types.ts         # RootStackParamList
├── screens/
│   ├── WelcomeScreen    # Выбор/добавление сервера
│   ├── HomeScreen       # Список контактов, обработка запросов дружбы
│   ├── ChatScreen       # E2E-чат с индикацией доставки сообщений
│   ├── AddFriendScreen  # Отправка запроса дружбы (ждёт подтверждения сервера), кнопка вставки из буфера
│   ├── AddServerScreen  # Добавление нового сервера (название + URL, генерация keypair)
│   └── ShareIdScreen    # QR-код + текст для шаринга ID
├── services/
│   ├── crypto.ts        # tweetnacl: X25519 + XSalsa20-Poly1305 (pure JS)
│   ├── socket.ts        # Socket.IO клиент + heartbeat (30с) + все события
│   └── storage.ts       # AsyncStorage (in-memory cache для синхронного чтения)
├── stores/
│   ├── AppStore.ts      # MobX store (user, contacts, messages, unread)
│   ├── ServerStore.ts   # MobX store (список серверов, активный сервер)
│   └── index.tsx        # StoreProvider + useStore() + useServerStore()
├── theme/
│   └── colors.ts        # Централизованные цвета (10 токенов)
└── types/
    ├── index.ts          # Contact, Message, User, FriendRequest, ServerMessage, ServerConfig
    └── navigation.ts     # Типы для navigation prop
```

## Технологический стек

| Слой | Технология | Назначение |
|------|-----------|------------|
| Сервер | Node.js + Socket.IO | Relay, heartbeat, presence |
| Клиент | React Native CLI 0.85 | Мобильное приложение |
| Состояние | **MobX** 6 + mobx-react-lite 4 | Реактивное управление состоянием |
| Персистентность | **AsyncStorage** (вместо MMKV) | Сохранение пользователя и контактов |
| Криптография | **tweetnacl** (pure JS, вместо libsodium-wrappers) | X25519 + XSalsa20-Poly1305 |
| QR | react-native-qrcode-svg | Генерация QR для обмена ID |
| Навигация | @react-navigation/native-stack | Stack-навигация (6 экранов) |
| Случайные числа | react-native-get-random-values | Полифилл crypto.getRandomValues для Hermes |
| Стилизация | StyleSheet + централизованные токены | Тёмная тема |

## Состояние (MobX)

`src/stores/AppStore.ts` — store данных для активного сервера, `makeAutoObservable(this)` в конструкторе:

```typescript
class AppStore {
  user: User | null               // текущий пользователь (id + ключи для активного сервера)
  contacts: Contact[]             // список контактов (реактивный массив)
  presenceMap: Record<string, boolean>  // онлайн-статусы контактов
  activeChatId: string | null     // какой чат сейчас открыт (для push-уведомлений)
  isReady: boolean                // загружено ли из AsyncStorage
  messages: Map<string, Message[]>       // сообщения по контактам
  unreadCount: Record<string, number>    // счётчик непрочитанных
  currentServerId: string | null         // ID активного сервера

  load(serverId)           // загружает данные для конкретного сервера (runInAction)
  saveUser(user)           // сохраняет пользователя
  addContact(contact)      // добавляет контакт (с проверкой дубликата)
  removeContact(userId)    // удаляет контакт + сообщения + unread
  addMessage() / getMessages()   // управление сообщениями
  incrementUnread() / markAsRead()  // счётчик непрочитанных
  clearAll()               // очищает всё для текущего сервера
}
```

`src/stores/ServerStore.ts` — управление списком серверов:

```typescript
class ServerStore {
  servers: ServerConfig[]         // список серверов
  activeServerId: string | null   // выбранный сервер
  isReady: boolean                // загружено ли из AsyncStorage

  get activeServer(): ServerConfig | null  // активный сервер
  load()                    // загружает список серверов
  add(config)               // добавляет сервер
  remove(serverId)          // удаляет сервер
  setActive(serverId)       // выбирает активный сервер
}
```

**Key Reactivity detail:** `unreadCount` использует `Record<string, number>` и все мутации делаются через замену объекта (`this.unreadCount = { ...this.unreadCount, [key]: val }`). Все данные привязаны к серверу через префикс `{serverId}_` в AsyncStorage.

Экраны используют `useStore()` / `useServerStore()` + оборачиваются в `observer()` для реактивного обновления.

## Цвета

Централизованы в `src/theme/colors.ts`:

| Токен | Значение | Где используется |
|-------|----------|------------------|
| `Colors.background` | `#1A1A2E` | Фоны экранов |
| `Colors.surface` | `#16213E` | Карточки, хедеры, поля ввода |
| `Colors.primary` | `#6C63FF` | Кнопки, акценты, свои сообщения |
| `Colors.textPrimary` | `#FFFFFF` | Основной текст |
| `Colors.textSecondary` | `#888` | Второстепенный текст |
| `Colors.textMuted` | `#666` | Плейсхолдеры, подсказки |
| `Colors.textHint` | `#555` | Мелкие подсказки |
| `Colors.border` | `#2D2D44` | Границы полей |
| `Colors.error` | `#FF6B6B` | Ошибки |
| `Colors.timestamp` | `rgba(255,255,255,0.6)` | Временные метки |

## Socket.IO события

### Клиент → Сервер

| Событие | Payload | Откуда | Описание |
|---------|---------|--------|----------|
| `register` | `{ userId, publicKey }` | `socket.ts` при connect (URL из активного сервера) | Регистрация пользователя |
| `heartbeat` | — | `socket.ts` — setInterval каждые 30с | Поддержание присутствия |
| `friend_request` | `{ targetUserId }` | `AddFriendScreen` | Отправить запрос дружбы |
| `friend_accept` | `{ targetUserId }` | `HomeScreen` (Accept) | Принять запрос |
| `friend_decline` | `{ targetUserId }` | `HomeScreen` (Decline) | Отклонить запрос |
| `message` | `{ to, ciphertext, nonce }` | `ChatScreen` | Отправить сообщение |
| `messages_read` | `{ from, contactId }` | `ChatScreen` | Уведомить собеседника о прочтении |
| `get_presence` | `{ userIds }` | Не вызывается (задел) | Проверить статус |

### Сервер → Клиент

| Событие | Payload | Обработчик | Описание |
|---------|---------|------------|----------|
| `registered` | `{ userId }` | `socket.ts` — resolve промиса | Подтверждение регистрации |
| `error` | `{ message }` | `socket.ts` — console.error | Ошибка |
| `kicked` | `{ message }` | **HomeScreen** — Alert + ресет на Welcome | Дублирующий вход |
| `presence` | `{ userId, online }` | Задел (не используется) | Обновление присутствия |
| `friend_request` | `{ fromUserId, fromPublicKey }` | **HomeScreen** — Alert | Входящий запрос дружбы |
| `friend_request_sent` | `{ targetUserId }` | **AddFriendScreen** — снятие загрузки, Alert | Подтверждение отправки |
| `friend_accepted` | `{ fromUserId, fromPublicKey }` | **HomeScreen** — добавление контакта | Запрос принят |
| `friend_confirmed` | `{ targetUserId, targetPublicKey }` | **HomeScreen** — добавление контакта | Дружба подтверждена |
| `friend_declined` | `{ fromUserId }` | **HomeScreen** — Alert | Запрос отклонён |
| `message` | `{ from, ciphertext, nonce, timestamp }` | **ChatScreen** — расшифровка + рендер | Входящее сообщение |
| `message_sent` | `{ to, ciphertext, nonce, timestamp }` | **ChatScreen** — статус `✓` | Доставлено |
| `message_failed` | `{ to, reason }` | **ChatScreen** — статус `✗` | Ошибка доставки |
| `messages_read` | `{ readBy }` | **ChatScreen** | Собеседник прочитал сообщения |

## E2E шифрование

**Библиотека:** `tweetnacl` (pure JavaScript, без нативных зависимостей).

**Алгоритмы:**

| Алгоритм | Применение | tweetnacl API |
|----------|-----------|---------------|
| **X25519** | Генерация ключевой пары | `nacl.box.keyPair()` |
| **X25519 DH** | Вычисление общего ключа | `nacl.box.before(pub, priv)` |
| **XSalsa20-Poly1305** | Шифрование сообщения | `nacl.secretbox(msg, nonce, key)` |
| **XSalsa20-Poly1305** | Расшифровка | `nacl.secretbox.open(ct, nonce, key)` |
| **randomBytes** | Генерация nonce | `nacl.randomBytes(24)` |

**Ключи** хранятся в AsyncStorage, никогда не покидают клиент. Сервер видит только `{ ciphertext, nonce }` — opaque binary.

**Не реализовано:** Ed25519 подписи (добавятся через `nacl.sign`).

## События приёма/отправки сообщений

Сообщения в `ChatScreen` отображаются со статусом доставки:

| Статус | Иконка | Условие |
|--------|--------|---------|
| Отправляется | `⏳` | Сразу после отправки |
| Доставлено | `✓` | После `message_sent` от сервера |
| Ошибка | `✗` (красный) | После `message_failed` от сервера |

Статус отслеживается через `nonce` (для `message_sent`) и fallback для `message_failed`.

## Обработка kicked (дублирующий вход)

При получении события `kicked`:
1. Останавливается heartbeat
2. Показывается Alert: "Вы вошли с другого устройства"
3. Навигация сбрасывается на `WelcomeScreen`

## Обработка запросов дружбы

1. **Отправка:** `AddFriendScreen` → ждёт `friend_request_sent` (таймаут 5с)
2. **Получение:** `HomeScreen` → Alert с Accept/Decline
3. **Accept:** отправляет `friend_accept`, создаёт контакт локально
4. **Confirm:** `friend_confirmed` → создаёт контакт, если ещё не создан
5. **Decline:** отправляет `friend_decline`, Alert

## Известные проблемы и особенности

### Решённые

| Проблема | Исправление |
|----------|-------------|
| MMKV вместо MobX + AsyncStorage | MobX store (`src/stores/`) + AsyncStorage, MMKV удалён |
| Цвета хардкодом в 7 файлах | `src/theme/colors.ts` — 10 токенов |
| Heartbeat не отправлялся | `setInterval` 30с после `registered`, отключается на kick/disconnect |
| `kicked` не обрабатывался | Alert + ресет навигации на Welcome |
| Статусы сообщений не отображались | `⏳` → `✓` → `✗` с отслеживанием по nonce |
| Успех запроса дружбы показывался сразу | AddFriendScreen ждёт `friend_request_sent` (5с таймаут) |
| `friend_confirmed` игнорировался | HomeScreen создаёт контакт при получении |
| iosodium ESM (`import.meta`) несовместим с Metro | Заменён на **tweetnacl** (pure JS) |
| libsodium WASM требует `node:fs` | tweetnacl не использует нативные модули |
| `globalThis.crypto.getRandomValues` нет в Hermes | `import 'react-native-get-random-values'` в `index.js` |
| Android сборка: `async-storage` не найден | Maven repo в `android/build.gradle` |
| MobX strict-mode: изменение после `await` | `runInAction` в `load()` |
| Badge не обновлялся при получении/чтении сообщений | `unreadCount` переведён с `Map` на `Record`; мутации через замену объекта (`{ ...obj, [key]: val }`) для гарантии реактивности без Proxy |
| `clearListeners()` убивал колбэки других экранов | Заменён на точечные `off*` методы + cleanup ref для `onMessage` |
| Один сервер на всё приложение (`SERVER_URL` в конфиге) | ServerStore + AddServerScreen: мультисерверная архитектура, каждый сервер свой userId/keypair/data |
| Не было push-уведомлений о новых сообщениях | NotificationBanner — полупрозрачный баннер сверху при получении сообщения вне активного чата |

### Текущие

| Проблема | Статус |
|----------|--------|
| Ed25519 подписи | Не реализованы (API готов: `nacl.sign`) |
| QR-сканер | Нет (только генерация QR) |
| Индикаторы присутствия | Событие `presence` приходит, но не отображается |
| Удаление контактов | Метод `removeContact()` есть, не вызывается из UI |
| Пустые директории | `components/`, `hooks/`, `utils/` — можно заполнять |
| `ciphertext` в Message хранит plaintext | Косметический баг именования поля |
| Сервер в отдельном репозитории | Можно добавить как submodule |
| `@react-native-clipboard/clipboard` не установлен | Используется `Clipboard` из `react-native` (deprecated). Установить community-пакет при upgrade RN |
| Нет возможности удалить сервер из приложения | Метод `serverStore.remove()` есть, не вызывается из UI |

## Зависимости (ключевые)

```
mobx       ^6.15.3   — реактивное состояние
mobx-react-lite ^4.1.1 — React интеграция
@react-native-async-storage/async-storage ^3.0.2 — персистентность
tweetnacl  ^1.0.3    — X25519 + XSalsa20-Poly1305 (pure JS)
tweetnacl-util ^0.15.1 — base64 + utf8 для tweetnacl
socket.io-client ^4.8.3 — WebSocket relay
react-native-get-random-values ^1.11.0 — полифилл crypto для Hermes
react-native-qrcode-svg ^6.3.14 — QR-коды
uuid       ^10.0.0   — генерация ID
```

(Удалены: `react-native-mmkv`, `libsodium-wrappers`)

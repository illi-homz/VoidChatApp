# TextureView Rounded Corners для Android RTCView

## 1. Проблема

На Android компонент `RTCView` из библиотеки `react-native-webrtc` использует `SurfaceView` для отображения видео. `SurfaceView` рендерится на отдельном аппаратном слое (hardware overlay) и не подчиняется CSS-клиппингу родительского `ViewGroup`. Это означает, что `overflow: hidden` + `borderRadius` на родителе не обрезают углы видео — они остаются квадратными и видны на фоне.

Проблема воспроизводится в компоненте `VideoPiP` — круглом миниатюрном превью self-view размером 86x86 (или 86x128 для вертикального прямоугольника). Углы SurfaceView выступают за скруглённые границы PiP-контейнера.

**Известна с 2017 года:** react-native-webrtc issue #272.

## 2. Исследование

### SurfaceView и hardware overlay

`SurfaceView` создаёт отдельную поверхность (Z-слой), которая встраивается в иерархию окон Android на уровне `WindowManager`. Этот слой рендерится до или после основного view-контента, но не является частью иерархии View. Поэтому:

- `clipChildren`, `setClipToOutline`, `ViewOutlineProvider` — не влияют на SurfaceView
- `overflow: hidden` + `borderRadius` через React Native — не обрезают углы
- `canvas.clipPath` в `dispatchDraw` — игнорируется для отдельного слоя

### Попытки решений (не сработали)

| Метод | Почему не работает |
|---|---|
| **SVG-маска** поверх RTCView | SurfaceView всё равно выше по Z-order, маска перекрывается |
| **`dispatchDraw` с clipPath** | Отсечение применяется к canvas родителя, но не к hardware overlay |
| **`onLayout` принудительное изменение размера** | Видео просто обрезается по краям, углы остаются прямоугольными |
| **`setZOrderMediaOverlay(false)`** | SurfaceView уходит под layout детей, но видео становится чёрным |
| **CircleImageView / обёртка** | Эффект только визуальный — настоящие квадратные углы остаются |

### Единственное работающее решение

`TextureView` вместо `SurfaceView`. `TextureView` рендерится в обычный view-слой через OpenGL ES, является частью иерархии View и подчиняется clip-правилам родителя. Недостаток: `TextureView` потребляет больше памяти (создаёт собственный буфер кадров) и имеет чуть больший latency (1-2 кадра), но для self-view PiP это некритично.

## 3. Решение: TextureViewRenderer

Создан класс `TextureViewRenderer.java` (пакет `com.oney.WebRTCModule`), который:

### 3.1 extends `TextureView implements VideoSink`

```java
public class TextureViewRenderer extends TextureView implements VideoSink
```

`TextureView` — стандартный Android View, который отображает содержимое `SurfaceTexture` как обычную bitmap-текстуру в иерархии View. `VideoSink` — интерфейс WebRTC для получения кадров через `onFrame(VideoFrame)`.

### 3.2 Использование EglRenderer (Jitsi WebRTC fork)

```java
private final EglRenderer eglRenderer;

public TextureViewRenderer(Context context) {
    super(context);
    this.eglRenderer = new EglRenderer("TextureViewRenderer");
    setSurfaceTextureListener(surfaceTextureListener);
}
```

`EglRenderer` из библиотеки `react-native-webrtc` (Jitsi-форк WebRTC) управляет EGL-контекстом и потоком рендеринга:

- Создаёт EGL-контекст при инициализации
- Создаёт EGL surface на основе `SurfaceTexture` из TextureView
- Получает кадры через `onFrame()` и рендерит их через OpenGL
- Поддерживает mirror (`setMirror`)
- Управляет потоком рендеринга (background thread)

### 3.3 GlRectDrawer

При инициализации передаётся `GlRectDrawer`:

```java
eglRenderer.init(sharedContext, EGL_CONFIG_ATTRIBUTES, new GlRectDrawer());
```

`GlRectDrawer` — реализация `GlDrawer` из Jitsi WebRTC, которая рендерит текстуру на прямоугольник с текстурными координатами. `VideoFrameDrawer` **не реализует** `GlDrawer` в Jitsi-форке (это ключевое отличие от upstream WebRTC), поэтому использовать его нельзя — будет `ClassCastException`.

### 3.4 EGL_CONFIG_ATTRIBUTES

```java
private static final int[] EGL_CONFIG_ATTRIBUTES = new int[] {
    EGL14.EGL_RED_SIZE, 8,
    EGL14.EGL_GREEN_SIZE, 8,
    EGL14.EGL_BLUE_SIZE, 8,
    EGL14.EGL_ALPHA_SIZE, 8,
    EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
    EGL14.EGL_SURFACE_TYPE, EGL14.EGL_WINDOW_BIT,
    EGL14.EGL_NONE,
};
```

Проблема: `eglRenderer.init()` в Jitsi-форке передаёт `attrib_list == null` при создании `EGL14.eglChooseConfig()`, что вызывает `EGL_BAD_ATTRIBUTE` на некоторых устройствах. Явное указание конфигурации решает проблему.

### 3.5 Методы жизненного цикла

| Метод | Действие |
|---|---|
| `init()` | Инициализация EGL, создание EGL surface через контекст `EglBase.Context` |
| `release()` | Освобождение EGL ресурсов |
| `onFrame()` | Прокси на `eglRenderer.onFrame()` + обновление размеров кадра |

### 3.6 SurfaceTextureListener

```java
private final SurfaceTextureListener surfaceTextureListener = new SurfaceTextureListener() {
    @Override
    public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
        eglRenderer.createEglSurface(surface);
    }

    @Override
    public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) {
        eglRenderer.releaseEglSurface(new Runnable() {
            @Override
            public void run() {
                // No-op — required. Jitsi fork NPE on null Runnable.
            }
        });
        return true;
    }

    @Override
    public void onSurfaceTextureSizeChanged(SurfaceTexture surface, int width, int height) {
        if (width > 0 && height > 0 && isInitialized) {
            eglRenderer.releaseEglSurface(emptyRunnable);
            eglRenderer.createEglSurface(surface);
        }
    }
};
```

Пересоздание EGL surface в `onSurfaceTextureSizeChanged` необходимо, так как размер `SurfaceTexture` может измениться при первом появлении кадра после init (например, при 320x240 после 0x0).

### 3.7 setTransform для cover-эффекта

```java
int vw = getWidth();
int vh = getHeight();
if (vw > 0 && vh > 0 && frameWidth > 0 && frameHeight > 0) {
    float frameAspect = (float) frameWidth / frameHeight;
    float viewAspect = (float) vw / vh;
    Matrix matrix = new Matrix();
    if (frameAspect > viewAspect) {
        float displayW = vh * frameAspect;
        float sx = displayW / vw;
        float dx = -(displayW - vw) / 2f;
        matrix.setScale(sx, 1f);
        matrix.postTranslate(dx, 0);
    } else {
        float displayH = vw / frameAspect;
        float sy = displayH / vh;
        float dy = -(displayH - vh) / 2f;
        matrix.setScale(1f, sy);
        matrix.postTranslate(0, dy);
    }
    // Mirror for front camera
    if (mirror) {
        Matrix flip = new Matrix();
        flip.setScale(-1f, 1f);
        flip.postTranslate(vw, 0f);
        matrix.postConcat(flip);
    }
    setTransform(matrix);
}
```

`RendererCommon.getDisplaySize(FILL)` в Jitsi-форке возвращает `(maxWidth, maxHeight)` — то есть растягивает до размеров view без сохранения aspect ratio для TextureView. Поэтому cover-расчёт реализован вручную через `Matrix.setTransform()`.

### 3.8 Mirror (setMirror)

```java
public void setMirror(boolean mirror) {
    this.mirror = mirror;
    eglRenderer.setMirror(mirror);
}
```

Зеркалирование применяется на двух уровнях:

1. `eglRenderer.setMirror(mirror)` — зеркалирование UV-координат в шейдере
2. `Matrix preScale(-1, 1)` в setTransform — зеркалирование через матрицу трансформации TextureView

Это необходимо, так как `eglRenderer` может не отрабатывать mirror на всех устройствах (баг EGL-контекста), а `setTransform` гарантирует корректное отображение.

### 3.9 updateFrameDimensions

```java
private void updateFrameDimensions(VideoFrame frame) {
    int rotation = frame.getRotation();
    int width = frame.getRotatedWidth();
    int height = frame.getRotatedHeight();
    // ...
    if (changed && rendererEvents != null) {
        rendererEvents.onFrameResolutionChanged(width, height, rotation);
        post(() -> { /* setTransform logic */ });
    }
}
```

`frame.getRotatedWidth()` и `frame.getRotatedHeight()` уже учитывают `rotation`, поэтому проверка `frameRotation` не нужна для расчёта aspect ratio — размеры rotated корректны.

## 4. Патч react-native-webrtc

Патч через `patch-package` (файл `patches/react-native-webrtc+124.0.7.patch`, 388 строк, 4 файла):

### 4.1 TextureViewRenderer.java (новый файл, 162 строки)

Полностью новый класс (раздел 3 выше). Добавлен в `com.oney.WebRTCModule`.

### 4.2 WebRTCView.java

**Новые поля:**

```java
private TextureViewRenderer textureViewRenderer;
private boolean useTextureView;
private boolean rendererReady;
```

**Изменения в методах:**

| Метод | Изменение |
|---|---|
| `onAttachedToWindow()` | Conditional: `tryAddTextureViewRendererToVideoTrack()` при `useTextureView`, иначе `tryAddRendererToVideoTrack()` |
| `layout()` | TextureView всегда `(0, 0, width, height)` — fill parent; SurfaceView — original layout с scale |
| `removeRendererFromVideoTrack()` | TextureView branch: removeSink + release |
| `setVideoTrack()` | При `useTextureView` не вызывает `tryAddRendererToVideoTrack()`, а полагается на `tryAddTextureViewRendererToVideoTrack()` в `setStreamURL()` |
| `setMirror()` | Прокси на `textureViewRenderer.setMirror()` |
| `setZOrder()` | Guard: `if (useTextureView) return;` — TextureView не поддерживает z-order, он всегда в слое View |
| `requestSurfaceViewRendererLayout()` | TextureView branch: `WebRTCView.this.requestLayout()` |

**Новый метод:**

```java
public void setUseTextureView(boolean useTextureView) {
    this.useTextureView = useTextureView;
}
```

**Новый метод инициализации:**

```java
private void tryAddTextureViewRendererToVideoTrack() {
    if (!useTextureView || rendererReady || videoTrack == null) return;
    if (!ViewCompat.isAttachedToWindow(this)) return;

    if (textureViewRenderer == null) {
        textureViewRenderer = new TextureViewRenderer(getContext());
        addView(textureViewRenderer,
            new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));
    }

    EglBase.Context sharedContext = EglUtils.getRootEglBaseContext();
    if (sharedContext == null) return;

    textureViewRenderer.init(sharedContext, rendererEvents);
    ThreadUtils.runOnExecutor(() -> {
        try {
            videoTrack.addSink(textureViewRenderer);
        } catch (Throwable tr) {
            Log.e(TAG, "Failed to add texture renderer to video track", tr);
        }
    });
    rendererReady = true;
}
```

### 4.3 RTCVideoViewManager.java

```java
@ReactProp(name = "useTextureView")
public void setUseTextureView(WebRTCView view, boolean useTextureView) {
    view.setUseTextureView(useTextureView);
}
```

### 4.4 RTCView.ts

```typescript
export interface RTCVideoViewProps extends ViewProps {
    // ...
    useTextureView?: boolean;
}
```

## 5. Найденные проблемы и их решения

| Проблема | Симптом | Решение |
|---|---|---|
| `EGL14.eglChooseConfig` с `attrib_list == null` | `EGL_BAD_ATTRIBUTE` на Android 14+ | Явный `EGL_CONFIG_ATTRIBUTES` с RGBA8 + ES2 + WINDOW_BIT |
| `VideoFrameDrawer` не implements `GlDrawer` | `ClassCastException` в `EglRenderer.init()` | Использовать `GlRectDrawer` |
| `releaseEglSurface(null)` | NPE в Jitsi-форке | Передать пустой `Runnable` |
| `rendererEvents` null | `NullPointerException` при `onFrameResolutionChanged` | Передать `rendererEvents` из `WebRTCView` (существующий объект) |
| `getDisplaySize(FILL)` возвращает `(maxWidth, maxHeight)` | Видео не заполняет TextureView (растянуто/некорректно) | Свой расчёт cover через `Matrix.setTransform()` |
| Размер TextureView = 0 при первом кадре | `setTransform` с нулевыми размерами | Guard: `if (vw > 0 && vh > 0)` |
| `frameRotation` в расчёте aspect ratio | Двойное применение rotation | Использовать `frame.getRotatedWidth()` / `frame.getRotatedHeight()` — они уже rotated |

## 6. Итог

- PiP self-view: 86x128 с `borderRadius: 26` (вертикальный прямоугольник)
- `useTextureView={Platform.OS === 'android'}` на `RTCView` в компоненте `VideoPiP`
- `setTransform` обеспечивает cover (aspect ratio сохраняется, избыток центрируется)
- Зеркалирование: `preScale(-1, 1)` в матрице трансформации TextureView
- Патч: 388 строк, 4 файла (`TextureViewRenderer.java`, `WebRTCView.java`, `RTCVideoViewManager.java`, `RTCView.ts`)

## Ссылки

- [react-native-webrtc issue #272](https://github.com/react-native-webrtc/react-native-webrtc/issues/272) — оригинальная проблема (2017)
- `VoidChatApp/docs/textureview-rounded-corners.md` — этот документ
- `VoidChatApp/patches/react-native-webrtc+124.0.7.patch` — файл патча

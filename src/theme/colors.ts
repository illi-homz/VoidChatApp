export const Colors = {
  // Основные
  background: '#080808', // Почти чёрный фон
  surface: '#121212', // Поверхности (карточки, хедеры)
  surfaceLight: '#1A1A1A', // Чуть светлее для контраста (полученные сообщения)

  // Акценты
  primary: '#FFD700', // Золотой — основной акцент
  primaryDark: '#B8960F', // Тёмное золото
  gold: '#FFD700', // Синоним primary для читаемости

  // Белые границы и обводки
  border: 'rgba(255,255,255,0.25)', // Стандартная белая полупрозрачная граница
  borderLight: 'rgba(255,255,255,0.12)', // Тонкая/менее заметная граница
  borderGold: 'rgba(255,215,0,0.5)', // Золотая граница
  borderError: 'rgba(255,68,68,0.5)', // Красная граница

  // Текст
  textPrimary: '#F0F0F0', // Основной белый текст
  textSecondary: '#A0A0A0', // Вторичный серый
  textMuted: '#666666', // Заглушки, подсказки
  textHint: '#444444', // Совсем мелкий текст

  // Статусы
  success: '#00FF88', // Зелёный онлайн/успех
  error: '#FF4444', // Красный ошибка/офлайн
  errorLight: '#FF6B6B', // Светло-красный
  warning: '#FFD700', // Предупреждение (золотой)

  // Специальные
  skullWhite: '#F0F0F0', // Белый для черепа и костей
  statusDot: '#00FF88', // Зелёный дот онлайн
  statusDotOffline: '#FF4444', // Красный дот офлайн

  // Системные
  overlay: 'rgba(0,0,0,0.7)', // Затемнение модалок
  toastSuccess: '#00FF88', // Успех тост
  toastError: '#FF4444', // Ошибка тост
  toastInfo: '#555555', // Инфо тост

  // Технические константы
  borderStandardWidth: 1,
  borderRadius: 12,
  borderRadiusLg: 16,
  borderRadiusSm: 8,
  borderRadiusFull: 9999,
} as const;

export type ColorKeys = keyof typeof Colors;

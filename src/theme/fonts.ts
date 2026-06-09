export const Fonts = {
  roboto100: 'Roboto-Thin',
  roboto200: 'Roboto-ExtraLight',
  roboto300: 'Roboto-Light',
  roboto400: 'Roboto-Regular',
  roboto500: 'Roboto-Medium',
  roboto600: 'Roboto-SemiBold',
  roboto700: 'Roboto-Bold',
  roboto800: 'Roboto-ExtraBold',
  roboto900: 'Roboto-Black',
  robotoItalic: 'Roboto-Italic',
} as const;

export type FontKeys = keyof typeof Fonts;

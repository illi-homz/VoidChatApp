import { TextStyle } from 'react-native';

export const Typography = {
  pirateDisplay: {
    fontSize: 36,
    fontWeight: '900',
    fontFamily: 'sans-serif',
    letterSpacing: 3,
  } as TextStyle,

  pirateTitle: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'sans-serif',
  } as TextStyle,

  pirateSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'sans-serif',
    letterSpacing: 1,
  } as TextStyle,

  pirateBody: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'sans-serif-medium',
    letterSpacing: 0.5,
  } as TextStyle,

  pirateSmall: {
    fontSize: 13,
    fontWeight: '400',
    fontFamily: 'sans-serif',
    letterSpacing: 0.3,
  } as TextStyle,

  pirateMono: {
    fontFamily: 'monospace',
    fontSize: 13,
    letterSpacing: 0.5,
  } as TextStyle,

  stamp: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontStyle: 'italic',
    fontWeight: '300',
    fontFamily: 'sans-serif',
  } as TextStyle,

  button: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'sans-serif',
    letterSpacing: 1,
  } as TextStyle,
} as const;

export type TypographyKeys = keyof typeof Typography;

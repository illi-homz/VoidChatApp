import { TextStyle } from 'react-native';

export const Typography = {
  pirateDisplay: {
    fontSize: 36,
    fontWeight: '900',
    fontFamily: 'Roboto-Black',
    letterSpacing: 3,
  } as TextStyle,

  pirateTitle: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'Roboto-Bold',
  } as TextStyle,

  pirateSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Roboto-Bold',
    letterSpacing: 1,
  } as TextStyle,

  pirateBody: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Roboto-Medium',
    letterSpacing: 0.5,
  } as TextStyle,

  pirateSmall: {
    fontSize: 13,
    fontWeight: '400',
    fontFamily: 'Roboto-Regular',
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
    fontFamily: 'Roboto-Regular',
  } as TextStyle,

  button: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Roboto-Bold',
    letterSpacing: 1,
  } as TextStyle,
} as const;

export type TypographyKeys = keyof typeof Typography;

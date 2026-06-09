import { TextStyle } from 'react-native';
import { Fonts } from './fonts';

export const Typography = {
  pirateDisplay: {
    fontSize: 36,
    fontWeight: '900',
    fontFamily: Fonts.roboto900,
    letterSpacing: 3,
  } as TextStyle,

  pirateTitle: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: Fonts.roboto800,
  } as TextStyle,

  pirateSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Fonts.roboto700,
    letterSpacing: 1,
  } as TextStyle,

  pirateBody: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: Fonts.roboto500,
    letterSpacing: 0.5,
  } as TextStyle,

  pirateSmall: {
    fontSize: 13,
    fontWeight: '400',
    fontFamily: Fonts.roboto400,
    letterSpacing: 0.3,
  } as TextStyle,

  pirateMono: {
    fontFamily: Fonts.roboto400,
    fontSize: 13,
    letterSpacing: 0.5,
  } as TextStyle,

  stamp: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontStyle: 'italic',
    fontWeight: '300',
    fontFamily: Fonts.roboto300,
  } as TextStyle,

  button: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Fonts.roboto700,
    letterSpacing: 1,
  } as TextStyle,
} as const;

export type TypographyKeys = keyof typeof Typography;

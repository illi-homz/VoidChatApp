import React from 'react';
import { ViewStyle } from 'react-native';
import Svg, { Path, Circle, Line, Polyline, Rect, G } from 'react-native-svg';

export type IconName =
  | 'phone'
  | 'phone-off'
  | 'phone-outgoing'
  | 'phone-incoming'
  | 'x'
  | 'copy'
  | 'trash-2'
  | 'clipboard-paste'
  | 'settings'
  | 'user-plus'
  | 'refresh-cw'
  | 'triangle-alert'
  | 'chevron-right'
  | 'check'
  | 'check-check'
  | 'anchor'
  | 'mic'
  | 'mic-off'
  | 'volume-2'
  | 'volume-1'
  | 'camera'
  | 'camera-off'
  | 'skull'
  | 'ship'
  | 'swords'
  | 'scroll-text'
  | 'circle-x'
  | 'send'
  | 'share-2'
  | 'message-circle'
  | 'plus'
  | 'qr-code'
  | 'broom'
  | 'server'
  | 'download'
  | 'play'
  | 'pause'
  | 'stop'
  | 'users';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

const IconBase: React.FC<IconProps> = ({ name, size = 24, color = '#000', style }) => {
  const svgProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style,
  };

  switch (name) {
    case 'phone':
      return (
        <Svg {...svgProps}>
          <Path d='M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384' />
        </Svg>
      );
    case 'phone-off':
      return (
        <Svg {...svgProps}>
          <Path d='M10.1 13.9a14 14 0 0 0 3.732 2.668 1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2 18 18 0 0 1-12.728-5.272' />
          <Path d='M22 2 2 22' />
          <Path d='M4.76 13.582A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 .244.473' />
        </Svg>
      );
    case 'phone-outgoing':
      return (
        <Svg {...svgProps}>
          <Path d='m16 8 6-6' />
          <Path d='M22 8V2h-6' />
          <Path d='M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384' />
        </Svg>
      );
    case 'phone-incoming':
      return (
        <Svg {...svgProps}>
          <Path d='M16 2v6h6' />
          <Path d='m22 2-6 6' />
          <Path d='M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384' />
        </Svg>
      );
    case 'x':
      return (
        <Svg {...svgProps}>
          <Path d='M18 6 6 18' />
          <Path d='m6 6 12 12' />
        </Svg>
      );
    case 'copy':
      return (
        <Svg {...svgProps}>
          <Rect width='14' height='14' x='8' y='8' rx='2' ry='2' />
          <Path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' />
        </Svg>
      );
    case 'trash-2':
      return (
        <Svg {...svgProps}>
          <Path d='M10 11v6' />
          <Path d='M14 11v6' />
          <Path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' />
          <Path d='M3 6h18' />
          <Path d='M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
        </Svg>
      );
    case 'clipboard-paste':
      return (
        <Svg {...svgProps}>
          <Path d='M11 14h10' />
          <Path d='M16 4h2a2 2 0 0 1 2 2v1.344' />
          <Path d='m17 18 4-4-4-4' />
          <Path d='M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113' />
          <Rect x='8' y='2' width='8' height='4' rx='1' />
        </Svg>
      );
    case 'settings':
      return (
        <Svg {...svgProps}>
          <Path d='M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915' />
          <Circle cx='12' cy='12' r='3' />
        </Svg>
      );
    case 'user-plus':
      return (
        <Svg {...svgProps}>
          <Path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
          <Circle cx='9' cy='7' r='4' />
          <Line x1='19' x2='19' y1='8' y2='14' />
          <Line x1='22' x2='16' y1='11' y2='11' />
        </Svg>
      );
    case 'refresh-cw':
      return (
        <Svg {...svgProps}>
          <Path d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' />
          <Path d='M21 3v5h-5' />
          <Path d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' />
          <Path d='M8 16H3v5' />
        </Svg>
      );
    case 'triangle-alert':
      return (
        <Svg {...svgProps}>
          <Path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' />
          <Path d='M12 9v4' />
          <Path d='M12 17h.01' />
        </Svg>
      );
    case 'chevron-right':
      return (
        <Svg {...svgProps}>
          <Path d='m9 18 6-6-6-6' />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...svgProps}>
          <Path d='M20 6 9 17l-5-5' />
        </Svg>
      );
    case 'check-check':
      return (
        <Svg {...svgProps}>
          <Path d='M18 6 7 17l-5-5' />
          <Path d='m22 10-7.5 7.5L13 16' />
        </Svg>
      );
    case 'anchor':
      return (
        <Svg {...svgProps}>
          <Path d='M12 6v16' />
          <Path d='m19 13 2-1a9 9 0 0 1-18 0l2 1' />
          <Path d='M9 11h6' />
          <Circle cx='12' cy='4' r='2' />
        </Svg>
      );
    case 'mic':
      return (
        <Svg {...svgProps}>
          <Path d='M12 19v3' />
          <Path d='M19 10v2a7 7 0 0 1-14 0v-2' />
          <Rect x='9' y='2' width='6' height='13' rx='3' />
        </Svg>
      );
    case 'mic-off':
      return (
        <Svg {...svgProps}>
          <Path d='M12 19v3' />
          <Path d='M15 9.34V5a3 3 0 0 0-5.68-1.33' />
          <Path d='M16.95 16.95A7 7 0 0 1 5 12v-2' />
          <Path d='M18.89 13.23A7 7 0 0 0 19 12v-2' />
          <Path d='m2 2 20 20' />
          <Path d='M9 9v3a3 3 0 0 0 5.12 2.12' />
        </Svg>
      );
    case 'volume-2':
      return (
        <Svg {...svgProps}>
          <Path d='M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z' />
          <Path d='M16 9a5 5 0 0 1 0 6' />
          <Path d='M19.364 18.364a9 9 0 0 0 0-12.728' />
        </Svg>
      );
    case 'volume-1':
      return (
        <Svg {...svgProps}>
          <Path d='M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z' />
          <Path d='M16 9a5 5 0 0 1 0 6' />
        </Svg>
      );
    case 'camera':
      return (
        <Svg {...svgProps}>
          <Path d='M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z' />
          <Circle cx='12' cy='13' r='3' />
        </Svg>
      );
    case 'camera-off':
      return (
        <Svg {...svgProps}>
          <Path d='M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z' />
          <Circle cx='12' cy='13' r='3' />
          <Path d='M22 2 2 22' />
        </Svg>
      );
    case 'skull':
      return (
        <Svg {...svgProps}>
          <Path d='m12.5 17-.5-1-.5 1h1z' />
          <Path d='M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z' />
          <Circle cx='15' cy='12' r='1' />
          <Circle cx='9' cy='12' r='1' />
        </Svg>
      );
    case 'ship':
      return (
        <Svg {...svgProps}>
          <Path d='M12 10.189V14' />
          <Path d='M12 2v3' />
          <Path d='M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6' />
          <Path d='M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76' />
          <Path d='M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1' />
        </Svg>
      );
    case 'swords':
      return (
        <Svg {...svgProps}>
          <Polyline points='14.5 17.5 3 6 3 3 6 3 17.5 14.5' />
          <Line x1='13' x2='19' y1='19' y2='13' />
          <Line x1='16' x2='20' y1='16' y2='20' />
          <Line x1='19' x2='21' y1='21' y2='19' />
          <Polyline points='14.5 6.5 18 3 21 3 21 6 17.5 9.5' />
          <Line x1='5' x2='9' y1='14' y2='18' />
          <Line x1='7' x2='4' y1='17' y2='20' />
          <Line x1='3' x2='5' y1='19' y2='21' />
        </Svg>
      );
    case 'scroll-text':
      return (
        <Svg {...svgProps}>
          <Path d='M15 12h-5' />
          <Path d='M15 8h-5' />
          <Path d='M19 17V5a2 2 0 0 0-2-2H4' />
          <Path d='M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3' />
        </Svg>
      );
    case 'circle-x':
      return (
        <Svg {...svgProps}>
          <Circle cx='12' cy='12' r='10' />
          <Path d='m15 9-6 6' />
          <Path d='m9 9 6 6' />
        </Svg>
      );
    case 'send':
      return (
        <Svg {...svgProps}>
          <Path d='M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z' />
          <Path d='m21.854 2.147-10.94 10.939' />
        </Svg>
      );
    case 'share-2':
      return (
        <Svg {...svgProps}>
          <Circle cx='18' cy='5' r='3' />
          <Circle cx='6' cy='12' r='3' />
          <Circle cx='18' cy='19' r='3' />
          <Line x1='8.59' x2='15.42' y1='13.51' y2='17.49' />
          <Line x1='15.41' x2='8.59' y1='6.51' y2='10.49' />
        </Svg>
      );
    case 'message-circle':
      return (
        <Svg {...svgProps}>
          <Path d='M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719' />
        </Svg>
      );
    case 'plus':
      return (
        <Svg {...svgProps}>
          <Path d='M5 12h14' />
          <Path d='M12 5v14' />
        </Svg>
      );
    case 'qr-code':
      return (
        <Svg {...svgProps}>
          <Rect width='5' height='5' x='3' y='3' rx='1' />
          <Rect width='5' height='5' x='16' y='3' rx='1' />
          <Rect width='5' height='5' x='3' y='16' rx='1' />
          <Path d='M21 16h-3a2 2 0 0 0-2 2v3' />
          <Path d='M21 21v.01' />
          <Path d='M12 7v3a2 2 0 0 1-2 2H7' />
          <Path d='M3 12h.01' />
          <Path d='M12 3h.01' />
          <Path d='M12 16v.01' />
          <Path d='M16 12h1' />
          <Path d='M21 12v.01' />
        </Svg>
      );
    case 'broom':
      return (
        <Svg {...svgProps}>
          <G transform='translate(12,12) rotate(-40) scale(1.1) translate(-13,-12)'>
            <Line x1='12' y1='2' x2='12' y2='14' />
            <Path d='M5 21c1-2 3-4 7-7' />
            <Path d='M19 21c-1-2-3-4-7-7' />
            <Path d='M8 22c1-2 2-3 4-5' />
            <Path d='M16 22c-1-2-2-3-4-5' />
            <Path d='M12 14v8' />
          </G>
        </Svg>
      );
    case 'server':
      return (
        <Svg {...svgProps}>
          <Rect width='20' height='8' x='2' y='2' rx='2' ry='2' />
          <Rect width='20' height='8' x='2' y='14' rx='2' ry='2' />
          <Line x1='6' y1='6' x2='6.01' y2='6' />
          <Line x1='6' y1='18' x2='6.01' y2='18' />
        </Svg>
      );
    case 'download':
      return (
        <Svg {...svgProps}>
          <Path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
          <Polyline points='7 10 12 15 17 10' />
          <Line x1='12' y1='15' x2='12' y2='3' />
        </Svg>
      );
    case 'play':
      return (
        <Svg {...svgProps}>
          <Path d='m7 5 11 7-11 7Z' />
        </Svg>
      );
    case 'pause':
      return (
        <Svg {...svgProps}>
          <Path d='M6 5h4v14H6Z' />
          <Path d='M14 5h4v14h-4Z' />
        </Svg>
      );
    case 'stop':
      return (
        <Svg {...svgProps}>
          <Rect x='6' y='6' width='12' height='12' rx='1' />
        </Svg>
      );
    case 'users':
      return (
        <Svg {...svgProps}>
          <Path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
          <Circle cx='9' cy='7' r='4' />
          <Path d='M22 21v-2a4 4 0 0 0-3-3.87' />
          <Path d='M16 3.13a4 4 0 0 1 0 7.75' />
        </Svg>
      );
    default:
      return null;
  }
};

export const Icon = React.memo(IconBase);

interface CameraOffIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const CameraOffIcon: React.FC<CameraOffIconProps> = ({
  width = 24,
  height = 24,
  color = '#FFD700',
}) => {
  const size = Math.min(width, height);
  return <Icon name='camera-off' size={size} color={color} />;
};

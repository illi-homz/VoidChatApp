/**
 * Создаёт hitSlop для TouchableOpacity с симметричными значениями.
 *
 * - getHitSlop(5) → { top: 5, right: 5, bottom: 5, left: 5 }
 * - getHitSlop(5, 10) → { top: 5, right: 10, bottom: 5, left: 10 }
 * - getHitSlop(5, 10, 15) → { top: 5, right: 10, bottom: 15, left: 10 }
 * - getHitSlop(5, 10, 15, 20) → { top: 5, right: 10, bottom: 15, left: 20 }
 */
export function getHitSlop(
  top: number,
  right?: number,
  bottom?: number,
  left?: number,
): { top: number; right: number; bottom: number; left: number } {
  return {
    top,
    right: right ?? top,
    bottom: bottom ?? top,
    left: left ?? right ?? top,
  };
}

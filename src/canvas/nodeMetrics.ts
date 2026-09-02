// Node geometry constants, kept free of JSX so pure-TS modules (and vitest)
// can import them without a React transform.

/** The node's hit-box — constant across icon and card mode so edges stay stable. */
export const NODE_W = 200;
export const NODE_H = 100;
/** The official icon size in icon mode. */
export const ICON = 56;

/** What a node actually *draws* in icon mode: the icon plus its rim, and the
 *  icon plus the name underneath. Much smaller than the hit-box, which is why
 *  auto-layout spaces icons by these and reserves room by NODE_W/NODE_H · a
 *  row of 56px icons pitched as if each were a 200px card reads as four
 *  unrelated things rather than a chain. */
export const ICON_DRAW_W = ICON + 12;
export const ICON_DRAW_H = ICON + 24;

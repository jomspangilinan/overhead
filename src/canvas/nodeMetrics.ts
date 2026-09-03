// Node geometry constants, kept free of JSX so pure-TS modules (and vitest)
// can import them without a React transform.

/** The node's hit-box — constant across icon and card mode so edges stay stable. */
export const NODE_W = 200;
export const NODE_H = 100;
/** The official icon size in icon mode. */
export const ICON = 56;

/** What a node actually *draws* in icon mode: the icon plus its rim, and the
 *  icon plus the name underneath. Auto-layout spaces by these, so a row of
 *  56px icons is not pitched as if each were a 200px card · which reads as
 *  four unrelated things rather than a chain.
 *
 *  The cost, named because it is real: an icon layout is tight for icons and
 *  crowded once cards appear. Pressing K re-arranges for cards (the toggle
 *  lays the drawing out for the view you switched to), so the only way to
 *  see them overlap is to reach card mode by **zooming** past 130% instead. */
export const ICON_DRAW_W = ICON + 12;
export const ICON_DRAW_H = ICON + 24;

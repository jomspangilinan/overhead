// Node geometry constants, kept free of JSX so pure-TS modules (and vitest)
// can import them without a React transform.

/** The node's hit-box — constant across icon and card mode so edges stay stable. */
export const NODE_W = 200;
export const NODE_H = 100;
/** The official icon size in icon mode. */
export const ICON = 56;

/** What a node actually *draws* in icon mode, top to bottom: the icon plus
 *  the name underneath. Auto-layout pitches **rows** by this, so a column of
 *  icons is not spaced as if each were a 100px card · a 76px card still fits
 *  inside the row pitch it produces, which is what lets one arrangement be
 *  right in both modes. **Columns** are pitched by NODE_W whatever the mode:
 *  the card is not opt-in (it appears at 130% zoom), so a drawing spaced for
 *  the icon's width overlaps itself the moment anybody zooms in to read. */
export const ICON_DRAW_H = ICON + 24;

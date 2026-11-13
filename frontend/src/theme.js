/**
 * theme.js
 * ---------------------------------------------------------
 * WHAT THIS FILE IS:
 * Every color and font used anywhere in the app lives here,
 * in two objects — LIGHT and DARK. Nothing else in the app
 * hardcodes a color. When the theme toggle switches modes,
 * every component just re-reads from whichever object is
 * active ("t" — short for "theme" — passed down as a prop).
 *
 * WHY IT'S SEPARATE:
 * If you want to change the whole app's color palette, this
 * is the ONLY file you should need to touch.
 * ---------------------------------------------------------
 */

export const LIGHT = {
  bg: "#FBF3E8",          // page background
  bgAlt: "#F3E6D3",        // alternate section background
  surface: "#FFFFFF",      // cards, inputs, buttons
  surfaceAlt: "#F6ECDD",   // slightly-tinted surface (dropzone, badges)
  text: "#241C1A",         // main text
  textMuted: "#7A6B5D",    // secondary/quiet text
  border: "#E4D3BB",       // hairlines and outlines
  accent: "#B8763E",       // brand color — buttons, icons, highlights
  accentDark: "#96602F",   // darker accent (hover states, chip text)
  accentSoft: "#EFDCC0",   // pale accent background (icon circles, chips)
  danger: "#A8412E",       // errors, destructive actions
  success: "#4B7A5A",      // confirmations
};

export const DARK = {
  bg: "#1C1512",
  bgAlt: "#241C18",
  surface: "#2A211D",
  surfaceAlt: "#332821",
  text: "#F2E9DE",
  textMuted: "#B8A996",
  border: "#3E322A",
  accent: "#D6A066",
  accentDark: "#C98A4B",
  accentSoft: "#3A2C20",
  danger: "#D9694F",
  success: "#6FA07E",
};

// Fonts: a warm serif for headlines, a clean sans for body text,
// and a monospace font for anything that looks like raw data
// (encrypted blobs, wrapped keys).
export const serif = "'Fraunces', Georgia, serif";
export const sans = "'Inter', system-ui, sans-serif";
export const mono = "'JetBrains Mono', ui-monospace, monospace";

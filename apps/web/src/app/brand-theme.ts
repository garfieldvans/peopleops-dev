import type { ThemeOverride } from "@nemo-ui/ui";

const lightPrimary = {
  50: "#fff4ed",
  100: "#ffe6d5",
  200: "#ffd0ae",
  300: "#ffb183",
  400: "#ff8a4c",
  500: "#f26522",
  600: "#e0520f",
  700: "#b93f0b",
  800: "#932f0a",
  900: "#76270b",
};

const darkPrimary = {
  50: "#2c1a10",
  100: "#3b2113",
  200: "#4c2a17",
  300: "#6b3a1e",
  400: "#c25417",
  500: "#f26522",
  600: "#ff7a3c",
  700: "#ff9a66",
  800: "#ffb58c",
  900: "#ffd0b3",
};

/** Figma kit accent (#F26522) applied to Nemo's primary tokens per mode. */
export const brandTheme: ThemeOverride = { colors: { primary: lightPrimary } };
export const brandThemeDark: ThemeOverride = { colors: { primary: darkPrimary } };

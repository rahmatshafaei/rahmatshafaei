/** Theme preference: a per-device convenience stored in localStorage. */
export const THEME_KEY = "formafit:theme";
export type ThemePreference = "system" | "light" | "dark";

/** Runs before first paint so an explicit choice never flashes the wrong theme. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

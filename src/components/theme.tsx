"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePref = "light" | "dark" | "system";

const Ctx = createContext<{ theme: ThemePref; setTheme: (t: ThemePref) => void }>({ theme: "system", setTheme: () => {} });

/** Runs before paint (inlined in <head>) so there is no light/dark flash. */
export const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )tv_theme=(light|dark|system)/);var p=m?m[1]:"system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeProvider({ initial, children }: { initial: ThemePref; children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(initial);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme]);

  const setTheme = useCallback((t: ThemePref) => {
    document.cookie = `tv_theme=${t}; path=/; max-age=31536000; samesite=lax`;
    apply(t);
    setThemeState(t);
  }, []);

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

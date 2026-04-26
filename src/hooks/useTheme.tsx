import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Mode = "light" | "dark";
export type Accent = "blue" | "emerald" | "violet" | "orange";

export const ACCENTS: Record<Accent, { name: string; light: string; dark: string }> = {
  blue:    { name: "Ocean Blue",    light: "217 91% 53%", dark: "217 91% 60%" },
  emerald: { name: "Soft Emerald",  light: "160 70% 38%", dark: "160 65% 50%" },
  violet:  { name: "Calm Violet",   light: "262 70% 55%", dark: "262 75% 65%" },
  orange:  { name: "Warm Orange",   light: "24 85% 50%",  dark: "24 90% 60%"  },
};

type Ctx = {
  mode: Mode;
  accent: Accent;
  setMode: (m: Mode) => void;
  setAccent: (a: Accent) => void;
  resetToDefault: () => void;
};

const ThemeContext = createContext<Ctx>({
  mode: "light", accent: "blue",
  setMode: () => {}, setAccent: () => {}, resetToDefault: () => {},
});

const applyTheme = (mode: Mode, accent: Accent) => {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  const a = ACCENTS[accent];
  const value = mode === "dark" ? a.dark : a.light;
  root.style.setProperty("--primary", value);
  root.style.setProperty("--ring", value);
  root.style.setProperty("--sidebar-primary", value);
  root.style.setProperty("--sidebar-ring", value);
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<Mode>("light");
  const [accent, setAccentState] = useState<Accent>("blue");

  useEffect(() => {
    const m = (localStorage.getItem("theme_mode") as Mode) || "light";
    const a = (localStorage.getItem("theme_accent") as Accent) || "blue";
    setModeState(m); setAccentState(a);
    applyTheme(m, a);
  }, []);

  const setMode = (m: Mode) => {
    setModeState(m); localStorage.setItem("theme_mode", m); applyTheme(m, accent);
  };
  const setAccent = (a: Accent) => {
    setAccentState(a); localStorage.setItem("theme_accent", a); applyTheme(mode, a);
  };
  const resetToDefault = () => {
    localStorage.removeItem("theme_mode");
    localStorage.removeItem("theme_accent");
    setModeState("light"); setAccentState("blue");
    applyTheme("light", "blue");
  };

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent, resetToDefault }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

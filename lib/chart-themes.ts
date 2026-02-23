/**
 * Sistema de temas para el gráfico de backtesting
 * Permite personalizar colores según preferencias del usuario
 */

export interface ChartTheme {
  name: string;
  id: string;
  colors: {
    background: string;
    grid: string;
    text: string;
    candleUp: string;
    candleDown: string;
    wickUp: string;
    wickDown: string;
    entryLine: string;
    tpLine: string;
    slLine: string;
    trailingLine: string;
    currentPrice: string;
    levelColors: string[];
  };
}

export const CHART_THEMES: ChartTheme[] = [
  {
    name: "MT5 Dark",
    id: "mt5",
    colors: {
      background: "#1a1a2e",
      grid: "#2a2a4a",
      text: "#e0e0e0",
      candleUp: "#00c853",
      candleDown: "#ff1744",
      wickUp: "#00c853",
      wickDown: "#ff1744",
      entryLine: "#2196f3",
      tpLine: "#00e676",
      slLine: "#ff5252",
      trailingLine: "#ffc107",
      currentPrice: "#ffd700",
      levelColors: ["#ab47bc", "#ff9100", "#76ff03", "#e91e63"],
    },
  },
  {
    name: "TradingView Dark",
    id: "tv-dark",
    colors: {
      background: "#131722",
      grid: "#1e222d",
      text: "#d1d4dc",
      candleUp: "#26a69a",
      candleDown: "#ef5350",
      wickUp: "#26a69a",
      wickDown: "#ef5350",
      entryLine: "#2962ff",
      tpLine: "#26a69a",
      slLine: "#ef5350",
      trailingLine: "#ff9800",
      currentPrice: "#ffd700",
      levelColors: ["#7b1fa2", "#f57c00", "#388e3c", "#c2185b"],
    },
  },
  {
    name: "Catppuccin Mocha",
    id: "catppuccin",
    colors: {
      background: "#1e1e2e",
      grid: "#313244",
      text: "#cdd6f4",
      candleUp: "#a6e3a1",
      candleDown: "#f38ba8",
      wickUp: "#a6e3a1",
      wickDown: "#f38ba8",
      entryLine: "#89b4fa",
      tpLine: "#a6e3a1",
      slLine: "#f38ba8",
      trailingLine: "#f9e2af",
      currentPrice: "#f9e2af",
      levelColors: ["#cba6f7", "#fab387", "#94e2d5", "#f5c2e7"],
    },
  },
  {
    name: "Light Mode",
    id: "light",
    colors: {
      background: "#ffffff",
      grid: "#e0e0e0",
      text: "#333333",
      candleUp: "#26a69a",
      candleDown: "#ef5350",
      wickUp: "#26a69a",
      wickDown: "#ef5350",
      entryLine: "#1976d2",
      tpLine: "#26a69a",
      slLine: "#ef5350",
      trailingLine: "#ff9800",
      currentPrice: "#ff9800",
      levelColors: ["#9c27b0", "#ff9800", "#4caf50", "#e91e63"],
    },
  },
];

/**
 * Obtiene un tema por su ID
 */
export function getThemeById(themeId: string): ChartTheme {
  return CHART_THEMES.find((t) => t.id === themeId) || CHART_THEMES[0];
}

/**
 * Obtiene los colores de un tema
 */
export function getThemeColors(themeId: string): ChartTheme["colors"] {
  return getThemeById(themeId).colors;
}

/**
 * Guarda el tema preferido en localStorage
 */
export function savePreferredTheme(themeId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("backtester-theme", themeId);
  }
}

/**
 * Obtiene el tema preferido del localStorage
 */
export function getPreferredTheme(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("backtester-theme") || "mt5";
  }
  return "mt5";
}

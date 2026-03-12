/**
 * Hook para persistir preferencias del backtester en localStorage
 * Guarda automáticamente la configuración cuando cambia
 */

import { useState, useEffect, useCallback } from "react";

export interface BacktestPreferences {
  // Parámetros de estrategia
  lotajeBase: number;
  pipsDistance: number;
  maxLevels: number;
  takeProfitPips: number;
  useTrailingSL: boolean;
  trailingSLPercent: number;
  useStopLoss: boolean;
  stopLossPips?: number;

  // Fuente de datos
  signalsSource?: string;
  initialCapital: number;
  useRealPrices: boolean;

  // Filtros
  filters?: {
    session?: "ASIAN" | "EUROPEAN" | "US" | "ALL";
    side?: "BUY" | "SELL";
    daysOfWeek?: number[];
  };

  // DataSource
  dataSource?: "csv" | "supabase";
  dateFrom?: string;
  dateTo?: string;

  // Signal limit (guardado por separado para no incluir en preferencias)
  signalLimit?: number;
}

const STORAGE_KEY = "backtester-preferences";
const SIGNAL_LIMIT_KEY = "backtester-signal-limit";

const DEFAULT_PREFERENCES: BacktestPreferences = {
  lotajeBase: 0.1,
  pipsDistance: 10,
  maxLevels: 4,
  takeProfitPips: 20,
  useTrailingSL: true,
  trailingSLPercent: 50,
  useStopLoss: false,
  stopLossPips: undefined,
  signalsSource: "signals_simple.csv",
  initialCapital: 10000,
  useRealPrices: false,
  dataSource: "supabase",
  dateFrom: "2024-01-01",
  dateTo: new Date().toISOString().slice(0, 10),
  filters: {
    session: "ALL",
  },
};

/**
 * Carga preferencias desde localStorage
 */
function loadPreferences(): BacktestPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge con defaults para asegurar que todos los campos existan
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch (e) {
    console.error("Error loading backtester preferences:", e);
  }
  return DEFAULT_PREFERENCES;
}

/**
 * Guarda preferencias en localStorage
 */
function savePreferences(prefs: BacktestPreferences): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error("Error saving backtester preferences:", e);
  }
}

/**
 * Carga signal limit desde localStorage
 */
function loadSignalLimit(): number {
  if (typeof window === "undefined") return 100;

  try {
    const stored = localStorage.getItem(SIGNAL_LIMIT_KEY);
    return stored ? parseInt(stored, 10) : 100;
  } catch (e) {
    return 100;
  }
}

/**
 * Guarda signal limit en localStorage
 */
function saveSignalLimit(limit: number): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(SIGNAL_LIMIT_KEY, String(limit));
  } catch (e) {
    console.error("Error saving signal limit:", e);
  }
}

/**
 * Hook principal para gestionar preferencias del backtester
 *
 * @returns Objeto con preferencias y funciones para actualizarlas
 */
export function useBacktesterPreferences() {
  const [preferences, setPreferences] = useState<BacktestPreferences>(DEFAULT_PREFERENCES);
  const [signalLimit, setSignalLimitState] = useState(100);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cargar preferencias al montar
  useEffect(() => {
    const loadedPrefs = loadPreferences();
    const loadedLimit = loadSignalLimit();
    setPreferences(loadedPrefs);
    setSignalLimitState(loadedLimit);
    setIsLoaded(true);
  }, []);

  // Actualizar una preferencia específica y guardar
  const updatePreference = useCallback(<K extends keyof BacktestPreferences>(
    key: K,
    value: BacktestPreferences[K]
  ) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: value };
      savePreferences(updated);
      return updated;
    });
  }, []);

  // Actualizar múltiples preferencias a la vez
  const updatePreferences = useCallback((updates: Partial<BacktestPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...updates };
      savePreferences(updated);
      return updated;
    });
  }, []);

  // Actualizar signal limit
  const updateSignalLimit = useCallback((limit: number) => {
    setSignalLimitState(limit);
    saveSignalLimit(limit);
  }, []);

  // Resetear a valores por defecto
  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    setSignalLimitState(100);
    savePreferences(DEFAULT_PREFERENCES);
    saveSignalLimit(100);
  }, []);

  // Obtener el objeto de configuración completo para usar en el backtest
  const getConfig = useCallback((): BacktestPreferences => {
    return { ...preferences };
  }, [preferences]);

  return {
    preferences,
    signalLimit,
    updatePreference,
    updatePreferences,
    updateSignalLimit,
    resetPreferences,
    getConfig,
    isLoaded,
  };
}

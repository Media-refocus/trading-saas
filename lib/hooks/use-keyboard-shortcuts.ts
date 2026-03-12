/**
 * Hook para atajos de teclado del backtester
 * - Ctrl+Enter: Ejecutar backtest
 * - Escape: Cancelar ejecución (si hay polling activo)
 */

import { useEffect, useCallback } from "react";

export interface KeyboardShortcutConfig {
  onExecute?: () => void;
  onCancel?: () => void;
  canExecute?: boolean;
  canCancel?: boolean;
}

/**
 * Hook para manejar atajos de teclado globales del backtester
 *
 * @param config - Configuración de callbacks y condiciones
 */
export function useKeyboardShortcuts(config: KeyboardShortcutConfig = {}) {
  const { onExecute, onCancel, canExecute = true, canCancel = false } = config;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ctrl+Enter o Cmd+Enter (Mac) para ejecutar
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (canExecute && onExecute) {
          onExecute();
        }
        return;
      }

      // Escape para cancelar
      if (event.key === "Escape") {
        if (canCancel && onCancel) {
          onCancel();
        }
        return;
      }

      // Atajos numéricos para timeframe (1-6)
      // Estos se envían como eventos custom para que los componentes los escuchen
      const num = parseInt(event.key);
      if (num >= 1 && num <= 6) {
        // Solo si no estamos en un input
        const target = event.target as HTMLElement;
        if (
          target.tagName !== "INPUT" &&
          target.tagName !== "TEXTAREA" &&
          !target.isContentEditable
        ) {
          // Disparar evento custom
          window.dispatchEvent(new CustomEvent("backtester-timeframe", { detail: num }));
        }
      }
    },
    [canExecute, canCancel, onExecute, onCancel]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    /**
     * Registra un listener para el evento de timeframe
     */
    onTimeframeChange: (callback: (timeframeIndex: number) => void) => {
      const handler = (e: Event) => {
        const customEvent = e as CustomEvent<number>;
        callback(customEvent.detail);
      };

      window.addEventListener("backtester-timeframe", handler);

      return () => {
        window.removeEventListener("backtester-timeframe", handler);
      };
    },
  };
}

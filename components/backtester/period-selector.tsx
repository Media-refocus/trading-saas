"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Calendar,
  ChevronDown,
  Clock,
  TrendingUp,
  BarChart3,
  Layers,
} from "lucide-react";

// ==================== TYPES ====================

export type PeriodOption =
  | "today"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "all";

export type VisualizationMode = "detail" | "operative" | "overview";

export interface PeriodSelectorProps {
  selectedPeriod: PeriodOption;
  selectedMode: VisualizationMode;
  onPeriodChange: (period: PeriodOption) => void;
  onModeChange: (mode: VisualizationMode) => void;
  isLoading?: boolean;
  tradeCount?: number;
  dateRange?: { from: Date; to: Date };
}

// ==================== CONSTANTS ====================

const PERIOD_OPTIONS: Array<{
  value: PeriodOption;
  label: string;
  description: string;
}> = [
  { value: "today", label: "Hoy", description: "Operativas de hoy" },
  { value: "week", label: "Esta semana", description: "Últimos 7 días" },
  { value: "month", label: "Este mes", description: "Últimos 30 días" },
  { value: "quarter", label: "Últimos 3 meses", description: "90 días" },
  { value: "year", label: "Este año", description: "365 días" },
  { value: "all", label: "Todo", description: "Historial completo" },
];

const MODE_OPTIONS: Array<{
  value: VisualizationMode;
  label: string;
  icon: typeof BarChart3;
  description: string;
}> = [
  {
    value: "detail",
    label: "Detalle",
    icon: BarChart3,
    description: "Trade individual con velas completas",
  },
  {
    value: "operative",
    label: "Operativa",
    icon: TrendingUp,
    description: "Todos los trades con velas comprimidas",
  },
  {
    value: "overview",
    label: "Overview",
    icon: Layers,
    description: "Equity curve + marcadores de trades",
  },
];

// ==================== HELPERS ====================

export function getPeriodDateRange(period: PeriodOption): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  let from = new Date(now);

  switch (period) {
    case "today":
      from.setHours(0, 0, 0, 0);
      break;
    case "week":
      from.setDate(from.getDate() - 7);
      break;
    case "month":
      from.setMonth(from.getMonth() - 1);
      break;
    case "quarter":
      from.setMonth(from.getMonth() - 3);
      break;
    case "year":
      from.setFullYear(from.getFullYear() - 1);
      break;
    case "all":
      from = new Date(2020, 0, 1); // Fecha muy antigua
      break;
  }

  return { from, to };
}

// ==================== COMPONENT ====================

export function PeriodSelector({
  selectedPeriod,
  selectedMode,
  onPeriodChange,
  onModeChange,
  isLoading = false,
  tradeCount,
  dateRange,
}: PeriodSelectorProps) {
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);

  const selectedPeriodOption = PERIOD_OPTIONS.find((p) => p.value === selectedPeriod);
  const selectedModeOption = MODE_OPTIONS.find((m) => m.value === selectedMode);

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-[#252526] border-b border-[#3C3C3C]">
      {/* Selector de Período */}
      <div className="relative">
        <button
          onClick={() => setIsPeriodOpen(!isPeriodOpen)}
          disabled={isLoading}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded text-sm",
            "bg-[#333333] hover:bg-[#444444] transition-colors",
            isLoading && "opacity-50 cursor-wait"
          )}
        >
          <Calendar className="w-4 h-4 text-[#888888]" />
          <span>{selectedPeriodOption?.label || "Período"}</span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-[#888888] transition-transform",
              isPeriodOpen && "rotate-180"
            )}
          />
        </button>

        {isPeriodOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsPeriodOpen(false)}
            />

            {/* Dropdown */}
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#2D2D2D] border border-[#3C3C3C] rounded-lg shadow-xl z-20 overflow-hidden">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onPeriodChange(option.value);
                    setIsPeriodOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-[#3C3C3C] transition-colors",
                    selectedPeriod === option.value && "bg-[#0078D4]/20 text-[#0078D4]"
                  )}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-[#888888]">{option.description}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Separador */}
      <div className="w-px h-6 bg-[#3C3C3C]" />

      {/* Selector de Modo */}
      <div className="flex items-center gap-1">
        {MODE_OPTIONS.map((mode) => {
          const Icon = mode.icon;
          const isSelected = selectedMode === mode.value;

          return (
            <button
              key={mode.value}
              onClick={() => onModeChange(mode.value)}
              disabled={isLoading}
              title={mode.description}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors",
                isSelected
                  ? "bg-[#0078D4] text-white"
                  : "bg-[#333333] text-[#888888] hover:bg-[#444444] hover:text-white",
                isLoading && "opacity-50 cursor-wait"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Info adicional */}
      <div className="flex-1" />

      {tradeCount !== undefined && (
        <div className="flex items-center gap-2 text-xs text-[#888888]">
          <Clock className="w-3.5 h-3.5" />
          <span>{tradeCount} trades</span>
        </div>
      )}

      {dateRange && (
        <div className="text-xs text-[#888888] hidden md:block">
          {dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
        </div>
      )}

      {/* Indicador de carga */}
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-[#0078D4]">
          <div className="w-3 h-3 border-2 border-[#0078D4] border-t-transparent rounded-full animate-spin" />
          <span>Cargando...</span>
        </div>
      )}
    </div>
  );
}

// ==================== MOBILE VERSION ====================

export function PeriodSelectorMobile({
  selectedPeriod,
  selectedMode,
  onPeriodChange,
  onModeChange,
  isLoading = false,
}: Omit<PeriodSelectorProps, "tradeCount" | "dateRange">) {
  return (
    <div className="flex flex-col gap-2 px-3 py-2 bg-[#252526] border-b border-[#3C3C3C]">
      {/* Modos en fila */}
      <div className="flex items-center justify-center gap-1">
        {MODE_OPTIONS.map((mode) => {
          const Icon = mode.icon;
          const isSelected = selectedMode === mode.value;

          return (
            <button
              key={mode.value}
              onClick={() => onModeChange(mode.value)}
              disabled={isLoading}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 px-2 py-2 rounded text-xs",
                isSelected
                  ? "bg-[#0078D4] text-white"
                  : "bg-[#333333] text-[#888888]",
                isLoading && "opacity-50"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Períodos en scroll horizontal */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onPeriodChange(option.value)}
            disabled={isLoading}
            className={cn(
              "flex-shrink-0 px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors",
              selectedPeriod === option.value
                ? "bg-[#0078D4] text-white"
                : "bg-[#333333] text-[#888888]"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { X, AlertCircle, CheckCircle2, Info, XCircle, RefreshCw } from "lucide-react";
import { useState, useEffect, createContext, useContext, useCallback } from "react";

// ==================== PROGRESS BAR ====================

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  sublabel?: string;
  showPercent?: boolean;
  className?: string;
  variant?: "default" | "success" | "warning" | "error";
  onCancel?: () => void;
  cancellable?: boolean;
}

export function ProgressBar({
  progress,
  label,
  sublabel,
  showPercent = true,
  className,
  variant = "default",
  onCancel,
  cancellable = false,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const variantStyles = {
    default: "bg-[#0078D4]",
    success: "bg-[#00C853]",
    warning: "bg-[#FFA500]",
    error: "bg-[#FF5252]",
  };

  return (
    <div className={cn("w-full", className)}>
      {(label || showPercent || cancellable) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-xs text-[#888888]">{label}</span>}
          <div className="flex items-center gap-2">
            {showPercent && (
              <span className="text-xs font-mono text-[#888888]">
                {clampedProgress.toFixed(0)}%
              </span>
            )}
            {cancellable && onCancel && (
              <button
                onClick={onCancel}
                className="p-1 hover:bg-[#3C3C3C] rounded transition-colors"
                title="Cancelar"
              >
                <X className="w-3 h-3 text-[#888888] hover:text-[#FF5252]" />
              </button>
            )}
          </div>
        </div>
      )}
      <div className="h-2 bg-[#333333] rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300 ease-out",
            variantStyles[variant]
          )}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {sublabel && (
        <div className="text-[10px] text-[#666666] mt-1">{sublabel}</div>
      )}
    </div>
  );
}

// ==================== TOAST SYSTEM ====================

interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Return a no-op implementation if context is not available
    return {
      toasts: [],
      addToast: (toast: Omit<Toast, "id">) => {
        console.log("Toast (no context):", toast);
      },
      removeToast: () => {},
    };
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    // Auto remove after duration
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-[#00C853]" />,
    error: <XCircle className="w-4 h-4 text-[#FF5252]" />,
    warning: <AlertCircle className="w-4 h-4 text-[#FFA500]" />,
    info: <Info className="w-4 h-4 text-[#0078D4]" />,
  };

  const borderStyles = {
    success: "border-[#00C853]/30",
    error: "border-[#FF5252]/30",
    warning: "border-[#FFA500]/30",
    info: "border-[#0078D4]/30",
  };

  const bgStyles = {
    success: "bg-[#00C853]/10",
    error: "bg-[#FF5252]/10",
    warning: "bg-[#FFA500]/10",
    info: "bg-[#0078D4]/10",
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border shadow-lg animate-slide-in",
        "bg-[#1E1E1E] border-[#3C3C3C]",
        borderStyles[toast.type],
        bgStyles[toast.type]
      )}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">{toast.title}</div>
        {toast.message && (
          <div className="text-xs text-[#888888] mt-0.5">{toast.message}</div>
        )}
      </div>
      <button
        onClick={onClose}
        className="p-1 hover:bg-[#333333] rounded transition-colors shrink-0"
      >
        <X className="w-3 h-3 text-[#888888]" />
      </button>
    </div>
  );
}

// ==================== EXECUTION OVERLAY ====================

interface ExecutionOverlayProps {
  isExecuting: boolean;
  progress?: number;
  currentStep?: string;
  onCancel?: () => void;
  error?: string | null;
  success?: boolean;
  successMessage?: string;
  indeterminate?: boolean; // Mostrar animación indeterminada cuando no hay progreso real
}

export function ExecutionOverlay({
  isExecuting,
  progress = 0,
  currentStep,
  onCancel,
  error,
  success,
  successMessage = "Backtest completado",
  indeterminate = false,
}: ExecutionOverlayProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  // Progress animado para modo indeterminado
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    if (success) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Animación de progreso indeterminado
  useEffect(() => {
    if (isExecuting && indeterminate) {
      const interval = setInterval(() => {
        setAnimatedProgress((prev) => {
          // Oscila entre 10% y 90%
          const next = prev >= 90 ? 10 : prev + Math.random() * 15;
          return next;
        });
      }, 800);
      return () => clearInterval(interval);
    } else {
      setAnimatedProgress(progress);
    }
  }, [isExecuting, indeterminate, progress]);

  if (!isExecuting && !error && !showSuccess) return null;

  const displayProgress = indeterminate ? animatedProgress : progress;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl">
        {error ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#FF5252]/20 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-[#FF5252]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#FF5252]">Error</h3>
              <p className="text-sm text-[#888888] mt-1">{error}</p>
            </div>
          </div>
        ) : showSuccess ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#00C853]/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-[#00C853]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#00C853]">¡Éxito!</h3>
              <p className="text-sm text-[#888888] mt-1">{successMessage}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border-3 border-[#0078D4] border-t-transparent rounded-full animate-spin" />
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white">Ejecutando Backtest</h3>
                {currentStep && (
                  <p className="text-xs text-[#888888] mt-0.5">{currentStep}</p>
                )}
              </div>
            </div>

            <ProgressBar
              progress={displayProgress}
              showPercent={!indeterminate}
              sublabel={indeterminate ? "Procesando señales..." : undefined}
              cancellable={!!onCancel}
              onCancel={onCancel}
            />

            {/* Info adicional */}
            <div className="flex items-center justify-center gap-2 text-[10px] text-[#666666] pt-2">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>El backtest puede tardar varios segundos</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// CSS animation for toasts
const style = typeof document !== "undefined" ? document.createElement("style") : null;
if (style) {
  style.textContent = `
    @keyframes slide-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    .animate-slide-in {
      animation: slide-in 0.3s ease-out;
    }
  `;
  document.head.appendChild(style);
}

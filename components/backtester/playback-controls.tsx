"use client";

import { cn } from "@/lib/utils";

interface PlaybackControlsProps {
  isPlaying: boolean;
  speed: number;
  progress: number;
  currentTime?: string;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek?: (progress: number) => void;
}

export function PlaybackControls({
  isPlaying,
  speed,
  progress,
  currentTime,
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
  onSeek,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-[#2D2D2D] border-b border-[#3C3C3C]">
      {/* Transport controls */}
      <div className="flex items-center gap-2">
        {/* Stop */}
        <button
          onClick={onStop}
          className="w-8 h-8 flex items-center justify-center rounded bg-[#333333] hover:bg-[#444444] transition-colors"
          title="Stop"
        >
          <div className="w-3 h-3 bg-[#FF5252] rounded-sm" />
        </button>

        {/* Play/Pause */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          className={cn(
            "w-10 h-10 flex items-center justify-center rounded-full transition-colors",
            isPlaying
              ? "bg-[#FF5252] hover:bg-[#FF6B6B]"
              : "bg-[#0078D4] hover:bg-[#1E90FF]"
          )}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-2 bg-[#333333] rounded-full overflow-hidden relative">
          <div
            className="h-full bg-[#0078D4] transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
          {onSeek && (
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          )}
        </div>
        {currentTime && (
          <span className="text-xs font-mono text-[#888888] min-w-[120px]">
            {currentTime}
          </span>
        )}
      </div>

      {/* Speed control */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#888888]">Speed:</span>
        <div className="flex items-center gap-1">
          {[1, 2, 4, 8, 16, 32, 50].map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={cn(
                "w-8 h-6 text-xs rounded transition-colors",
                speed === s
                  ? "bg-[#0078D4] text-white"
                  : "bg-[#333333] text-[#888888] hover:bg-[#444444] hover:text-white"
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-1 border-l border-[#3C3C3C] pl-4">
        <button
          className="w-7 h-7 flex items-center justify-center rounded bg-[#333333] hover:bg-[#444444] text-[#888888] hover:text-white text-sm transition-colors"
          title="Zoom Out"
        >
          −
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center rounded bg-[#333333] hover:bg-[#444444] text-[#888888] hover:text-white text-sm transition-colors"
          title="Zoom In"
        >
          +
        </button>
      </div>
    </div>
  );
}

// Status display for playback
export function PlaybackStatus({
  currentTrade,
  totalTrades,
  balance,
  equity,
  floatingPL,
}: {
  currentTrade: number;
  totalTrades: number;
  balance: number;
  equity: number;
  floatingPL: number;
}) {
  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-[#252526] border-b border-[#3C3C3C] text-xs">
      <div className="flex items-center gap-2">
        <span className="text-[#888888]">Trade:</span>
        <span className="font-mono text-white">
          {currentTrade} / {totalTrades}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[#888888]">Balance:</span>
        <span className="font-mono text-white">{balance.toFixed(2)}€</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[#888888]">Equity:</span>
        <span className={cn(
          "font-mono",
          equity >= balance ? "text-[#00C853]" : "text-[#FF5252]"
        )}>
          {equity.toFixed(2)}€
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[#888888]">Floating P/L:</span>
        <span className={cn(
          "font-mono font-semibold",
          floatingPL >= 0 ? "text-[#00C853]" : "text-[#FF5252]"
        )}>
          {floatingPL >= 0 ? "+" : ""}{floatingPL.toFixed(2)}€
        </span>
      </div>
    </div>
  );
}

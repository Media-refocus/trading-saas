// MT5-style backtester components
export { MT5Layout, MT5Panel, MT5StatusBar } from "./mt5-layout";
export { SettingsPanel } from "./settings-panel";
export { DealsTable } from "./deals-table";
export { PlaybackControls, PlaybackStatus } from "./playback-controls";
export { ResultsSummary } from "./results-summary";
export { JournalPanel, generateJournalFromResults } from "./journal-panel";
export { EquityGraph } from "./equity-graph";
export {
  PeriodSelector,
  PeriodSelectorMobile,
  getPeriodDateRange,
  type PeriodOption,
  type VisualizationMode,
} from "./period-selector";
export {
  EnhancedCandleViewer,
  useDemoCandles,
} from "./enhanced-candle-viewer";

/**
 * Sistema de jobs para backtests en background
 *
 * - Procesa backtests pesados sin bloquear el servidor
 * - Permite consultar progreso
 * - Maneja múltiples jobs concurrentes
 */

import type { BacktestResult, BacktestConfig } from "./backtest-engine";

export type JobStatus = "pending" | "running" | "completed" | "error" | "cancelled";

export interface BacktestJob {
  id: string;
  status: JobStatus;
  config: BacktestConfig;
  signalsSource: string;
  signalLimit?: number;

  // Progreso
  progress: number; // 0-100
  currentSignal: number;
  totalSignals: number;

  // Resultados
  results?: BacktestResult;
  error?: string;

  // Timestamps
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  // Metadatos
  priority: number; // Mayor = más prioridad
}

// Cola de jobs
const jobQueue: BacktestJob[] = [];
const activeJobs = new Map<string, BacktestJob>();
const completedJobs = new Map<string, BacktestJob>();

// Configuración
const MAX_CONCURRENT_JOBS = 2;
const MAX_COMPLETED_JOBS = 50; // Mantener últimos 50 completados

// Contador para IDs
let jobIdCounter = 0;

/**
 * Crea un nuevo job de backtest
 */
export function createJob(
  config: BacktestConfig,
  signalsSource: string,
  signalLimit?: number,
  priority: number = 0
): BacktestJob {
  const job: BacktestJob = {
    id: `job_${++jobIdCounter}_${Date.now()}`,
    status: "pending",
    config,
    signalsSource,
    signalLimit,
    progress: 0,
    currentSignal: 0,
    totalSignals: 0,
    createdAt: new Date(),
    priority,
  };

  // Insertar en cola ordenado por prioridad
  const insertIdx = jobQueue.findIndex(j => j.priority < priority);
  if (insertIdx === -1) {
    jobQueue.push(job);
  } else {
    jobQueue.splice(insertIdx, 0, job);
  }

  console.log(`[BacktestJobs] Job creado: ${job.id} (prioridad: ${priority})`);

  // Intentar procesar
  processQueue();

  return job;
}

/**
 * Obtiene un job por ID
 */
export function getJob(jobId: string): BacktestJob | undefined {
  return activeJobs.get(jobId) ||
         completedJobs.get(jobId) ||
         jobQueue.find(j => j.id === jobId);
}

/**
 * Obtiene todos los jobs activos
 */
export function getActiveJobs(): BacktestJob[] {
  return Array.from(activeJobs.values());
}

/**
 * Obtiene jobs en cola
 */
export function getQueuedJobs(): BacktestJob[] {
  return [...jobQueue];
}

/**
 * Obtiene jobs completados
 */
export function getCompletedJobs(): BacktestJob[] {
  return Array.from(completedJobs.values())
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
}

/**
 * Cancela un job
 */
export function cancelJob(jobId: string): boolean {
  // Buscar en cola
  const queueIdx = jobQueue.findIndex(j => j.id === jobId);
  if (queueIdx !== -1) {
    const job = jobQueue.splice(queueIdx, 1)[0];
    job.status = "cancelled";
    completedJobs.set(jobId, job);
    console.log(`[BacktestJobs] Job cancelado de cola: ${jobId}`);
    return true;
  }

  // Buscar en activos
  const activeJob = activeJobs.get(jobId);
  if (activeJob) {
    activeJob.status = "cancelled";
    // El procesador detectará el cambio y detendrá el job
    console.log(`[BacktestJobs] Job marcado para cancelación: ${jobId}`);
    return true;
  }

  return false;
}

/**
 * Procesa la cola de jobs
 */
async function processQueue(): Promise<void> {
  // Verificar si podemos iniciar más jobs
  if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
    return;
  }

  // Tomar siguiente job de la cola
  const job = jobQueue.shift();
  if (!job) {
    return;
  }

  // Mover a activos
  job.status = "running";
  job.startedAt = new Date();
  activeJobs.set(job.id, job);

  console.log(`[BacktestJobs] Iniciando job: ${job.id}`);

  // Ejecutar en background
  executeJob(job).catch(error => {
    console.error(`[BacktestJobs] Error en job ${job.id}:`, error);
  });

  // Intentar procesar más jobs
  processQueue();
}

/**
 * Ejecuta un job
 */
async function executeJob(job: BacktestJob): Promise<void> {
  try {
    // Importar dinámicamente para evitar dependencias circulares
    const { BacktestEngine } = await import("./backtest-engine");
    const { loadSignalsFromFile } = await import("./parsers/signals-csv");
    const { getTicksFromDB, getMarketPrice, isTicksDBReady } = await import("./ticks-db");
    const { getCachedResult, cacheResult } = await import("./backtest-cache");

    // Verificar cache primero
    const cached = getCachedResult(job.config, job.signalsSource);
    if (cached) {
      job.results = cached;
      job.progress = 100;
      completeJob(job);
      return;
    }

    // Verificar que SQLite tiene datos
    if (!(await isTicksDBReady())) {
      throw new Error("La base de datos de ticks no está lista. Ejecuta: npx tsx scripts/migrate-ticks-to-sqlite.ts");
    }

    // Cargar señales
    const path = await import("path");
    const signalsPath = path.join(process.cwd(), job.signalsSource);
    let signals = await loadSignalsFromFile(signalsPath);

    if (job.signalLimit) {
      signals = signals.slice(0, job.signalLimit);
    }

    job.totalSignals = signals.length;

    // Crear engine
    const engine = new BacktestEngine(job.config);

    // Procesar cada señal
    for (let i = 0; i < signals.length; i++) {
      // Verificar cancelación
      if (job.status === "cancelled") {
        console.log(`[BacktestJobs] Job cancelado: ${job.id}`);
        return;
      }

      const signal = signals[i];

      // Actualizar progreso
      job.currentSignal = i + 1;
      job.progress = Math.round((i / signals.length) * 100);

      // Iniciar señal
      engine.startSignal(signal.side, signal.entryPrice);
      engine.openInitialOrders(signal.entryPrice);

      // Obtener ticks del cache
      const endTime = signal.closeTimestamp
        ? new Date(Math.min(signal.closeTimestamp.getTime(), signal.timestamp.getTime() + 24 * 60 * 60 * 1000))
        : new Date(signal.timestamp.getTime() + 24 * 60 * 60 * 1000);

      const ticks = await getTicksFromDB(signal.timestamp, endTime);

      // Procesar ticks
      for (const tick of ticks) {
        engine.processTick(tick);
      }
    }

    // Obtener resultados
    job.results = engine.getResults();
    job.progress = 100;

    // Guardar en cache
    cacheResult(job.config, job.signalsSource, job.results);

    // Completar job
    completeJob(job);

  } catch (error) {
    console.error(`[BacktestJobs] Error en job ${job.id}:`, error);
    job.status = "error";
    job.error = error instanceof Error ? error.message : "Unknown error";
    completeJob(job);
  }
}

/**
 * Marca un job como completado
 */
function completeJob(job: BacktestJob): void {
  job.completedAt = new Date();

  if (job.status === "running") {
    job.status = "completed";
  }

  // Mover de activos a completados
  activeJobs.delete(job.id);
  completedJobs.set(job.id, job);

  // Limpiar completados antiguos
  if (completedJobs.size > MAX_COMPLETED_JOBS) {
    const oldest = Array.from(completedJobs.entries())
      .sort((a, b) => a[1].completedAt!.getTime() - b[1].completedAt!.getTime());

    for (let i = 0; i < oldest.length - MAX_COMPLETED_JOBS; i++) {
      completedJobs.delete(oldest[i][0]);
    }
  }

  const elapsed = job.completedAt.getTime() - (job.startedAt?.getTime() || job.createdAt.getTime());
  console.log(`[BacktestJobs] Job completado: ${job.id} (${job.status}, ${elapsed}ms)`);

  // Procesar siguiente en cola
  processQueue();
}

/**
 * Obtiene estadísticas del sistema de jobs
 */
export function getJobsStats(): {
  queued: number;
  active: number;
  completed: number;
  maxConcurrent: number;
} {
  return {
    queued: jobQueue.length,
    active: activeJobs.size,
    completed: completedJobs.size,
    maxConcurrent: MAX_CONCURRENT_JOBS,
  };
}

/**
 * Limpia jobs completados antiguos
 */
export function cleanupOldJobs(): void {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  let cleaned = 0;

  for (const [id, job] of completedJobs.entries()) {
    if (job.completedAt && job.completedAt.getTime() < oneHourAgo) {
      completedJobs.delete(id);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[BacktestJobs] Limpiados ${cleaned} jobs antiguos`);
  }
}

// Ejecutar limpieza cada hora
if (typeof setInterval !== "undefined") {
  setInterval(cleanupOldJobs, 60 * 60 * 1000);
}

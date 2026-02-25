/**
 * Tipos y constantes para el sistema de alertas
 */
import { prisma } from "@/lib/prisma";

// Tipos de alertas disponibles
export const ALERT_TYPES = {
  BOT_OFFLINE: "BOT_OFFLINE",
  BOT_ERROR: "BOT_ERROR",
  HIGH_DRAWDOWN: "HIGH_DRAWDOWN",
  SUBSCRIPTION_EXPIRING: "SUBSCRIPTION_EXPIRING",
} as const;

export type AlertType = (typeof ALERT_TYPES)[keyof typeof ALERT_TYPES];

export interface CreateAlertInput {
  tenantId: string;
  type: AlertType;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Crea una alerta en la base de datos
 */
export async function createAlert(
  tenantId: string,
  type: AlertType,
  message: string,
  metadata?: Record<string, unknown>
) {
  return prisma.alert.create({
    data: {
      tenantId,
      type,
      message,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
    },
  });
}

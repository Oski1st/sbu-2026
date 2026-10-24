import type { Connect } from "vite";
import type { ServerResponse } from "node:http";
export const SEPTA_PATH: string;
export const SEPTA_UPSTREAM: string;
export function sendJson(
  res: ServerResponse,
  status: number,
  value: unknown,
): void;
export function createSeptaProxy(options?: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Connect.NextHandleFunction;

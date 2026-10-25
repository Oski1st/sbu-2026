import type { Connect } from "vite";
export function createTimetableApi(options?: {
  getEngine?: () => Promise<unknown>;
}): Connect.NextHandleFunction;

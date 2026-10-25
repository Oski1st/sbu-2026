export type Point = readonly [number, number];
export interface Frame { x: number; y: number; width: number; height: number }

/** Albers equal-area with U.S. standard parallels, converted to SVG's downward Y. */
export function projectContiguous([longitude, latitude]: Point): Point {
  const radians = Math.PI / 180;
  const phi = latitude * radians;
  const phi1 = 29.5 * radians;
  const phi2 = 45.5 * radians;
  const n = (Math.sin(phi1) + Math.sin(phi2)) / 2;
  const c = Math.cos(phi1) ** 2 + 2 * n * Math.sin(phi1);
  const rho = Math.sqrt(c - 2 * n * Math.sin(phi)) / n;
  const rho0 = Math.sqrt(c - 2 * n * Math.sin(38 * radians)) / n;
  const theta = n * (longitude + 96) * radians;
  return [rho * Math.sin(theta), rho * Math.cos(theta) - rho0];
}

/** Unwrap Alaska's Aleutians around 180°; north is up in both geographic insets. */
export function projectInset([longitude, latitude]: Point): Point {
  return [longitude > 0 ? longitude - 360 : longitude, -latitude];
}

/** Uniform fit preserves aspect ratio and projection orientation. */
export function fitProjection(points: readonly Point[], frame: Frame) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min(frame.width / (maxX - minX), frame.height / (maxY - minY));
  const offsetX = frame.x + (frame.width - (maxX - minX) * scale) / 2;
  const offsetY = frame.y + (frame.height - (maxY - minY) * scale) / 2;
  return ([x, y]: Point): Point => [offsetX + (x - minX) * scale, offsetY + (y - minY) * scale];
}

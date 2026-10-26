/**
 * Geometría de la rejilla de agenda (columnas = peluqueros, eje Y = tiempo).
 * Convierte entre píxeles y minutos con "snap" a la granularidad configurada.
 */
export type GridConfig = { dayStartMin: number; dayEndMin: number; pxPerMin: number; snapMin: number };

export const DEFAULT_GRID: GridConfig = { dayStartMin: 8 * 60, dayEndMin: 21 * 60, pxPerMin: 1.6, snapMin: 15 };

export function minutesToPx(min: number, g: GridConfig = DEFAULT_GRID) {
  return (min - g.dayStartMin) * g.pxPerMin;
}

export function snap(min: number, g: GridConfig = DEFAULT_GRID) {
  return Math.round(min / g.snapMin) * g.snapMin;
}

/** Nueva hora de inicio tras arrastrar `deltaY` píxeles, acotada al día visible. */
export function dragToStart(originalStartMin: number, durationMin: number, deltaY: number, g: GridConfig = DEFAULT_GRID) {
  const raw = originalStartMin + deltaY / g.pxPerMin;
  const snapped = snap(raw, g);
  return Math.min(Math.max(snapped, g.dayStartMin), g.dayEndMin - durationMin);
}

export function hourMarks(g: GridConfig = DEFAULT_GRID) {
  const marks: number[] = [];
  for (let m = Math.ceil(g.dayStartMin / 60) * 60; m <= g.dayEndMin; m += 60) marks.push(m);
  return marks;
}

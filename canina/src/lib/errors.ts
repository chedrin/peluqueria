/** Error de dominio con código estable, apto para mostrar al usuario. */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; details?: unknown };

/** Envuelve una server action para devolver errores de dominio en vez de lanzar. */
export async function toActionResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, code: e.code, message: e.message, details: e.details };
    console.error(e);
    return { ok: false, code: "UNEXPECTED", message: "Ha ocurrido un error inesperado." };
  }
}

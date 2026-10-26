/**
 * Validación de identificadores fiscales españoles: DNI, NIE y CIF/NIF de entidades.
 * Algoritmos oficiales (Orden EHA/451/2008 y RD 1065/2007).
 */
const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

export function normalizeTaxId(raw: string): string {
  return raw.toUpperCase().replace(/[\s.-]/g, "");
}

export function isValidDni(id: string): boolean {
  const m = /^(\d{8})([A-Z])$/.exec(id);
  return !!m && DNI_LETTERS[Number(m[1]) % 23] === m[2];
}

export function isValidNie(id: string): boolean {
  const m = /^([XYZ])(\d{7})([A-Z])$/.exec(id);
  if (!m) return false;
  const prefix = { X: "0", Y: "1", Z: "2" }[m[1] as "X" | "Y" | "Z"];
  return DNI_LETTERS[Number(prefix + m[2]) % 23] === m[3];
}

export function isValidCif(id: string): boolean {
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(id);
  if (!m) return false;
  const digits = m[2].split("").map(Number);
  let sum = 0;
  digits.forEach((d, i) => {
    if (i % 2 === 0) {
      const x = d * 2;
      sum += Math.floor(x / 10) + (x % 10);
    } else sum += d;
  });
  const control = (10 - (sum % 10)) % 10;
  const letter = "JABCDEFGHI"[control];
  const kind = m[1];
  // Entidades que siempre usan letra / siempre número / cualquiera
  if ("PQRSNW".includes(kind)) return m[3] === letter;
  if ("ABEH".includes(kind)) return m[3] === String(control);
  return m[3] === String(control) || m[3] === letter;
}

export function isValidSpanishTaxId(raw: string): boolean {
  const id = normalizeTaxId(raw);
  return isValidDni(id) || isValidNie(id) || isValidCif(id);
}

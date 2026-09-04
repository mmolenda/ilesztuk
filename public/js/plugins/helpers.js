export function requirePieces(input, ValidationError) {
  const pieces = Array.isArray(input?.pieces) ? input.pieces : [];
  if (pieces.length === 0) {
    throw new ValidationError("Dodaj przynajmniej jeden element.");
  }
  return pieces;
}

export function aggregatePieces(pieces, keyForPiece) {
  const byKey = new Map();

  for (const piece of pieces) {
    const key = keyForPiece(piece);
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity += piece.quantity;
    } else {
      byKey.set(key, { ...piece });
    }
  }

  return [...byKey.values()];
}

export function parsePositiveInteger(value, label, ValidationError) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new ValidationError(`${label} musi być liczbą całkowitą większą od 0.`);
  }
  return number;
}

export function parsePositiveNumber(value, label, ValidationError) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new ValidationError(`${label} musi być liczbą większą od 0.`);
  }
  return number;
}

export function roundByPolicy(value, policy) {
  if (policy === "round") {
    return Math.round(value);
  }
  if (policy === "floor") {
    return Math.floor(value);
  }
  return Math.ceil(value);
}

export function roundDecimal(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function formatMetric(value) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 4 }).format(value);
}

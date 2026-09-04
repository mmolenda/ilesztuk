import {
  aggregatePieces,
  formatMetric,
  parsePositiveInteger,
  parsePositiveNumber,
  requirePieces,
  roundByPolicy,
  roundDecimal,
} from "./helpers.js?v=20260904-1447";
import { formatPiecesQuantity } from "../formatting.js?v=20260904-1447";

export const RECTANGULAR_PIECES_PLUGIN = "rectangular_pieces";

export const DEFAULT_RECTANGULAR_CONFIG = Object.freeze({
  // displayUnit options: cm, m
  displayUnit: "cm",
  dimensions: {
    first: { key: "width", label: "Szerokość", allowedValuesCm: null },
    second: { key: "height", label: "Wysokość", allowedValuesCm: null },
    noteOrder: ["width", "height"],
    // rounding.mode options: ceil, floor, round
    rounding: { enabled: false, mode: "ceil", precision: 0 },
  },
  pricing: {
    // areaUnit options: cm2, m2
    areaUnit: "cm2",
    coefficient: 0.01,
  },
  rowArea: {
    // rounding.mode options: ceil, floor, round
    rounding: { enabled: false, mode: "round", precision: 2 },
  },
  totalArea: {
    // rounding.mode options: ceil, floor, round
    rounding: { enabled: false, mode: "round", precision: 2 },
  },
  purchasableQuantity: {
    // rounding.mode options: ceil, floor, round
    rounding: { mode: "ceil", precision: 0 },
  },
  edges: {
    enabled: false,
    label: "Oklejenie",
    default: [],
    minFinishEdgeCm: null,
  },
  customFields: [],
  constraints: {
    minFirstCm: 0.01,
    minSecondCm: 0.01,
    maxFirstCm: null,
    maxSecondCm: null,
    maxPerimeterCm: null,
    enforceSecondNotGreaterThanFirst: false,
  },
});

export const MAX_PIECE_QUANTITY = 10_000;

export function dimensionKeyForEdge(edge) {
  return edge === "left" || edge === "right" ? "length" : "width";
}

export const rectangularPiecesPlugin = Object.freeze({
  label: "Elementy prostokątne",
  validateInput,
  calculate,
  formatPieceLine,
  createMarketplaceNote,
  sellerMetrics,
});

export function rectangularConfig(config = {}) {
  return {
    ...DEFAULT_RECTANGULAR_CONFIG,
    ...config,
    dimensions: {
      ...DEFAULT_RECTANGULAR_CONFIG.dimensions,
      ...config.dimensions,
      first: {
        ...DEFAULT_RECTANGULAR_CONFIG.dimensions.first,
        ...config.dimensions?.first,
      },
      second: {
        ...DEFAULT_RECTANGULAR_CONFIG.dimensions.second,
        ...config.dimensions?.second,
      },
      rounding: {
        ...DEFAULT_RECTANGULAR_CONFIG.dimensions.rounding,
        ...config.dimensions?.rounding,
      },
    },
    pricing: {
      ...DEFAULT_RECTANGULAR_CONFIG.pricing,
      ...config.pricing,
    },
    rowArea: {
      ...DEFAULT_RECTANGULAR_CONFIG.rowArea,
      ...config.rowArea,
      rounding: {
        ...DEFAULT_RECTANGULAR_CONFIG.rowArea.rounding,
        ...config.rowArea?.rounding,
      },
    },
    totalArea: {
      ...DEFAULT_RECTANGULAR_CONFIG.totalArea,
      ...config.totalArea,
      rounding: {
        ...DEFAULT_RECTANGULAR_CONFIG.totalArea.rounding,
        ...config.totalArea?.rounding,
      },
    },
    purchasableQuantity: {
      ...DEFAULT_RECTANGULAR_CONFIG.purchasableQuantity,
      ...config.purchasableQuantity,
      rounding: {
        ...DEFAULT_RECTANGULAR_CONFIG.purchasableQuantity.rounding,
        ...config.purchasableQuantity?.rounding,
      },
    },
    edges: {
      ...DEFAULT_RECTANGULAR_CONFIG.edges,
      ...config.edges,
    },
    customFields: normalizeCustomFieldDefinitions(config.customFields),
    constraints: {
      ...DEFAULT_RECTANGULAR_CONFIG.constraints,
      ...config.constraints,
    },
  };
}

function validateInput(input, calculator, { ValidationError }) {
  const pieces = requirePieces(input, ValidationError);
  const config = rectangularConfig(calculator.configuration);
  const firstDimension = config.dimensions.first;
  const secondDimension = config.dimensions.second;

  return {
    pieces: pieces.map((piece, index) => {
      const rowLabel = `Wiersz ${index + 1}`;
      const quantity = parseQuantity(piece.quantity, `Ilość w wierszu ${index + 1}`, ValidationError);
      const firstValue = toCentimeters(parsePositiveNumber(
        piece[firstDimension.key],
        `${firstDimension.label} w wierszu ${index + 1}`,
        ValidationError,
      ), config.displayUnit);
      const secondValue = toCentimeters(parsePositiveNumber(
        piece[secondDimension.key],
        `${secondDimension.label} w wierszu ${index + 1}`,
        ValidationError,
      ), config.displayUnit);
      const dimensions = {
        [firstDimension.key]: firstValue,
        [secondDimension.key]: secondValue,
      };
      const edges = config.edges.enabled ? normalizeEdges(piece.edges) : [];
      const customFields = collectCustomFields(piece, config);

      validateConstraints({
        rowLabel,
        firstDimension,
        firstValue,
        secondDimension,
        secondValue,
        firstKey: firstDimension.key,
        secondKey: secondDimension.key,
        edges,
        customFields,
        config,
        ValidationError,
      });

      return {
        quantity,
        ...dimensions,
        edges,
        customFields,
        unit: config.displayUnit,
      };
    }),
    unit: config.displayUnit,
  };
}

function parseQuantity(value, label, ValidationError) {
  const quantity = parsePositiveInteger(value, label, ValidationError);
  if (quantity > MAX_PIECE_QUANTITY) {
    throw new ValidationError(`${label} nie może przekroczyć ${MAX_PIECE_QUANTITY.toLocaleString("pl-PL")}.`);
  }
  return quantity;
}

function calculate(validatedInput, calculator) {
  const config = rectangularConfig(calculator.configuration);
  const rowDetails = validatedInput.pieces.map((piece) => calculateRow(piece, config));
  const totalAreaBase = sum(rowDetails.map((row) => row.areaForTotal));
  const totalAreaForPricing = applyOptionalRounding(totalAreaBase, config.totalArea.rounding);
  const rawPurchasableItems = priceArea(totalAreaForPricing, config.pricing);

  return {
    pieces: aggregatePieces(validatedInput.pieces, (piece) => pieceKey(piece, config)),
    rows: rowDetails,
    areaUnit: config.pricing.areaUnit,
    displayUnit: config.displayUnit,
    dimensionLabels: {
      first: config.dimensions.first.label,
      second: config.dimensions.second.label,
    },
    totalArea: roundDecimal(sum(rowDetails.map((row) => row.rawArea)), 4),
    totalAreaForPricing: roundDecimal(totalAreaForPricing, 4),
    totalCoatedEdgeCm: roundDecimal(sum(rowDetails.map((row) => row.coatedEdgeCm)), 2),
    pricing: structuredClone(config.pricing),
    rounding: {
      dimensions: structuredClone(config.dimensions.rounding),
      rowArea: structuredClone(config.rowArea.rounding),
      totalArea: structuredClone(config.totalArea.rounding),
      purchasableQuantity: structuredClone(config.purchasableQuantity.rounding),
    },
    limits: {
      minFirstCm: config.constraints.minFirstCm,
      minSecondCm: config.constraints.minSecondCm,
      minFinishEdgeCm: config.edges.minFinishEdgeCm,
      maxFirstCm: config.constraints.maxFirstCm,
      maxSecondCm: config.constraints.maxSecondCm,
      maxPerimeterCm: config.constraints.maxPerimeterCm,
    },
    rawPurchasableItems: roundDecimal(rawPurchasableItems, 4),
    purchasableItems: Math.max(1, applyRounding(rawPurchasableItems, config.purchasableQuantity.rounding)),
  };
}

function calculateRow(piece, config) {
  const firstKey = config.dimensions.first.key;
  const secondKey = config.dimensions.second.key;
  const rawFirstCm = piece[firstKey];
  const rawSecondCm = piece[secondKey];
  const roundedFirstCm = applyOptionalRounding(rawFirstCm, config.dimensions.rounding);
  const roundedSecondCm = applyOptionalRounding(rawSecondCm, config.dimensions.rounding);
  const rawArea = areaInConfiguredUnit(rawFirstCm, rawSecondCm, piece.quantity, config.pricing.areaUnit);
  const rawAreaForPricing = areaInConfiguredUnit(roundedFirstCm, roundedSecondCm, piece.quantity, config.pricing.areaUnit);
  const areaForTotal = applyOptionalRounding(rawAreaForPricing, config.rowArea.rounding);

  return {
    quantity: piece.quantity,
    dimensionsCm: {
      [firstKey]: rawFirstCm,
      [secondKey]: rawSecondCm,
    },
    roundedDimensionsCm: {
      [firstKey]: roundedFirstCm,
      [secondKey]: roundedSecondCm,
    },
    rawArea: roundDecimal(rawArea, 4),
    rawAreaForPricing: roundDecimal(rawAreaForPricing, 4),
    areaForTotal: roundDecimal(areaForTotal, 4),
    coatedEdgeCm: roundDecimal(coatedEdgeLength(piece, config), 2),
  };
}

function validateConstraints({
  rowLabel,
  firstDimension,
  firstValue,
  secondDimension,
  secondValue,
  firstKey,
  secondKey,
  edges,
  customFields,
  config,
  ValidationError,
}) {
  validateDimensionLimits(rowLabel, firstDimension, firstValue, config.constraints.minFirstCm, config.constraints.maxFirstCm, config, ValidationError);
  validateDimensionLimits(rowLabel, secondDimension, secondValue, config.constraints.minSecondCm, config.constraints.maxSecondCm, config, ValidationError);
  validateAllowedDimensionValue(rowLabel, firstDimension, firstValue, config, ValidationError);
  validateAllowedDimensionValue(rowLabel, secondDimension, secondValue, config, ValidationError);

  if (config.constraints.enforceSecondNotGreaterThanFirst && secondValue > firstValue) {
    throw new ValidationError(`${rowLabel}: ${dimensionLabel(secondKey, config).toLowerCase()} nie może być większa niż ${dimensionLabel(firstKey, config).toLowerCase()}.`);
  }

  const perimeter = 2 * (firstValue + secondValue);
  if (config.constraints.maxPerimeterCm && perimeter > config.constraints.maxPerimeterCm) {
    throw new ValidationError(`${rowLabel}: suma boków jednej formatki nie może przekroczyć ${formatLength(config.constraints.maxPerimeterCm, config)}.`);
  }
  validateCustomFields(rowLabel, customFields, config.customFields, ValidationError);

  for (const edge of edges) {
    const edgeLength = dimensionValue(
      dimensionKeyForEdge(edge),
      { [firstKey]: firstValue, [secondKey]: secondValue },
      config,
    );
    if (config.edges.minFinishEdgeCm && edgeLength < config.edges.minFinishEdgeCm) {
      throw new ValidationError(`${rowLabel}: wykańczany bok musi mieć minimum ${formatLength(config.edges.minFinishEdgeCm, config)}.`);
    }
  }
}

function validateDimensionLimits(rowLabel, dimension, value, minimum, maximum, config, ValidationError) {
  if (minimum && value < minimum) {
    throw new ValidationError(`${rowLabel}: ${dimension.label.toLowerCase()} musi mieć minimum ${formatLength(minimum, config)}.`);
  }
  if (maximum && value > maximum) {
    throw new ValidationError(`${rowLabel}: ${dimension.label.toLowerCase()} nie może przekroczyć ${formatLength(maximum, config)}.`);
  }
}

function validateAllowedDimensionValue(rowLabel, dimension, value, config, ValidationError) {
  if (!Array.isArray(dimension.allowedValuesCm) || dimension.allowedValuesCm.length === 0) {
    return;
  }

  const allowed = dimension.allowedValuesCm.some((allowedValue) => Math.abs(Number(allowedValue) - value) < 0.000001);
  if (!allowed) {
    throw new ValidationError(
      `${rowLabel}: ${dimension.label.toLowerCase()} musi mieć jedną z wartości: ${dimension.allowedValuesCm.map((allowedValue) => formatLength(allowedValue, config)).join(", ")}.`,
    );
  }
}

function createMarketplaceNote(result, calculator) {
  return [
    ...result.pieces.map((piece) => formatPieceForCalculator(piece, calculator)),
  ].join("\n");
}

function formatPieceLine(piece, calculator = null) {
  if (calculator) {
    return formatPieceForCalculator(piece, calculator);
  }
  return formatPiece(piece, DEFAULT_RECTANGULAR_CONFIG.dimensions.noteOrder, { edges: { enabled: false }, customFields: [] });
}

function formatPieceForCalculator(piece, calculator) {
  const config = rectangularConfig(calculator.configuration);
  return formatPiece(piece, config.dimensions.noteOrder, config);
}

function formatPiece(piece, noteOrder, config) {
  const [firstKey, secondKey] = noteOrder;
  const edgeText = config.edges.enabled ? formatEdges(piece.edges, config.edges.label) : "";
  const customFieldsText = formatCustomFields(piece.customFields);
  return `${piece.quantity}x ${formatLength(piece[firstKey], config)} x ${formatLength(piece[secondKey], config)}${edgeText}${customFieldsText}`;
}

function sellerMetrics(result) {
  return [
    ["Łączna powierzchnia", `${formatMetric(result.totalArea)} ${areaUnitLabel(result.areaUnit)}`],
    result.totalAreaForPricing !== result.totalArea
      ? ["Powierzchnia po zaokrągleniach", `${formatMetric(result.totalAreaForPricing)} ${areaUnitLabel(result.areaUnit)}`]
      : null,
    result.totalCoatedEdgeCm ? ["Łączna długość oklejenia", formatLength(result.totalCoatedEdgeCm, { displayUnit: result.displayUnit })] : null,
    pricingMetric(result.pricing),
    result.limits.maxPerimeterCm ? ["Limit sumy boków", formatLength(result.limits.maxPerimeterCm, { displayUnit: result.displayUnit })] : null,
    result.limits.maxFirstCm ? [`Maks. ${result.dimensionLabels?.first ?? "pierwszy wymiar"}`, formatLength(result.limits.maxFirstCm, { displayUnit: result.displayUnit })] : null,
    result.limits.maxSecondCm ? [`Maks. ${result.dimensionLabels?.second ?? "drugi wymiar"}`, formatLength(result.limits.maxSecondCm, { displayUnit: result.displayUnit })] : null,
    ["Wynik", formatPiecesQuantity(result.purchasableItems)],
  ].filter(Boolean);
}

function priceArea(area, pricing) {
  return area * pricing.coefficient;
}

function areaInConfiguredUnit(firstCm, secondCm, quantity, areaUnit) {
  const areaCm2 = firstCm * secondCm * quantity;
  if (areaUnit === "m2") {
    return areaCm2 / 10_000;
  }
  return areaCm2;
}

function toCentimeters(value, unit) {
  return value * unitToCentimeterFactor(unit);
}

function fromCentimeters(valueCm, unit) {
  return valueCm / unitToCentimeterFactor(unit);
}

function unitToCentimeterFactor(unit) {
  return unit === "m" ? 100 : 1;
}

function formatLength(valueCm, config = DEFAULT_RECTANGULAR_CONFIG) {
  const unit = config.displayUnit ?? "cm";
  return `${formatMetric(fromCentimeters(valueCm, unit))} ${unit}`;
}

function applyOptionalRounding(value, rounding) {
  return rounding?.enabled ? applyRounding(value, rounding) : value;
}

function applyRounding(value, rounding) {
  const factor = 10 ** (rounding?.precision ?? 0);
  return roundByPolicy(value * factor, rounding?.mode ?? "round") / factor;
}

function pieceKey(piece, config) {
  return [
    ...config.dimensions.noteOrder.map((key) => piece[key]),
    piece.unit,
    piece.edges?.join(",") ?? "",
    ...(piece.customFields ?? []).map((field) => `${field.label}:${field.value}`),
  ].join(":");
}

function normalizeCustomFieldDefinitions(fields) {
  if (!Array.isArray(fields)) {
    return [];
  }
  return fields.map((field) => ({
    label: String(field?.label ?? "").trim(),
    required: Boolean(field?.required),
    allowedValues: Array.isArray(field?.allowedValues)
      ? field.allowedValues.map((value) => String(value))
      : Array.isArray(field?.allowedvalues)
        ? field.allowedvalues.map((value) => String(value))
        : [],
  })).filter((field) => field.label);
}

function collectCustomFields(piece, config) {
  return config.customFields.map((definition, index) => ({
    label: definition.label,
    value: String(piece.customFields?.[index]?.value ?? piece.customFields?.[index] ?? "").trim(),
  }));
}

function validateCustomFields(rowLabel, fields, definitions, ValidationError) {
  fields.forEach((field, index) => {
    const definition = definitions[index];
    if (definition.required && !field.value) {
      throw new ValidationError(`${rowLabel}: podaj ${definition.label.toLowerCase()}.`);
    }
    if (field.value && definition.allowedValues.length > 0 && !definition.allowedValues.includes(field.value)) {
      throw new ValidationError(`${rowLabel}: ${definition.label.toLowerCase()} wybierz z listy dostępnych wartości.`);
    }
  });
}

function formatCustomFields(fields = []) {
  const values = fields
    .filter((field) => field.value)
    .map((field) => `, ${field.label.toLowerCase()}: ${field.value}`);
  return values.join("");
}

function normalizeEdges(value) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(",");
  const allowed = new Set(["top", "right", "bottom", "left"]);
  const ordered = ["top", "right", "bottom", "left"];
  const selected = new Set(
    source.map((edge) => String(edge).trim()).filter((edge) => allowed.has(edge)),
  );
  return ordered.filter((edge) => selected.has(edge));
}

function coatedEdgeLength(piece, config) {
  return piece.edges.reduce((total, edge) => {
    return total + dimensionValue(dimensionKeyForEdge(edge), piece, config);
  }, 0);
}

function dimensionValue(key, piece, config = DEFAULT_RECTANGULAR_CONFIG) {
  if (piece[key] !== undefined) {
    return piece[key];
  }
  if (key === "length") {
    return piece[config.dimensions.first.key] ?? piece[config.dimensions.second.key];
  }
  if (key === "width") {
    return piece.width ?? piece[config.dimensions.second.key] ?? piece[config.dimensions.first.key];
  }
  return piece[key];
}

function dimensionLabel(key, config) {
  if (config.dimensions.first.key === key) {
    return config.dimensions.first.label;
  }
  if (config.dimensions.second.key === key) {
    return config.dimensions.second.label;
  }
  return key;
}

function formatEdges(edges, label = "Oklejenie") {
  const edgeLabel = String(label).trim() || "Oklejenie";
  if (edges.length === 4) {
    return `, ${edgeLabel}: dookoła`;
  }
  if (edges.length > 0) {
    return `, ${edgeLabel}: ${edges.map(edgeLabelForPiece).join(", ")}`;
  }
  return `, ${edgeLabel}: brak`;
}

function edgeLabelForPiece(edge) {
  return {
    top: "góra",
    right: "prawy",
    bottom: "dół",
    left: "lewy",
  }[edge];
}

function pricingMetric(pricing) {
  return ["Współczynnik", formatMetric(pricing.coefficient)];
}

function areaUnitLabel(areaUnit) {
  return areaUnit === "m2" ? "m²" : "cm²";
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

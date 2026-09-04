export const CALCULATOR_ID_RE = /^[A-Za-z0-9]{12}$/;

export async function loadCalculator(calculatorId) {
  if (!isValidCalculatorId(calculatorId)) {
    return null;
  }

  const response = await fetch(`/calculators/${calculatorId}.json`);
  if (!response.ok) {
    return null;
  }

  const calculator = normalizeCalculator(await response.json(), `${calculatorId}.json`);
  return calculator.calculatorId === calculatorId ? calculator : null;
}

export function isValidCalculatorId(calculatorId) {
  return typeof calculatorId === "string" && CALCULATOR_ID_RE.test(calculatorId);
}

export function normalizeCalculator(rawCalculator, source = "calculator") {
  const requiredStringFields = ["customerId", "customerName", "calculatorId", "calculatorName", "plugin"];
  for (const field of requiredStringFields) {
    if (typeof rawCalculator[field] !== "string" || rawCalculator[field].trim() === "") {
      throw new Error(`${source}: ${field} must be a non-empty string`);
    }
  }
  if (!isValidCalculatorId(rawCalculator.calculatorId)) {
    throw new Error(`${source}: calculatorId must be a 12-character base62 string`);
  }
  if (!rawCalculator.configuration || typeof rawCalculator.configuration !== "object" || Array.isArray(rawCalculator.configuration)) {
    throw new Error(`${source}: configuration must be an object`);
  }

  return Object.freeze({
    customerId: rawCalculator.customerId,
    customerName: rawCalculator.customerName,
    calculatorId: rawCalculator.calculatorId,
    calculatorName: rawCalculator.calculatorName,
    plugin: rawCalculator.plugin,
    configuration: structuredClone(rawCalculator.configuration),
  });
}

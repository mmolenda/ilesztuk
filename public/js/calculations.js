import { PLUGINS } from "./plugins/index.js";

export { PLUGINS };

export function calculateForCalculator(input, calculator) {
  const plugin = pluginFor(calculator);
  const validatedInput = plugin.validateInput(input, calculator, { ValidationError });
  const result = plugin.calculate(validatedInput, calculator, { ValidationError });
  const marketplaceNote = plugin.createMarketplaceNote(result, calculator, { ValidationError });

  return {
    input: validatedInput,
    result,
    marketplaceNote,
  };
}

export function validateBuyerInput(input, calculator) {
  return pluginFor(calculator).validateInput(input, calculator, { ValidationError });
}

export function calculateResult(validatedInput, calculator) {
  return pluginFor(calculator).calculate(validatedInput, calculator, { ValidationError });
}

export function createMarketplaceNote(result, calculator) {
  return pluginFor(calculator).createMarketplaceNote(result, calculator, { ValidationError });
}

export function formatPieceLine(piece, plugin = "rectangular_pieces") {
  return pluginFor({ plugin }).formatPieceLine(piece);
}

export function formatResultPieceLine(piece, calculator) {
  return pluginFor(calculator).formatPieceLine(piece, calculator);
}

export function sellerMetricsFor(result, calculator) {
  return pluginFor(calculator).sellerMetrics(result, calculator);
}

export function pluginFor(calculator) {
  const plugin = PLUGINS[calculator.plugin];
  if (!plugin) {
    throw new ValidationError(`Nieobsługiwany typ kalkulacji: ${calculator.plugin}`);
  }
  return plugin;
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

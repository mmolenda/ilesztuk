import { PLUGINS } from "./plugins/index.js";

export { PLUGINS };

export function calculateOffer(input, offer) {
  const plugin = pluginFor(offer);
  const validatedInput = plugin.validateInput(input, offer, { ValidationError });
  const result = plugin.calculate(validatedInput, offer, { ValidationError });
  const marketplaceNote = plugin.createMarketplaceNote(result, offer, { ValidationError });

  return {
    input: validatedInput,
    result,
    marketplaceNote,
  };
}

export function validateBuyerInput(input, offer) {
  return pluginFor(offer).validateInput(input, offer, { ValidationError });
}

export function calculateResult(validatedInput, offer) {
  return pluginFor(offer).calculate(validatedInput, offer, { ValidationError });
}

export function createMarketplaceNote(result, offer) {
  return pluginFor(offer).createMarketplaceNote(result, offer, { ValidationError });
}

export function formatPieceLine(piece, plugin = "rectangular_pieces") {
  return pluginFor({ plugin }).formatPieceLine(piece);
}

export function formatResultPieceLine(piece, offer) {
  return pluginFor(offer).formatPieceLine(piece, offer);
}

export function sellerMetricsFor(result, offer) {
  return pluginFor(offer).sellerMetrics(result, offer);
}

export function pluginFor(offer) {
  const plugin = PLUGINS[offer.plugin];
  if (!plugin) {
    throw new ValidationError(`Nieobsługiwany typ kalkulacji: ${offer.plugin}`);
  }
  return plugin;
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

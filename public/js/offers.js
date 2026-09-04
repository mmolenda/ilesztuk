export async function loadOfferManifest() {
  const response = await fetch("/offers/index.json");
  if (!response.ok) {
    throw new Error("Nie udało się załadować listy ofert.");
  }
  const entries = await response.json();
  return entries.map(normalizeManifestEntry);
}

export async function loadOffer(offerId) {
  const manifest = await loadOfferManifest();
  const entry = manifest.find((offer) => offer.offerId === offerId);
  if (!entry) {
    return null;
  }

  const response = await fetch(`/offers/${encodeURIComponent(entry.file)}`);
  if (!response.ok) {
    throw new Error("Nie udało się załadować oferty.");
  }
  return normalizeOffer(await response.json(), entry.file);
}

export async function loadCustomerOffers(customerId) {
  const manifest = await loadOfferManifest();
  return manifest.filter((offer) => offer.customerId === customerId);
}

export function normalizeOffer(rawOffer, source = "offer") {
  const requiredStringFields = ["customerId", "customerName", "offerId", "offerName", "plugin"];
  for (const field of requiredStringFields) {
    if (typeof rawOffer[field] !== "string" || rawOffer[field].trim() === "") {
      throw new Error(`${source}: ${field} must be a non-empty string`);
    }
  }
  if (!rawOffer.configuration || typeof rawOffer.configuration !== "object" || Array.isArray(rawOffer.configuration)) {
    throw new Error(`${source}: configuration must be an object`);
  }

  return Object.freeze({
    customerId: rawOffer.customerId,
    customerName: rawOffer.customerName,
    offerId: rawOffer.offerId,
    offerName: rawOffer.offerName,
    plugin: rawOffer.plugin,
    configuration: structuredClone(rawOffer.configuration),
  });
}

function normalizeManifestEntry(entry) {
  for (const field of ["offerId", "offerName", "customerId", "customerName", "file"]) {
    if (typeof entry[field] !== "string" || entry[field].trim() === "") {
      throw new Error(`offers/index.json: ${field} must be a non-empty string`);
    }
  }
  return Object.freeze({ ...entry });
}

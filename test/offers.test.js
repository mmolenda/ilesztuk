import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { normalizeOffer } from "../public/js/offers.js";

const offersDir = path.join(process.cwd(), "public", "offers");

describe("static offers", () => {
  it("loads the manifest and every referenced offer file", async () => {
    const manifest = JSON.parse(await readFile(path.join(offersDir, "index.json"), "utf8"));
    const offerIds = new Set();

    for (const entry of manifest) {
      assert.equal(typeof entry.offerId, "string");
      assert.equal(typeof entry.customerId, "string");
      assert.equal(typeof entry.file, "string");
      assert.equal(offerIds.has(entry.offerId), false);
      offerIds.add(entry.offerId);

      const offer = normalizeOffer(
        JSON.parse(await readFile(path.join(offersDir, entry.file), "utf8")),
        entry.file,
      );

      assert.equal(offer.offerId, entry.offerId);
      assert.equal(offer.customerId, entry.customerId);
      assert.equal(offer.offerName, entry.offerName);
      assert.equal(offer.customerName, entry.customerName);
    }
  });

  it("lists offers for a customer id through the manifest", async () => {
    const manifest = JSON.parse(await readFile(path.join(offersDir, "index.json"), "utf8"));
    const offers = manifest.filter((offer) => offer.customerId === "ilesztuk-demo");

    assert.ok(offers.length >= 1);
    assert.ok(offers.every((offer) => offer.customerId === "ilesztuk-demo"));
  });

  it("requires the json offer shape", () => {
    assert.throws(
      () => normalizeOffer({
        customerId: "seller-a",
        customerName: "Seller A",
        offerId: "offer-a",
        offerName: "Offer A",
        plugin: "rectangular_pieces",
      }),
      /configuration must be an object/,
    );
  });
});

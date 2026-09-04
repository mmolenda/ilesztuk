import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateOffer,
  createMarketplaceNote,
  formatPieceLine,
  formatResultPieceLine,
  validateBuyerInput,
  ValidationError,
} from "../public/js/calculations.js";

const areaOffer = Object.freeze({
  customerId: "demo",
  customerName: "Demo",
  offerId: "area-offer",
  offerName: "Sklejka 18 mm",
  plugin: "rectangular_pieces",
  configuration: {
    pricing: {
      areaUnit: "m2",
      mode: "divide_by_coefficient",
      coefficient: 0.8,
    },
  },
});

const furnitureOffer = Object.freeze({
  customerId: "demo",
  customerName: "Demo",
  offerId: "furniture-offer",
  offerName: "Formatki meblowe",
  plugin: "rectangular_pieces",
  configuration: {
    dimensions: {
      first: { key: "length", label: "Długość" },
      second: { key: "width", label: "Szerokość" },
      noteOrder: ["length", "width"],
    },
    pricing: {
      areaUnit: "cm2",
      mode: "divide_by_area_per_item",
      areaPerItemCm2: 100,
    },
    purchasableQuantity: {
      rounding: { mode: "round", precision: 0 },
    },
    edges: {
      enabled: true,
      minCoatedEdgeCm: 8,
    },
    constraints: {
      minDimensionCm: 8,
      maxPerimeterCm: 460,
      enforceSecondNotGreaterThanFirst: false,
    },
  },
});

describe("marketplace note", () => {
  it("aggregates identical pieces and contains only order-note content", () => {
    const calculation = calculateOffer({
      pieces: [
        { quantity: 2, width: 30, height: 45 },
        { quantity: 1, width: 30, height: 45 },
        { quantity: 1, width: 50, height: 60 },
      ],
    }, areaOffer);

    assert.equal(calculation.marketplaceNote, [
      "3x 30 cm x 45 cm",
      "1x 50 cm x 60 cm",
    ].join("\n"));
    assert.equal(calculation.marketplaceNote.includes("http"), false);
  });

  it("formats compact piece lines", () => {
    assert.equal(formatPieceLine({ quantity: 3, width: 20, height: 80, unit: "cm" }), "3x 20 cm x 80 cm");
  });

  it("formats compact piece lines using offer dimension order", () => {
    assert.equal(
      formatResultPieceLine({ quantity: 1, length: 52, width: 42, unit: "cm", edges: [] }, furnitureOffer),
      "1x 52 cm x 42 cm, bez oklejenia",
    );
  });

  it("can generate a note from an already calculated result", () => {
    const calculation = calculateOffer({
      pieces: [{ quantity: 2, width: 30, height: 45 }],
    }, areaOffer);

    assert.equal(createMarketplaceNote(calculation.result, areaOffer), "2x 30 cm x 45 cm");
  });
});

describe("validation and calculation", () => {
  it("requires at least one valid piece", () => {
    assert.throws(
      () => validateBuyerInput({ pieces: [] }, areaOffer),
      ValidationError,
    );
  });

  it("calculates furniture boards from offer parameters", () => {
    const calculation = calculateOffer({
      pieces: [{
        quantity: 1,
        length: 42,
        width: 52,
        edges: ["top", "bottom"],
      }],
    }, furnitureOffer);

    assert.equal(calculation.result.purchasableItems, 22);
    assert.equal(calculation.result.totalArea, 2184);
    assert.equal(calculation.result.totalCoatedEdgeCm, 84);
    assert.equal(calculation.marketplaceNote, "1x 42 cm x 52 cm, oklejenie: góra, dół");
  });

  it("enforces furniture limits from the offer configuration", () => {
    assert.throws(
      () => validateBuyerInput({
        pieces: [{ quantity: 1, length: 240, width: 1, edges: ["left"] }],
      }, furnitureOffer),
      /każdy bok musi mieć minimum 8 cm/,
    );

    assert.throws(
      () => validateBuyerInput({
        pieces: [{ quantity: 1, length: 231, width: 8, edges: [] }],
      }, furnitureOffer),
      /suma boków jednej formatki nie może przekroczyć 460 cm/,
    );
  });

  it("uses a billable minimum dimension when configured", () => {
    const offer = {
      ...furnitureOffer,
      configuration: {
        ...furnitureOffer.configuration,
        billableDimensions: {
          minCm: 21,
        },
        decor: {
          enabled: true,
          required: true,
        },
        edges: {
          enabled: true,
          default: [],
          minCoatedEdgeCm: null,
        },
        constraints: {
          ...furnitureOffer.configuration.constraints,
          minDimensionCm: 1,
          maxPerimeterCm: null,
        },
      },
    };

    const calculation = calculateOffer({
      pieces: [{ quantity: 1, length: 100, width: 8, decor: "Dąb", edges: [] }],
    }, offer);

    assert.equal(calculation.result.totalArea, 800);
    assert.equal(calculation.result.totalBillableArea, 2100);
    assert.equal(calculation.result.purchasableItems, 21);
    assert.equal(calculation.marketplaceNote, "1x 100 cm x 8 cm, bez oklejenia, dekor: Dąb");
  });

  it("requires decor and applies configured edge minimums", () => {
    const decorOffer = {
      ...furnitureOffer,
      configuration: {
        ...furnitureOffer.configuration,
        decor: {
          enabled: true,
          required: true,
        },
      },
    };
    const edge15Offer = {
      ...furnitureOffer,
      configuration: {
        ...furnitureOffer.configuration,
        edges: {
          enabled: true,
          minCoatedEdgeCm: 15,
        },
        constraints: {
          ...furnitureOffer.configuration.constraints,
          minDimensionCm: 1,
        },
      },
    };

    assert.throws(
      () => validateBuyerInput({
        pieces: [{ quantity: 1, length: 100, width: 8, decor: "", edges: [] }],
      }, decorOffer),
      /podaj wybrany dekor/,
    );

    assert.throws(
      () => validateBuyerInput({
        pieces: [{ quantity: 1, length: 100, width: 14, edges: ["right"] }],
      }, edge15Offer),
      /oklejany bok musi mieć minimum 15 cm/,
    );
  });

  it("supports panel x20 offers with mathematical staged rounding", () => {
    const offer = {
      ...areaOffer,
      configuration: {
        dimensions: {
          first: { key: "width", label: "Szerokość" },
          second: { key: "height", label: "Wysokość" },
          noteOrder: ["width", "height"],
          rounding: { enabled: true, mode: "ceil", precision: 0 },
        },
        pricing: {
          areaUnit: "m2",
          mode: "multiply_area",
          multiplier: 20,
        },
        rowArea: {
          rounding: { enabled: true, mode: "round", precision: 2 },
        },
        purchasableQuantity: {
          rounding: { mode: "round", precision: 0 },
        },
      },
    };

    const singleRow = calculateOffer({
      pieces: [{ quantity: 7, width: 63, height: 33.3 }],
    }, offer);

    assert.equal(singleRow.result.rows[0].billableDimensionsCm.height, 34);
    assert.equal(singleRow.result.rows[0].areaForTotal, 1.5);
    assert.equal(singleRow.result.purchasableItems, 30);

    const multiRow = calculateOffer({
      pieces: [
        { quantity: 4, width: 78, height: 42 },
        { quantity: 5, width: 67, height: 43 },
      ],
    }, offer);

    assert.equal(multiRow.result.rows[0].areaForTotal, 1.31);
    assert.equal(multiRow.result.rows[1].areaForTotal, 1.44);
    assert.equal(multiRow.result.totalAreaForPricing, 2.75);
    assert.equal(multiRow.result.purchasableItems, 55);
  });

  it("supports offer-defined fixed dimension lists", () => {
    const offer = {
      ...areaOffer,
      configuration: {
        ...areaOffer.configuration,
        dimensions: {
          first: {
            key: "width",
            label: "Szerokość",
            allowedValuesCm: [30, 60, 90],
          },
          second: {
            key: "height",
            label: "Wysokość",
          },
          noteOrder: ["width", "height"],
        },
      },
    };

    const calculation = calculateOffer({
      pieces: [{ quantity: 1, width: 60, height: 40 }],
    }, offer);

    assert.equal(calculation.result.totalArea, 0.24);

    assert.throws(
      () => validateBuyerInput({
        pieces: [{ quantity: 1, width: 45, height: 40 }],
      }, offer),
      /szerokość musi mieć jedną z wartości: 30, 60, 90 cm/,
    );
  });
});

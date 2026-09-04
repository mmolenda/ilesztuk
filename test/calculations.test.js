import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateForCalculator,
  createMarketplaceNote,
  formatPieceLine,
  formatResultPieceLine,
  validateBuyerInput,
  ValidationError,
} from "../public/js/calculations.js";

const areaCalculator = Object.freeze({
  customerId: "demo",
  customerName: "Demo",
  calculatorId: "AbC123xYz789",
  calculatorName: "Sklejka 18 mm",
  plugin: "rectangular_pieces",
  configuration: {
    pricing: {
      areaUnit: "m2",
      coefficient: 1.25,
    },
  },
});

const furnitureCalculator = Object.freeze({
  customerId: "demo",
  customerName: "Demo",
  calculatorId: "QrS456uVw012",
  calculatorName: "Formatki meblowe",
  plugin: "rectangular_pieces",
  configuration: {
    dimensions: {
      first: { key: "length", label: "Długość" },
      second: { key: "width", label: "Szerokość" },
      noteOrder: ["length", "width"],
    },
    pricing: {
      areaUnit: "cm2",
      coefficient: 0.01,
    },
    purchasableQuantity: {
      rounding: { mode: "round", precision: 0 },
    },
    edges: {
      enabled: true,
      label: "Oklejenie",
      minFinishEdgeCm: 8,
    },
    constraints: {
      minFirstCm: 8,
      minSecondCm: 8,
      maxPerimeterCm: 460,
      enforceSecondNotGreaterThanFirst: false,
    },
  },
});

describe("marketplace note", () => {
  it("aggregates identical pieces and contains only order-note content", () => {
    const calculation = calculateForCalculator({
      pieces: [
        { quantity: 2, width: 30, height: 45 },
        { quantity: 1, width: 30, height: 45 },
        { quantity: 1, width: 50, height: 60 },
      ],
    }, areaCalculator);

    assert.equal(calculation.marketplaceNote, [
      "3x 30 cm x 45 cm",
      "1x 50 cm x 60 cm",
    ].join("\n"));
    assert.equal(calculation.marketplaceNote.includes("http"), false);
  });

  it("formats compact piece lines", () => {
    assert.equal(formatPieceLine({ quantity: 3, width: 20, height: 80, unit: "cm" }), "3x 20 cm x 80 cm");
  });

  it("formats compact piece lines using calculator dimension order", () => {
    assert.equal(
      formatResultPieceLine({ quantity: 1, length: 52, width: 42, unit: "cm", edges: [] }, furnitureCalculator),
      "1x 52 cm x 42 cm, Oklejenie: brak",
    );

    const calculatorWithCustomEdgeLabel = {
      ...furnitureCalculator,
      configuration: {
        ...furnitureCalculator.configuration,
        edges: { ...furnitureCalculator.configuration.edges, label: "Obrzeże" },
      },
    };
    assert.equal(
      formatResultPieceLine({ quantity: 1, length: 52, width: 42, unit: "cm", edges: ["top", "bottom"] }, calculatorWithCustomEdgeLabel),
      "1x 52 cm x 42 cm, Obrzeże: góra, dół",
    );
  });

  it("can generate a note from an already calculated result", () => {
    const calculation = calculateForCalculator({
      pieces: [{ quantity: 2, width: 30, height: 45 }],
    }, areaCalculator);

    assert.equal(createMarketplaceNote(calculation.result, areaCalculator), "2x 30 cm x 45 cm");
  });
});

describe("validation and calculation", () => {
  it("requires at least one valid piece", () => {
    assert.throws(
      () => validateBuyerInput({ pieces: [] }, areaCalculator),
      ValidationError,
    );
  });

  it("calculates furniture boards from calculator parameters", () => {
    const calculation = calculateForCalculator({
      pieces: [{
        quantity: 1,
        length: 42,
        width: 52,
        edges: ["top", "bottom"],
      }],
    }, furnitureCalculator);

    assert.equal(calculation.result.purchasableItems, 22);
    assert.equal(calculation.result.totalArea, 2184);
    assert.equal(calculation.result.totalCoatedEdgeCm, 84);
    assert.equal(calculation.marketplaceNote, "1x 42 cm x 52 cm, Oklejenie: góra, dół");
  });

  it("enforces furniture limits from the calculator configuration", () => {
    const calculator = {
      ...furnitureCalculator,
      configuration: {
        ...furnitureCalculator.configuration,
        constraints: {
          ...furnitureCalculator.configuration.constraints,
          maxFirstCm: 200,
          maxSecondCm: 120,
        },
      },
    };

    assert.throws(
      () => validateBuyerInput({
        pieces: [{ quantity: 1, length: 100, width: 1, edges: ["left"] }],
      }, calculator),
      /szerokość musi mieć minimum 8 cm/,
    );

    assert.throws(
      () => validateBuyerInput({
        pieces: [{ quantity: 1, length: 231, width: 8, edges: [] }],
      }, furnitureCalculator),
      /suma boków jednej formatki nie może przekroczyć 460 cm/,
    );

    assert.throws(
      () => validateBuyerInput({
        pieces: [{ quantity: 1, length: 201, width: 10, edges: [] }],
      }, calculator),
      /długość nie może przekroczyć 200 cm/,
    );

    assert.throws(
      () => validateBuyerInput({
        pieces: [{ quantity: 1, length: 100, width: 121, edges: [] }],
      }, calculator),
      /szerokość nie może przekroczyć 120 cm/,
    );
  });

  it("uses first and second minimums as hard input limits", () => {
    const calculator = {
      ...furnitureCalculator,
      configuration: {
        ...furnitureCalculator.configuration,
        customFields: [
          { label: "Dekor", required: true, allowedValues: [] },
        ],
        edges: {
          enabled: true,
          default: [],
          minFinishEdgeCm: null,
        },
        constraints: {
          ...furnitureCalculator.configuration.constraints,
          minFirstCm: 1,
          minSecondCm: 21,
          maxPerimeterCm: null,
        },
      },
    };

    assert.throws(
      () => validateBuyerInput({
        pieces: [{ quantity: 1, length: 100, width: 8, customFields: [{ value: "Dąb" }], edges: [] }],
      }, calculator),
      /szerokość musi mieć minimum 21 cm/,
    );

    const calculation = calculateForCalculator({
      pieces: [{ quantity: 1, length: 100, width: 21, customFields: [{ value: "Dąb" }], edges: [] }],
    }, calculator);

    assert.equal(calculation.result.totalArea, 2100);
    assert.equal(calculation.result.purchasableItems, 21);
    assert.equal(calculation.marketplaceNote, "1x 100 cm x 21 cm, Oklejenie: brak, dekor: Dąb");
  });

  it("requires custom fields, validates allowed values, and applies configured edge minimums", () => {
    const customFieldCalculator = {
      ...furnitureCalculator,
      configuration: {
        ...furnitureCalculator.configuration,
        customFields: [
          { label: "Dekor", required: true, allowedValues: ["Dąb", "Buk"] },
        ],
      },
    };
    const edge15Calculator = {
      ...furnitureCalculator,
      configuration: {
        ...furnitureCalculator.configuration,
        edges: {
          enabled: true,
          minFinishEdgeCm: 15,
        },
        constraints: {
          ...furnitureCalculator.configuration.constraints,
          minFirstCm: 1,
          minSecondCm: 1,
        },
      },
    };

    assert.throws(
      () => validateBuyerInput({
        pieces: [{ quantity: 1, length: 100, width: 8, customFields: [{ value: "" }], edges: [] }],
      }, customFieldCalculator),
      /podaj dekor/,
    );

    assert.throws(
      () => validateBuyerInput({
        pieces: [{ quantity: 1, length: 100, width: 8, customFields: [{ value: "Orzech" }], edges: [] }],
      }, customFieldCalculator),
      /dekor wybierz z listy dostępnych wartości/,
    );

    assert.throws(
      () => validateBuyerInput({
        pieces: [{ quantity: 1, length: 100, width: 14, edges: ["right"] }],
      }, edge15Calculator),
      /wykańczany bok musi mieć minimum 15 cm/,
    );
  });

  it("supports panel x20 calculators with mathematical staged rounding", () => {
    const calculator = {
      ...areaCalculator,
      configuration: {
        dimensions: {
          first: { key: "width", label: "Szerokość" },
          second: { key: "height", label: "Wysokość" },
          noteOrder: ["width", "height"],
          rounding: { enabled: true, mode: "ceil", precision: 0 },
        },
        pricing: {
          areaUnit: "m2",
          coefficient: 20,
        },
        rowArea: {
          rounding: { enabled: true, mode: "round", precision: 2 },
        },
        purchasableQuantity: {
          rounding: { mode: "round", precision: 0 },
        },
      },
    };

    const singleRow = calculateForCalculator({
      pieces: [{ quantity: 7, width: 63, height: 33.3 }],
    }, calculator);

    assert.equal(singleRow.result.rows[0].roundedDimensionsCm.height, 34);
    assert.equal(singleRow.result.rows[0].areaForTotal, 1.5);
    assert.equal(singleRow.result.purchasableItems, 30);

    const multiRow = calculateForCalculator({
      pieces: [
        { quantity: 4, width: 78, height: 42 },
        { quantity: 5, width: 67, height: 43 },
      ],
    }, calculator);

    assert.equal(multiRow.result.rows[0].areaForTotal, 1.31);
    assert.equal(multiRow.result.rows[1].areaForTotal, 1.44);
    assert.equal(multiRow.result.totalAreaForPricing, 2.75);
    assert.equal(multiRow.result.purchasableItems, 55);
  });

  it("supports calculator-defined fixed dimension lists", () => {
    const calculator = {
      ...areaCalculator,
      configuration: {
        ...areaCalculator.configuration,
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

    const calculation = calculateForCalculator({
      pieces: [{ quantity: 1, width: 60, height: 40 }],
    }, calculator);

    assert.equal(calculation.result.totalArea, 0.24);

    assert.throws(
      () => validateBuyerInput({
        pieces: [{ quantity: 1, width: 45, height: 40 }],
      }, calculator),
      /szerokość musi mieć jedną z wartości: 30 cm, 60 cm, 90 cm/,
    );
  });

  it("supports meter input while calculating internally in centimeters", () => {
    const calculator = {
      ...areaCalculator,
      configuration: {
        displayUnit: "m",
        dimensions: {
          first: {
            key: "rollWidth",
            label: "Szerokość rolki",
            allowedValuesCm: [200, 300, 400],
          },
          second: {
            key: "length",
            label: "Długość",
          },
          noteOrder: ["rollWidth", "length"],
        },
        pricing: {
          areaUnit: "m2",
          coefficient: 1,
        },
        purchasableQuantity: {
          rounding: { mode: "ceil", precision: 0 },
        },
        constraints: {
          minFirstCm: 200,
          minSecondCm: 1,
        },
      },
    };

    const calculation = calculateForCalculator({
      pieces: [{ quantity: 1, rollWidth: 4, length: 2.2 }],
    }, calculator);

    assert.equal(calculation.result.totalArea, 8.8);
    assert.equal(calculation.result.purchasableItems, 9);
    assert.equal(calculation.marketplaceNote, "1x 4 m x 2,2 m");

    assert.throws(
      () => validateBuyerInput({
        pieces: [{ quantity: 1, rollWidth: 2.5, length: 5 }],
      }, calculator),
      /szerokość rolki musi mieć jedną z wartości: 2 m, 3 m, 4 m/,
    );
  });
});

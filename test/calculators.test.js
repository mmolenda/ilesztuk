import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isValidCalculatorId, loadCalculator, normalizeCalculator, CALCULATOR_ID_RE } from "../public/js/calculators.js";
import { calculateForCalculator } from "../public/js/calculations.js";

const execFileAsync = promisify(execFile);
const calculatorsDir = path.join(process.cwd(), "public", "calculators");

describe("static calculators", () => {
  it("stores calculators under random id filenames without a published index", async () => {
    const fileNames = await readdir(calculatorsDir);
    const calculatorFiles = fileNames.filter((fileName) => fileName.endsWith(".json"));

    assert.equal(fileNames.includes("index.json"), false);
    assert.ok(calculatorFiles.length >= 1);

    for (const fileName of calculatorFiles) {
      const calculatorId = path.basename(fileName, ".json");
      assert.match(calculatorId, CALCULATOR_ID_RE);

      const calculator = normalizeCalculator(
        JSON.parse(await readFile(path.join(calculatorsDir, fileName), "utf8")),
        fileName,
      );
      assert.equal(calculator.calculatorId, calculatorId);
      assert.equal(calculator.plugin, "rectangular_pieces");
    }
  });

  it("validates calculator ids before loading a calculator file", async () => {
    const fetchedUrls = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      fetchedUrls.push(url);
      return { ok: false };
    };

    try {
      assert.equal(isValidCalculatorId("furniture-board-calculator"), false);
      assert.equal(await loadCalculator("furniture-board-calculator"), null);
      assert.deepEqual(fetchedUrls, []);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it("loads only the requested matching calculator file", async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      assert.equal(url, "/calculators/8ukq6mwKY5ft.json");
      return {
        ok: true,
        json: async () => JSON.parse(await readFile(path.join(calculatorsDir, "8ukq6mwKY5ft.json"), "utf8")),
      };
    };

    try {
      const calculator = await loadCalculator("8ukq6mwKY5ft");
      assert.equal(calculator.calculatorId, "8ukq6mwKY5ft");
      assert.equal(calculator.calculatorName, "Formatka meblowa na wymiar");
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it("calculates custom upholstered panels using the Stylowy__dom ordering rules", async () => {
    const calculator = normalizeCalculator(
      JSON.parse(await readFile(path.join(calculatorsDir, "mWt3pn1JaGNP.json"), "utf8")),
      "mWt3pn1JaGNP.json",
    );
    const calculation = calculateForCalculator({
      pieces: [
        { quantity: 4, width: 78, height: 42, customFields: [{ value: "12" }, { value: "Trinity" }] },
        { quantity: 5, width: 67, height: 43, customFields: [{ value: "12" }, { value: "Trinity" }] },
      ],
    }, calculator);

    assert.equal(calculation.result.purchasableItems, 55);
    assert.match(calculation.marketplaceNote, /numer tkaniny: 12/);
    assert.match(calculation.marketplaceNote, /rodzaj tkaniny: Trinity/);
  });

  it("requires the json calculator shape", () => {
    assert.throws(
      () => normalizeCalculator({
        customerId: "seller-a",
        customerName: "Seller A",
        calculatorId: "AaBbCc123456",
        calculatorName: "Calculator A",
        plugin: "rectangular_pieces",
      }),
      /configuration must be an object/,
    );

    assert.throws(
      () => normalizeCalculator({
        customerId: "seller-a",
        customerName: "Seller A",
        calculatorId: "calculator-a",
        calculatorName: "Calculator A",
        plugin: "rectangular_pieces",
        configuration: {},
      }),
      /calculatorId must be a 12-character base62 string/,
    );
  });

  it("accepts an optional customer URL and rejects unsafe protocols", () => {
    const calculator = normalizeCalculator({
      customerId: "seller-a",
      customerName: "Seller A",
      customerUrl: "https://example.com/seller",
      calculatorId: "AaBbCc123456",
      calculatorName: "Calculator A",
      plugin: "rectangular_pieces",
      configuration: {},
    });
    assert.equal(calculator.customerUrl, "https://example.com/seller");

    const internalCalculator = normalizeCalculator({
      customerId: "seller-a",
      customerName: "Seller A",
      customerUrl: "/",
      calculatorId: "AaBbCc123456",
      calculatorName: "Calculator A",
      plugin: "rectangular_pieces",
      configuration: {},
    });
    assert.equal(internalCalculator.customerUrl, "/");

    assert.throws(
      () => normalizeCalculator({
        customerId: "seller-a",
        customerName: "Seller A",
        customerUrl: "javascript:alert(1)",
        calculatorId: "AaBbCc123456",
        calculatorName: "Calculator A",
        plugin: "rectangular_pieces",
        configuration: {},
      }),
      /customerUrl must use http or https/,
    );
  });

  it("generates random 12-character base62 calculator ids", async () => {
    const { stdout } = await execFileAsync("npm", ["run", "generate-calculator-id", "--silent"], {
      cwd: process.cwd(),
    });
    assert.match(stdout.trim(), CALCULATOR_ID_RE);
  });
});

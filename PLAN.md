# IleSztuk Calculators

## Summary

IleSztuk is a static browser app for calculators used with marketplace listings. Calculator pages are public for anyone who knows the URL, but the app does not publish a calculator catalog or expose predictable calculator URLs. Calculations are performed in the browser and are not persisted.

The public calculator URL shape is:

```text
/k/<calculator-id>
```

The main page is a simple IleSztuk landing page.

## Calculator Discoverability

Calculator IDs are random, non-sequential, 12-character base62 strings.

Example:

```text
7Kp9xQm2VrL4
```

Calculator IDs are not derived from customer names, calculator names, counters, timestamps, or other predictable inputs.

Knowing one calculator URL should not make it practical to discover other calculator URLs.

## Calculator Files

Each calculator is a JSON file under `public/calculators/`. The filename is the calculator ID:

```text
public/calculators/7Kp9xQm2VrL4.json
```

The calculator route:

```text
/k/7Kp9xQm2VrL4
```

loads:

```text
/calculators/7Kp9xQm2VrL4.json
```

The app validates the URL ID before attempting to load a config:

```js
/^[A-Za-z0-9]{12}$/
```

Malformed IDs, nonexistent IDs, and missing config files all render the same calculator-not-found state.

Required calculator fields:

- `customerId`: stable customer identifier.
- `customerName`: customer display name.
- `calculatorId`: stable random calculator identifier matching the filename.
- `calculatorName`: buyer-facing calculator name.
- `plugin`: calculation plugin key.
- `configuration`: plugin-specific configuration object.

Example:

```json
{
  "customerId": "ilesztuk-demo",
  "customerName": "IleSztuk Demo",
  "calculatorId": "7Kp9xQm2VrL4",
  "calculatorName": "Sklejka 18 mm",
  "plugin": "rectangular_pieces",
  "configuration": {
    "displayUnit": "cm",
    "pricing": {
      "areaUnit": "m2",
      "coefficient": 1.25
    }
  }
}
```

## Public Catalogs

The app does not publish:

- a calculator manifest;
- an all-calculators page;
- a customer calculator listing page;
- seller indexes;
- sitemap entries for calculator URLs;
- links between unrelated calculator pages.

Directory listing must not be enabled for `public/calculators/`. If a static host does not support directory listing, no extra mechanism is required.

## Search Indexing

The static app shell includes:

```html
<meta name="robots" content="noindex, nofollow">
```

Calculator URLs are not included in a sitemap.

## Calculation Plugins

Calculation behavior lives in browser-loadable modules under `public/js/plugins/`.

Each plugin owns:

- buyer input validation;
- calculation logic;
- marketplace-note generation;
- piece-line formatting;
- result metric formatting.

The first plugin is `rectangular_pieces`.

## Rectangular Pieces Plugin

The `rectangular_pieces` plugin supports rectangular pieces with configurable dimensions, pricing, limits, rounding, edge coating, decor notes, and fixed dimension lists.

Configuration areas:

- `displayUnit`: display unit, currently centimeters.
- `dimensions`: first/second dimension keys, labels, marketplace-note order, optional fixed `allowedValuesCm`, and optional dimension rounding.
- `pricing`: area unit plus one coefficient used to convert area into purchasable items.
- `rowArea.rounding`: optional per-row area rounding before summing.
- `totalArea.rounding`: optional total-area rounding after summing.
- `purchasableQuantity.rounding`: final quantity rounding.
- `edges`: optional edge finishing UI and validation.
- `decor`: optional decor input and required validation.
- `constraints`: minimum and maximum values for the first/second configured dimensions, maximum perimeter, and second-dimension ordering rule.

`purchasableUnitLabel` is not configurable. Buyer-facing results always use `sztuk`.

`pricing.areaUnit` controls the area unit used for pricing calculations:

- `cm2`: square centimeters.
- `m2`: square meters.

Pricing uses one formula:

```text
purchasable items before final rounding = area in pricing.areaUnit * pricing.coefficient
```

`pricing.coefficient` means how many purchasable items are produced by one unit of area:

- `areaUnit: "cm2", coefficient: 0.01`: `100 cm2 = 1 sztuka`.
- `areaUnit: "m2", coefficient: 20`: `area in m2 * 20`.
- `areaUnit: "m2", coefficient: 1.25`: equivalent to `area in m2 / 0.8`.

If `pricing.coefficient` is omitted, the plugin default is `0.01` with `areaUnit: "cm2"`, meaning `100 cm2 = 1 sztuka`.

Supported rounding modes:

- `ceil`: round up.
- `floor`: round down.
- `round`: mathematical rounding.

## Buyer Result

After form submission, the browser validates input, computes the result, generates the marketplace note, and renders the result on the calculator page.

The buyer result page shows:

- number of purchasable items to order;
- compact requested-piece summary;
- relevant calculation metrics;
- complete marketplace note;
- copy button for the marketplace note.

Marketplace notes contain only order-note content, for example:

```text
2x 30 cm x 45 cm
3x 20 cm x 80 cm
1x 100 cm x 120 cm
```

Marketplace notes do not include external URLs.

## Developer Utility

New calculator IDs are generated with:

```text
npm run generate-calculator-id
```

The utility uses `crypto.randomBytes()` and outputs one random 12-character base62 ID.

## Static Hosting

The site can be served from `public/` without a runtime backend.

Vercel uses `vercel.json` rewrites so clean URLs render the app shell:

```text
/k/<calculator-id> -> /index.html
```

GitHub Pages can use `public/404.html` as the app shell fallback for direct navigation to clean URLs.

## Tests

Test coverage should verify:

- calculator JSON files use random ID filenames;
- there is no published calculator manifest;
- malformed calculator IDs are rejected before fetch;
- matching calculator config is fetched directly by ID;
- calculator ID generation uses 12-character base62 output;
- rectangular-piece validation;
- configured limits;
- fixed dimension lists;
- coefficient pricing;
- staged rounding;
- generated marketplace-note content.

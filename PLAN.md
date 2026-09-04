# IleSztuk Offer Calculators

## Summary

IleSztuk is a static browser app for marketplace offer calculators. Offers are stored as JSON files served with the static site. Calculations are performed in the browser and are not persisted.

The application has two main public URL shapes:

- `/o/<offer-id>` displays one calculator for a specific offer.
- `/c/<customer-id>` lists all offers belonging to one customer.

The main page is a simple IleSztuk landing page.

## Offer Files

Each offer is a JSON file under `public/offers/`.

Browsers cannot reliably list static directories, so `public/offers/index.json` is the offer manifest. It contains each offer ID, customer ID, display names, and JSON file name.

Required fields:

- `customerId`: stable customer identifier used in `/c/<customer-id>`.
- `customerName`: customer display name.
- `offerId`: stable offer identifier used in `/o/<offer-id>`.
- `offerName`: buyer-facing offer/product name.
- `plugin`: calculation plugin key.
- `configuration`: plugin-specific configuration object.

Example:

```json
{
  "customerId": "ilesztuk-demo",
  "customerName": "IleSztuk Demo",
  "offerId": "default-area-offer",
  "offerName": "Sklejka 18 mm",
  "plugin": "rectangular_pieces",
  "configuration": {
    "displayUnit": "cm",
    "purchasableUnitLabel": "sztuk",
    "pricing": {
      "areaUnit": "m2",
      "mode": "divide_by_coefficient",
      "coefficient": 0.8
    }
  }
}
```

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
- `purchasableUnitLabel`: label shown after the final order quantity.
- `dimensions`: first/second dimension keys, labels, marketplace-note order, optional fixed `allowedValuesCm`, and optional dimension rounding.
- `pricing`: one of coefficient-based pricing, area-per-item pricing, or area multiplier pricing.
- `rowArea.rounding`: optional per-row area rounding before summing.
- `totalArea.rounding`: optional total-area rounding after summing.
- `purchasableQuantity.rounding`: final quantity rounding.
- `billableDimensions.minCm`: optional minimum billable dimension.
- `edges`: optional edge coating UI and validation.
- `decor`: optional decor input and required validation.
- `constraints`: minimum dimension, maximum perimeter, maximum length, package limit, package height, and second-dimension ordering rule.

Supported pricing modes:

- `divide_by_coefficient`: area divided by `coefficient`.
- `divide_by_area_per_item`: area divided by `areaPerItemCm2`.
- `multiply_area`: area multiplied by `multiplier`.

## Buyer Result

After form submission, the browser validates input, computes the result, generates the marketplace note, and renders the result on the offer page.

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

## Tests

Test coverage should verify:

- offer JSON loading;
- offer lookup by `offerId`;
- customer offer listing by `customerId`;
- rectangular-piece validation;
- configured limits;
- fixed dimension lists;
- coefficient, area-per-item, and multiplier pricing;
- staged rounding;
- generated marketplace-note content.

## Static Hosting

The site can be served from `public/` without a runtime backend.

Vercel uses `vercel.json` rewrites so clean URLs render the app shell:

- `/o/<offer-id>` -> `/index.html`
- `/c/<customer-id>` -> `/index.html`

GitHub Pages can use `public/404.html` as the app shell fallback for direct navigation to clean URLs.

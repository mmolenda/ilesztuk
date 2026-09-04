import { calculateForCalculator, ValidationError } from "./js/calculations.js?v=20260904-1750";
import { isValidCalculatorId, loadCalculator } from "./js/calculators.js?v=20260904-1750";
import { formatPiecesQuantity } from "./js/formatting.js?v=20260904-1750";
import { dimensionKeyForEdge, MAX_PIECE_QUANTITY } from "./js/plugins/rectangularPieces.js?v=20260904-1750";

const app = document.querySelector("#app");

main().catch((error) => {
  console.error(error);
  renderError();
});

async function main() {
  const route = parseRoute(window.location.pathname);
  if (route.name === "home") {
    renderLanding();
    return;
  }
  if (route.name === "calculator") {
    const calculator = await loadCalculator(route.calculatorId);
    calculator ? renderCalculatorPage(calculator) : renderNotFound();
    return;
  }
  renderNotFound();
}

function parseRoute(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    return { name: "home" };
  }
  if (parts.length === 2 && parts[0] === "k" && isValidCalculatorId(parts[1])) {
    return { name: "calculator", calculatorId: parts[1] };
  }
  return { name: "not-found" };
}

function renderLanding() {
  document.title = "IleSztuk";
  app.innerHTML = `
    <section class="landing">
      <h1>IleSztuk</h1>
      <p>Prosty kalkulator ilości sztuk do zamówień marketplace.</p>
    </section>
  `;
}

function renderCalculatorPage(calculator, error = "") {
  document.title = `${calculator.calculatorName} - IleSztuk`;
  app.innerHTML = `
    <section class="calculator-shell">
      <div class="calculator-header">
        <div>
          <p class="eyebrow">Kalkulator zamówienia</p>
          <h1>${escapeHtml(calculator.calculatorName)}</h1>
          ${renderSellerName(calculator)}
        </div>
      </div>
      ${usesGraphicalRectangularCalculatorForm(calculator) ? renderFurnitureCalculatorForm(calculator) : renderAreaCalculatorForm(calculator)}
    </section>
  `;
  bindCalculatorForm(calculator);
  bindRows(() => document.querySelector("[data-calculation-form]")?.updateCalculation?.());
}

function renderSellerName(calculator) {
  const customerName = escapeHtml(calculator.customerName);
  if (!calculator.customerUrl) {
    return `<p class="seller-name">od <span class="seller-name-value">${customerName}</span></p>`;
  }
  return `<p class="seller-name">od <a class="seller-link" href="${escapeHtml(calculator.customerUrl)}" target="_blank" rel="noopener noreferrer">${customerName}<span class="external-link-icon" aria-hidden="true"></span></a></p>`;
}

function usesGraphicalRectangularCalculatorForm(calculator) {
  return Boolean(
    calculator.configuration.edges?.enabled
      || customFieldDefinitions(calculator.configuration).length > 0
      || calculator.configuration.dimensions?.first?.key === "length"
      || calculator.configuration.dimensions?.second?.key === "length",
  );
}

function renderAreaCalculatorForm(calculator) {
  const config = calculator.configuration;
  const first = config.dimensions?.first ?? { key: "width", label: "Szerokość" };
  const second = config.dimensions?.second ?? { key: "height", label: "Wysokość" };

  return `
    <form data-calculation-form novalidate>
      <section class="calculator-section input-section">
        <div class="section-heading">
          <h2>Elementy do zamówienia</h2>
          <p>Podaj ilość i wymiary każdego elementu. Wynik aktualizuje się automatycznie.</p>
        </div>
        <div class="form-grid" data-piece-rows>
          ${renderAreaRow(0, calculator)}
        </div>
        <p class="empty-state" data-empty-state hidden>Brak elementów. Dodaj pierwszy element, aby rozpocząć kalkulację.</p>
        <div class="row-controls">
          <button type="button" class="add-row-button" data-add-row>+ Dodaj element</button>
        </div>
      </section>
    </form>
    <template data-row-template>
      ${renderAreaRow("__INDEX__", calculator)}
    </template>
    <section id="result" aria-live="polite"></section>
  `;
}

function renderAreaRow(index, calculator) {
  const config = calculator.configuration;
  const first = config.dimensions?.first ?? { key: "width", label: "Szerokość" };
  const second = config.dimensions?.second ?? { key: "height", label: "Wysokość" };

  return `
    <div class="piece-row" data-piece-row data-row-index="${index}">
      ${renderItemHeading()}
      <div class="row-fields">
        ${renderQuantityField(index)}
        ${renderDimensionField(first, index, config)}
        ${renderDimensionField(second, index, config)}
      </div>
    </div>
  `;
}

function renderFurnitureCalculatorForm(calculator) {
  const config = calculator.configuration;

  return `
    <form data-calculation-form novalidate>
      <section class="calculator-section input-section">
        <div class="section-heading">
          <h2>Elementy do zamówienia</h2>
          <p>Uzupełnij wymiary, ilość i opcje wykończenia. Wynik aktualizuje się automatycznie.</p>
        </div>
        <div class="form-grid furniture-grid" data-piece-rows>
          ${renderFurnitureRow(0, calculator)}
        </div>
        <p class="empty-state" data-empty-state hidden>Brak elementów. Dodaj pierwszy element, aby rozpocząć kalkulację.</p>
        <div class="row-controls">
          <button type="button" class="add-row-button" data-add-row>+ Dodaj element</button>
        </div>
      </section>
    </form>
    <template data-row-template>
      ${renderFurnitureRow("__INDEX__", calculator)}
    </template>
    <section id="result" aria-live="polite"></section>
  `;
}

function renderFurnitureRow(index, calculator) {
  const config = calculator.configuration;
  const firstDimension = config.dimensions?.first ?? { key: "length", label: "Długość" };
  const secondDimension = config.dimensions?.second ?? { key: "width", label: "Szerokość" };
  const noteOrder = config.dimensions?.noteOrder ?? [firstDimension.key, secondDimension.key];
  const firstInput = renderDimensionInput(dimensionForKey(noteOrder[0], config), index, config);
  const secondInput = renderDimensionInput(dimensionForKey(noteOrder[1], config), index, config);
  const customFields = renderCustomFields(index, config);

  return `
    <div class="furniture-row ${config.edges?.enabled ? "" : "no-edge-picker"}" data-piece-row data-row-index="${index}">
      ${renderItemHeading()}
      <div class="furniture-fields">
        ${renderQuantityField(index)}
        ${firstInput}
        ${secondInput}
        ${customFields}
      </div>
      ${renderEdgePicker(index, config)}
    </div>
  `;
}

function renderItemHeading() {
  return `
    <div class="row-title">
      <span data-row-number>Element 1</span>
      <button type="button" class="remove-row-button" data-remove-row aria-label="Usuń element" title="Usuń element">
        <span class="trash-icon" aria-hidden="true"></span>
      </button>
    </div>
  `;
}

function bindRows(onRowsChanged = () => {}) {
  const maxRows = 10;
  const rowsContainer = document.querySelector("[data-piece-rows]");
  const addButton = document.querySelector("[data-add-row]");
  if (!rowsContainer || !addButton) {
    return;
  }

  const updateRowControls = () => {
    const rows = rowsContainer.querySelectorAll("[data-piece-row]");
    const rowCount = rows.length;
    addButton.disabled = rowCount >= maxRows;
    rows.forEach((row, index) => {
      const rowNumber = row.querySelector("[data-row-number]");
      if (rowNumber) {
        rowNumber.textContent = `Element ${index + 1}`;
      }
      const removeButton = row.querySelector("[data-remove-row]");
      if (removeButton) {
        removeButton.hidden = rowCount <= 1;
      }
    });
    document.querySelector("[data-empty-state]")?.toggleAttribute("hidden", rowCount > 0);
  };

  addButton.addEventListener("click", () => {
    const rowCount = rowsContainer.querySelectorAll("[data-piece-row]").length;
    if (rowCount >= maxRows) {
      return;
    }
    const nextIndex = nextRowIndex(rowsContainer);
    const template = document.querySelector("[data-row-template]");
    const wrapper = document.createElement("div");
    wrapper.innerHTML = template.innerHTML.replaceAll("__INDEX__", String(nextIndex));
    rowsContainer.append(wrapper.firstElementChild);
    updateRowControls();
    onRowsChanged();
  });

  rowsContainer.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-row]");
    if (removeButton) {
      removeButton.closest("[data-piece-row]").remove();
      updateRowControls();
      onRowsChanged();
    }
  });

  updateRowControls();
}

function bindCalculatorForm(calculator) {
  const form = document.querySelector("[data-calculation-form]");
  if (!form) {
    return;
  }

  const updateResult = ({ showErrors = false } = {}) => {
    const validation = validateCalculatorForm(form, calculator);
    renderFieldValidation(form, validation, showErrors);
    if (!validation.valid) {
      renderInvalidResult(validation, calculator, { hasStarted: hasTouchedFields(form) });
      return;
    }

    try {
      const body = Object.fromEntries(new FormData(form));
      const calculation = calculateForCalculator({ pieces: collectPieces(body, calculator) }, calculator);
      renderBuyerResult(calculation, calculator);
    } catch (error) {
      if (error instanceof ValidationError) {
        renderInvalidResult({ errors: [], formErrors: [error.message], valid: false }, calculator, { hasStarted: true });
        return;
      }
      throw error;
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    updateResult({ showErrors: true });
  });

  form.addEventListener("input", (event) => {
    markTouched(event.target);
    updateResult();
  });
  form.addEventListener("change", (event) => {
    markTouched(event.target);
    updateResult();
  });
  form.updateCalculation = updateResult;
  updateResult();
}

function collectPieces(body, calculator) {
  const pieces = [];
  const firstKey = calculator.configuration?.dimensions?.first?.key ?? "width";
  const secondKey = calculator.configuration?.dimensions?.second?.key ?? "height";
  const rowIndexes = Object.keys(body)
    .map((key) => key.match(/^quantity_(.+)$/)?.[1])
    .filter((index) => index !== undefined);

  for (const index of rowIndexes) {
    const quantity = body[`quantity_${index}`];
    const first = body[`${firstKey}_${index}`];
    const second = body[`${secondKey}_${index}`];
    if (isBlank(first) && isBlank(second)) {
      continue;
    }

    pieces.push({
      quantity,
      [firstKey]: first,
      [secondKey]: second,
      customFields: collectCustomFieldValues(body, index, calculator.configuration),
      edges: ["top", "right", "bottom", "left"].filter((edge) => body[`edge_${edge}_${index}`] === "on"),
    });
  }
  return pieces;
}

function collectCustomFieldValues(body, rowIndex, config) {
  return customFieldDefinitions(config).map((field, fieldIndex) => ({
    label: field.label,
    value: body[`custom_${fieldIndex}_${rowIndex}`] ?? "",
  }));
}

function isBlank(value) {
  return value === undefined || value === "";
}

function renderBuyerResult(calculation, calculator) {
  const result = calculation.result;
  const target = document.querySelector("#result");
  target.innerHTML = `
    <div class="result-panel is-valid">
      <section class="result-hero">
        <p>Wynik obliczony automatycznie</p>
        <h2>Kup ${formatPiecesQuantity(result.purchasableItems, "accusative")}</h2>
        <span>Na podstawie podanych wymiarów i konfiguracji sprzedawcy.</span>
      </section>
      <section class="copy-panel">
        <div class="section-heading compact">
          <h3>Tekst do uwag zamówienia</h3>
          <p>Skopiuj i wklej w wiadomości lub uwagach do sprzedawcy.</p>
        </div>
        <pre id="marketplace-note">${escapeHtml(calculation.marketplaceNote)}</pre>
        <div class="actions">
          <button type="button" data-copy-target="marketplace-note">Kopiuj tekst</button>
          <span class="copy-feedback" data-copy-feedback aria-live="polite" hidden></span>
        </div>
      </section>
      <details class="calculation-details">
        <summary>Szczegóły obliczeń</summary>
        <div class="details-grid">
          ${renderBuyerDetails(calculation, calculator)}
        </div>
      </details>
    </div>
  `;
  let copyFeedbackTimeout;
  target.querySelector("[data-copy-target]").addEventListener("click", async (event) => {
    const feedback = target.querySelector("[data-copy-feedback]");
    const id = event.currentTarget.getAttribute("data-copy-target");
    clearTimeout(copyFeedbackTimeout);
    try {
      await navigator.clipboard.writeText(document.getElementById(id).textContent);
      feedback.textContent = "Skopiowano";
      feedback.className = "copy-feedback is-success";
    } catch {
      feedback.textContent = "Nie udało się skopiować";
      feedback.className = "copy-feedback is-error";
    }
    feedback.hidden = false;
    copyFeedbackTimeout = setTimeout(() => {
      feedback.hidden = true;
      feedback.textContent = "";
      feedback.className = "copy-feedback";
    }, 2000);
  });
}

function renderBuyerDetails(calculation, calculator) {
  const config = calculator.configuration;
  const result = calculation.result;
  const rules = buyerOrderingRules(config);
  return `
    <section class="details-section">
      <h3>Twoje elementy</h3>
      <ol class="detail-items">
        ${calculation.input.pieces.map((piece, index) => renderBuyerItem(piece, index, config)).join("")}
      </ol>
    </section>
    <section class="details-section">
      <h3>Podsumowanie</h3>
      <dl class="details-totals">
        ${renderDetailsTotal("Łączna powierzchnia", formatBuyerArea(result.totalArea, result.areaUnit))}
        ${renderDetailsTotal("Do kupienia", formatPiecesQuantity(result.purchasableItems))}
      </dl>
    </section>
    ${renderOrderingRulesSection(rules)}
  `;
}

function renderBuyerItem(piece, index, config) {
  const edgeText = buyerEdgeSummary(piece.edges, config.edges);
  const customFields = (piece.customFields ?? []).filter((field) => field.value);
  const area = buyerPieceArea(piece, config);
  return `
    <li>
      <h4>Element ${index + 1}</h4>
      <p>${escapeHtml(formatBuyerDimensions(piece, config))}</p>
      <p class="detail-item-calculation">= ${piece.quantity} × ${escapeHtml(formatBuyerPieceArea(area.singleCm2, config))}</p>
      ${piece.quantity === 1 ? "" : `<p class="detail-item-calculation">= ${escapeHtml(formatBuyerPieceArea(area.totalCm2, config))}</p>`}
      ${edgeText ? `<p>${escapeHtml(edgeText)}</p>` : ""}
      ${customFields.map((field) => `<p>${escapeHtml(field.label)}: ${escapeHtml(field.value)}</p>`).join("")}
    </li>
  `;
}

function buyerPieceArea(piece, config) {
  const firstDimension = config.dimensions?.first ?? { key: "width" };
  const secondDimension = config.dimensions?.second ?? { key: "height" };
  const singleCm2 = piece[firstDimension.key] * piece[secondDimension.key];
  return { singleCm2, totalCm2: singleCm2 * piece.quantity };
}

function formatBuyerPieceArea(valueCm2, config) {
  const areaUnit = config.pricing?.areaUnit ?? "cm2";
  return formatBuyerArea(areaUnit === "m2" ? valueCm2 / 10_000 : valueCm2, areaUnit);
}

function formatBuyerDimensions(piece, config) {
  const firstDimension = config.dimensions?.first ?? { key: "width" };
  const secondDimension = config.dimensions?.second ?? { key: "height" };
  const noteOrder = config.dimensions?.noteOrder ?? [firstDimension.key, secondDimension.key];
  const unit = config.displayUnit ?? "cm";
  const values = noteOrder.map((key) => formatMetric(fromCentimeters(piece[key], unit)));
  return `${piece.quantity} × ${values.join(" × ")} ${unit}`;
}

function buyerEdgeSummary(edges = [], edgeConfig = {}) {
  if (!edgeConfig?.enabled) {
    return "";
  }
  const label = edgeFinishingLabel({ edges: edgeConfig });
  if (edges.length === 0) {
    return `${label}: brak`;
  }
  if (edges.length === 4) {
    return `${label}: dookoła`;
  }
  return `${label}: ${edges.map((edge) => edgeLabel(edge).toLowerCase()).join(", ")}`;
}

function edgeFinishingLabel(config) {
  return String(config.edges?.label ?? "").trim() || "Oklejenie";
}

function renderDetailsTotal(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function formatBuyerArea(value, unit) {
  if (unit === "m2") {
    return `${formatMetric(value)} m²`;
  }
  if (value >= 10_000) {
    return `${formatMetric(value / 10_000)} m²`;
  }
  return `${formatMetric(value)} cm²`;
}

function buyerOrderingRules(config) {
  const firstDimension = config.dimensions?.first ?? { label: "Pierwszy wymiar" };
  const secondDimension = config.dimensions?.second ?? { label: "Drugi wymiar" };
  const constraints = config.constraints ?? {};
  const rules = [];

  if (constraints.minFirstCm > 0.01) {
    rules.push(`Minimalna ${firstDimension.label.toLowerCase()}: ${formatLength(constraints.minFirstCm, config)}`);
  }
  if (constraints.minSecondCm > 0.01) {
    rules.push(`Minimalna ${secondDimension.label.toLowerCase()}: ${formatLength(constraints.minSecondCm, config)}`);
  }
  if (constraints.maxFirstCm) {
    rules.push(`Maksymalna ${firstDimension.label.toLowerCase()}: ${formatLength(constraints.maxFirstCm, config)}`);
  }
  if (constraints.maxSecondCm) {
    rules.push(`Maksymalna ${secondDimension.label.toLowerCase()}: ${formatLength(constraints.maxSecondCm, config)}`);
  }
  if (constraints.maxPerimeterCm) {
    rules.push(`Maksymalna suma boków: ${formatLength(constraints.maxPerimeterCm, config)}`);
  }
  if (constraints.enforceSecondNotGreaterThanFirst) {
    rules.push(`${secondDimension.label} nie może być większa niż ${firstDimension.label.toLowerCase()}`);
  }
  if (config.edges?.enabled && config.edges.minFinishEdgeCm) {
    rules.push(`${edgeFinishingLabel(config)} możliwe dla boków od ${formatLength(config.edges.minFinishEdgeCm, config)}`);
  }
  if (config.purchasableQuantity?.rounding?.mode === "ceil" && config.purchasableQuantity.rounding.precision === 0) {
    rules.push("Liczba sztuk jest zaokrąglana w górę do pełnej sztuki.");
  }
  return rules;
}

function renderOrderingRulesSection(rules) {
  if (rules.length === 0) {
    return "";
  }
  return `
    <section class="details-section">
      <h3>Zasady zamówienia</h3>
      <ul class="details-rules">
        ${rules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderInvalidResult(validation, calculator, { hasStarted = false } = {}) {
  const target = document.querySelector("#result");
  if (!target) {
    return;
  }
  const hasInvalidValues = validation.errors.some((error) => error.type === "invalid")
    || (validation.formErrors?.length ?? 0) > 0;
  const message = !hasStarted
    ? {
      heading: "Wynik pojawi się tutaj",
      description: "Uzupełnij wymiary powyżej, aby obliczyć liczbę sztuk do kupienia.",
    }
    : hasInvalidValues
      ? {
        heading: "Popraw zaznaczone pola",
        description: "Niektóre wartości są poza dozwolonym zakresem.",
      }
      : {
        heading: "Uzupełnij wymagane dane",
        description: "Wprowadź brakujące wartości, aby obliczyć liczbę sztuk.",
      };
  target.innerHTML = `
    <div class="result-panel is-invalid">
      <section class="result-hero invalid-result">
        <h2>${message.heading}</h2>
        <span>${message.description}</span>
      </section>
      <details class="calculation-details">
        <summary>Szczegóły obliczeń</summary>
        <div class="details-grid">
          ${renderStaticCalculationDetails(calculator)}
        </div>
      </details>
    </div>
  `;
}

function renderStaticCalculationDetails(calculator) {
  const rules = buyerOrderingRules(calculator.configuration);
  if (rules.length > 0) {
    return renderOrderingRulesSection(rules);
  }
  return `<p class="details-empty">Brak dodatkowych zasad zamówienia.</p>`;
}

function validateCalculatorForm(form, calculator) {
  const config = calculator.configuration;
  const firstDimension = config.dimensions?.first ?? { key: "width", label: "Szerokość" };
  const secondDimension = config.dimensions?.second ?? { key: "height", label: "Wysokość" };
  const errors = [];
  const rows = [...form.querySelectorAll("[data-piece-row]")];

  if (rows.length === 0) {
    return { valid: false, errors: [], formErrors: ["Dodaj przynajmniej jeden element."] };
  }

  rows.forEach((row, visibleIndex) => {
    const index = row.dataset.rowIndex;
    const rowLabel = `Element ${visibleIndex + 1}`;
    const quantity = validateQuantity(row, index, rowLabel, errors);
    const firstValue = validateDimension(row, index, firstDimension, rowLabel, config, errors);
    const secondValue = validateDimension(row, index, secondDimension, rowLabel, config, errors);
    validateCustomFields(row, index, rowLabel, config, errors);

    if (firstValue === null || secondValue === null || quantity === null) {
      return;
    }

    if (config.constraints?.enforceSecondNotGreaterThanFirst && secondValue > firstValue) {
      addValidationError(errors, `${secondDimension.key}_${index}`, `${secondDimension.label} nie może być większa niż ${firstDimension.label.toLowerCase()}.`);
    }

    const perimeter = 2 * (firstValue + secondValue);
    if (config.constraints?.maxPerimeterCm && perimeter > config.constraints.maxPerimeterCm) {
      addValidationError(errors, `${secondDimension.key}_${index}`, `Suma boków jednej formatki nie może przekroczyć ${formatLength(config.constraints.maxPerimeterCm, config)}.`);
    }

    const selectedEdges = ["top", "right", "bottom", "left"].filter((edge) => row.querySelector(`[name="edge_${edge}_${cssEscape(index)}"]`)?.checked);
    const dimensions = {
      [firstDimension.key]: firstValue,
      [secondDimension.key]: secondValue,
    };
    for (const edge of selectedEdges) {
      const edgeLength = dimensionValueFor(dimensionKeyForEdge(edge), dimensions, config);
      if (config.edges?.minFinishEdgeCm && edgeLength < config.edges.minFinishEdgeCm) {
        addValidationError(errors, `edges_${index}`, `Wykańczany bok musi mieć minimum ${formatLength(config.edges.minFinishEdgeCm, config)}.`);
        break;
      }
    }
  });

  return { valid: errors.length === 0, errors, formErrors: [] };
}

function validateQuantity(row, index, rowLabel, errors) {
  const name = `quantity_${index}`;
  const value = row.querySelector(`[name="${cssEscape(name)}"]`)?.value;
  const number = Number(value);
  if (isBlank(value)) {
    addValidationError(errors, name, "Podaj ilość.", "missing");
    return null;
  }
  if (!Number.isInteger(number) || number <= 0) {
    addValidationError(errors, name, "Liczba sztuk musi być liczbą całkowitą większą od 0.");
    return null;
  }
  if (number > MAX_PIECE_QUANTITY) {
    addValidationError(errors, name, `Liczba sztuk nie może przekroczyć ${MAX_PIECE_QUANTITY.toLocaleString("pl-PL")}.`);
    return null;
  }
  return number;
}

function validateDimension(row, index, dimension, rowLabel, config, errors) {
  const name = `${dimension.key}_${index}`;
  const value = row.querySelector(`[name="${cssEscape(name)}"]`)?.value;
  const displayNumber = Number(value);
  if (isBlank(value)) {
    addValidationError(errors, name, `Podaj ${dimension.label.toLowerCase()}.`, "missing");
    return null;
  }
  if (!Number.isFinite(displayNumber) || displayNumber <= 0) {
    addValidationError(errors, name, `${dimension.label} musi być liczbą większą od 0.`);
    return null;
  }

  const valueCm = displayNumber * (config.displayUnit === "m" ? 100 : 1);
  const minimum = minimumForDimension(dimension.key, config);
  const maximum = maximumForDimension(dimension.key, config);
  if (minimum && valueCm < minimum) {
    addValidationError(errors, name, `${dimension.label} musi mieć minimum ${formatLength(minimum, config)}.`);
  }
  if (maximum && valueCm > maximum) {
    addValidationError(errors, name, `${dimension.label} nie może przekroczyć ${formatLength(maximum, config)}.`);
  }
  if (Array.isArray(dimension.allowedValuesCm) && dimension.allowedValuesCm.length > 0) {
    const allowed = dimension.allowedValuesCm.some((allowedValue) => Math.abs(Number(allowedValue) - valueCm) < 0.000001);
    if (!allowed) {
    addValidationError(errors, name, `${dimension.label} wybierz z listy dostępnych wartości.`);
    }
  }
  return errors.some((error) => error.field === name) ? null : valueCm;
}

function validateCustomFields(row, rowIndex, rowLabel, config, errors) {
  customFieldDefinitions(config).forEach((field, fieldIndex) => {
    const name = `custom_${fieldIndex}_${rowIndex}`;
    const value = row.querySelector(`[name="${cssEscape(name)}"]`)?.value?.trim() ?? "";
    if (field.required && !value) {
      addValidationError(errors, name, `Podaj ${field.label.toLowerCase()}.`, "missing");
      return;
    }
    if (value && field.allowedValues.length > 0 && !field.allowedValues.includes(value)) {
      addValidationError(errors, name, `${field.label} wybierz z listy dostępnych wartości.`);
    }
  });
}

function addValidationError(errors, field, message, type = "invalid") {
  errors.push({ field, message, type });
}

function renderFieldValidation(form, validation, showAllErrors) {
  form.querySelectorAll(".field").forEach((field) => {
    field.classList.remove("has-error");
    const error = field.querySelector(".field-error");
    if (error) {
      error.textContent = "";
    }
    field.querySelectorAll("input, select").forEach((control) => {
      control.removeAttribute("aria-invalid");
    });
  });
  form.querySelectorAll("[data-piece-row]").forEach((row) => row.classList.remove("has-error"));

  for (const error of validation.errors) {
    const field = form.querySelector(`[data-field="${cssEscape(error.field)}"]`);
    if (!field) {
      continue;
    }
    const control = field.querySelector("input, select");
    const shouldShow = showAllErrors || field.dataset.touched === "true" || control?.dataset.touched === "true";
    if (!shouldShow) {
      continue;
    }
    field.classList.add("has-error");
    field.closest("[data-piece-row]")?.classList.add("has-error");
    const errorTarget = field.querySelector(".field-error");
    if (errorTarget) {
      errorTarget.textContent = error.message;
    }
    control?.setAttribute("aria-invalid", "true");
  }
}

function markTouched(target) {
  if (!target?.matches?.("input, select")) {
    return;
  }
  target.dataset.touched = "true";
  target.closest(".field")?.setAttribute("data-touched", "true");
}

function hasTouchedFields(form) {
  return Boolean(form.querySelector("[data-touched='true']"));
}

function nextRowIndex(rowsContainer) {
  const indexes = [...rowsContainer.querySelectorAll("[data-piece-row]")]
    .map((row) => Number(row.dataset.rowIndex))
    .filter(Number.isFinite);
  return indexes.length > 0 ? Math.max(...indexes) + 1 : 0;
}

function renderEdgePicker(index, config) {
  if (!config.edges?.enabled) {
    return "";
  }

  return `
    <div class="field edge-field" data-field="edges_${index}">
      <span class="field-label">${escapeHtml(config.edges.label ?? "Wykończenie")}</span>
      <fieldset class="edge-picker" aria-label="${escapeHtml(config.edges.label ?? "Wykończenie")}">
        ${["left", "top", "right", "bottom"].map((edge) => `
          <label class="edge-toggle edge-${edge}" title="${edgeLabel(edge)}">
            <input type="checkbox" name="edge_${edge}_${index}" aria-label="${edgeLabel(edge)}" ${checkedEdge(config, edge)}>
            <span>
              <span class="edge-icon edge-icon-${edge}" aria-hidden="true"></span>
            </span>
          </label>
        `).join("")}
      </fieldset>
      <span class="field-error" aria-live="polite"></span>
    </div>
  `;
}

function renderDimensionInput(dimension, index, config) {
  return renderDimensionField(dimension, index, config);
}

function renderQuantityField(index) {
  const name = `quantity_${index}`;
  return renderField({
    name,
    className: "field-quantity",
    label: "Liczba szt.",
    guidance: "Liczba sztuk tego elementu",
    control: `<input id="${escapeHtml(name)}" name="${escapeHtml(name)}" type="number" min="1" max="${MAX_PIECE_QUANTITY}" step="1" value="1" inputmode="numeric" required>`,
  });
}

function renderCustomFields(rowIndex, config) {
  return customFieldDefinitions(config)
    .map((field, fieldIndex) => renderCustomField(field, fieldIndex, rowIndex))
    .join("");
}

function renderCustomField(field, fieldIndex, rowIndex) {
  const name = `custom_${fieldIndex}_${rowIndex}`;
  const required = field.required ? "required" : "";
  if (field.allowedValues.length > 0) {
    return renderField({
      name,
      className: "field-custom",
      label: field.label,
      guidance: field.required ? "Pole wymagane" : "Opcjonalnie",
      control: `<select id="${escapeHtml(name)}" name="${escapeHtml(name)}" ${required}>
        <option value="">Wybierz</option>
        ${field.allowedValues.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}
      </select>`,
    });
  }
  return renderField({
    name,
    className: "field-custom",
    label: field.label,
    guidance: field.required ? "Pole wymagane" : "Opcjonalnie",
    control: `<input id="${escapeHtml(name)}" name="${escapeHtml(name)}" type="text" autocomplete="off" ${required}>`,
  });
}

function customFieldDefinitions(config) {
  if (!Array.isArray(config.customFields)) {
    return [];
  }
  return config.customFields.map((field) => ({
    label: String(field?.label ?? "").trim(),
    required: Boolean(field?.required),
    allowedValues: Array.isArray(field?.allowedValues)
      ? field.allowedValues.map((value) => String(value))
      : Array.isArray(field?.allowedvalues)
        ? field.allowedvalues.map((value) => String(value))
        : [],
  })).filter((field) => field.label);
}

function renderDimensionField(dimension, index, config) {
  const name = `${dimension.key}_${index}`;
  const unit = config.displayUnit ?? "cm";
  const label = dimension.label;
  const labelIcon = renderDimensionIcon(dimension);
  if (Array.isArray(dimension.allowedValuesCm) && dimension.allowedValuesCm.length > 0) {
    return renderField({
      name,
      className: "field-dimension",
      label,
      labelIcon,
      unit,
      guidance: "Wybierz dostępną wartość",
      control: `<select id="${escapeHtml(name)}" name="${escapeHtml(name)}" required>
        <option value="">Wybierz</option>
        ${dimension.allowedValuesCm.map((value) => {
          const displayValue = fromCentimeters(value, unit);
          const normalized = String(Number(displayValue));
          return `<option value="${escapeHtml(normalized)}">${escapeHtml(formatMetric(displayValue))} ${escapeHtml(unit)}</option>`;
        }).join("")}
      </select>`,
    });
  }

  const min = browserMinimumForNumberInput(dimension.key, config);
  const max = maximumForDimension(dimension.key, config);
  const maxAttribute = max ? ` max="${formatMetric(fromCentimeters(max, unit)).replace(",", ".")}"` : "";
  return renderField({
    name,
    className: "field-dimension",
    label,
    labelIcon,
    unit,
    guidance: dimensionGuidance(dimension, config),
    control: `<input id="${escapeHtml(name)}" name="${escapeHtml(name)}" type="number" min="${min}"${maxAttribute} step="1" inputmode="decimal" required>`,
  });
}

function browserMinimumForNumberInput(dimensionKey, config) {
  const unit = config.displayUnit ?? "cm";
  const configuredMinimum = fromCentimeters(minimumForDimension(dimensionKey, config) ?? 0.01, unit);
  return String(Math.max(1, configuredMinimum));
}

function renderField({ name, className = "", label, labelIcon = "", unit = "", guidance = "", control }) {
  return `
    <label class="field ${escapeHtml(className)}" data-field="${escapeHtml(name)}">
      <span class="field-label">${labelIcon}<span class="field-label-text">${escapeHtml(label)}${unit ? ` <span class="field-unit">${escapeHtml(unit)}</span>` : ""}</span></span>
      ${control}
      ${guidance ? `<span class="field-guidance">${escapeHtml(guidance)}</span>` : ""}
      <span class="field-error" aria-live="polite"></span>
    </label>
  `;
}

function renderDimensionIcon(dimension) {
  const descriptor = `${dimension.key ?? ""} ${dimension.label ?? ""}`.toLocaleLowerCase("pl-PL");
  const isHorizontal = descriptor.includes("width") || descriptor.includes("szerokość");
  const paths = isHorizontal
    ? '<path d="M3 5H21M3 19H21"/><path class="dimension-icon-dotted" d="M5 6V18M19 6V18"/>'
    : '<path d="M5 3V21M19 3V21"/><path class="dimension-icon-dotted" d="M6 5H18M6 19H18"/>';

  return `<svg class="dimension-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
}

function dimensionGuidance(dimension, config) {
  const min = minimumForDimension(dimension.key, config);
  const max = maximumForDimension(dimension.key, config);
  if (min && max) {
    return `${formatLength(min, config)} - ${formatLength(max, config)}`;
  }
  if (min) {
    return `Minimum ${formatLength(min, config)}`;
  }
  if (max) {
    return `Maksimum ${formatLength(max, config)}`;
  }
  return "Podaj wymiar";
}

function minimumForDimension(key, config) {
  if (key === config.dimensions?.first?.key) {
    return config.constraints?.minFirstCm;
  }
  return config.constraints?.minSecondCm;
}

function maximumForDimension(key, config) {
  if (key === config.dimensions?.first?.key) {
    return config.constraints?.maxFirstCm;
  }
  return config.constraints?.maxSecondCm;
}

function dimensionForKey(key, config) {
  const first = config.dimensions?.first ?? { key: "length", label: "Długość" };
  const second = config.dimensions?.second ?? { key: "width", label: "Szerokość" };
  if (first.key === key) {
    return first;
  }
  if (second.key === key) {
    return second;
  }
  return { key, label: key };
}

function checkedEdge(config, edge) {
  return Array.isArray(config.edges?.default) && config.edges.default.includes(edge) ? "checked" : "";
}

function edgeLabel(edge) {
  return {
    top: "Góra",
    right: "Prawy",
    bottom: "Dół",
    left: "Lewy",
  }[edge];
}

function fromCentimeters(valueCm, unit) {
  return valueCm / (unit === "m" ? 100 : 1);
}

function dimensionValueFor(key, dimensions, config) {
  if (dimensions[key] !== undefined) {
    return dimensions[key];
  }
  if (key === "length") {
    return dimensions.length ?? dimensions[config.dimensions?.second?.key] ?? dimensions[config.dimensions?.first?.key];
  }
  if (key === "width") {
    return dimensions.width ?? dimensions[config.dimensions?.first?.key] ?? dimensions[config.dimensions?.second?.key];
  }
  return dimensions[key];
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return CSS.escape(String(value));
  }
  return String(value).replaceAll('"', '\\"');
}

function formatLength(valueCm, config) {
  const unit = config.displayUnit ?? "cm";
  return `${formatMetric(fromCentimeters(valueCm, unit))} ${unit}`;
}

function renderNotFound() {
  document.title = "Nie znaleziono - IleSztuk";
  app.innerHTML = `<section class="panel"><h1>Nie znaleziono strony</h1></section>`;
}

function renderError() {
  document.title = "Błąd - IleSztuk";
  app.innerHTML = `<section class="panel"><h1>Nie udało się obsłużyć żądania</h1></section>`;
}

function formatMetric(value) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 4 }).format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

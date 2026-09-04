import { calculateForCalculator, formatResultPieceLine, sellerMetricsFor, ValidationError } from "./js/calculations.js";
import { isValidCalculatorId, loadCalculator } from "./js/calculators.js";
import { formatPiecesQuantity } from "./js/formatting.js";

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
          <p class="seller-name">${escapeHtml(calculator.customerName)}</p>
        </div>
      </div>
      ${usesGraphicalRectangularCalculatorForm(calculator) ? renderFurnitureCalculatorForm(calculator) : renderAreaCalculatorForm(calculator)}
    </section>
  `;
  bindCalculatorForm(calculator);
  bindRows(() => document.querySelector("[data-calculation-form]")?.updateCalculation?.());
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
      <div class="row-title"><span data-row-number>Element 1</span></div>
      <div class="row-fields">
        ${renderQuantityField(index)}
        ${renderDimensionField(first, index, config)}
        ${renderDimensionField(second, index, config)}
      </div>
      <button type="button" class="remove-row-button" data-remove-row aria-label="Usuń element">Usuń</button>
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
      <div class="row-title"><span data-row-number>Element 1</span></div>
      <div class="furniture-fields">
        ${renderQuantityField(index)}
        ${firstInput}
        ${secondInput}
        ${customFields}
      </div>
      ${renderEdgePicker(index, config)}
      <button type="button" class="remove-row-button" data-remove-row aria-label="Usuń element">Usuń</button>
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
    if (event.target.matches("[data-remove-row]")) {
      event.target.closest("[data-piece-row]").remove();
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
      renderInvalidResult(validation, { showSummary: showErrors || hasTouchedFields(form) });
      return;
    }

    try {
      const body = Object.fromEntries(new FormData(form));
      const calculation = calculateForCalculator({ pieces: collectPieces(body, calculator) }, calculator);
      renderBuyerResult(calculation, calculator);
    } catch (error) {
      if (error instanceof ValidationError) {
        renderInvalidResult({ errors: [], formErrors: [error.message], valid: false }, { showSummary: true });
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
          <span class="copy-feedback" data-copy-feedback aria-live="polite"></span>
        </div>
      </section>
      <details class="calculation-details">
        <summary>Szczegóły obliczeń</summary>
        <div class="details-grid">
          ${renderTechnicalDetails(calculator)}
          <section>
            <h3>Elementy</h3>
            <ul class="pieces">
              ${result.pieces.map((piece) => `<li>${escapeHtml(formatResultPieceLine(piece, calculator))}</li>`).join("")}
            </ul>
          </section>
          <section>
            <h3>Parametry wyniku</h3>
            <dl>
              ${sellerMetricsFor(result, calculator).map(([label, value]) => `
                <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>
              `).join("")}
            </dl>
          </section>
        </div>
      </details>
    </div>
  `;
  target.querySelector("[data-copy-target]").addEventListener("click", async (event) => {
    const feedback = target.querySelector("[data-copy-feedback]");
    const id = event.currentTarget.getAttribute("data-copy-target");
    try {
      await navigator.clipboard.writeText(document.getElementById(id).textContent);
      feedback.textContent = "Skopiowano";
      feedback.className = "copy-feedback is-success";
    } catch {
      feedback.textContent = "Nie udało się skopiować";
      feedback.className = "copy-feedback is-error";
    }
  });
}

function renderTechnicalDetails(calculator) {
  const rules = calculatorRuleChips(calculator);
  if (rules.length === 0) {
    return "";
  }
  return `
    <section>
      <h3>Reguły kalkulacji</h3>
      <ul class="pieces">
        ${rules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderInvalidResult(validation, { showSummary = false } = {}) {
  const target = document.querySelector("#result");
  if (!target) {
    return;
  }
  const messages = [...validation.errors.map((error) => error.message), ...(validation.formErrors ?? [])];
  const uniqueMessages = [...new Set(messages)];
  target.innerHTML = `
    <div class="result-panel is-invalid">
      <section class="result-hero invalid-result">
        <p>Wynik chwilowo niedostępny</p>
        <h2>Uzupełnij poprawnie pola</h2>
        <span>Popraw oznaczone dane, aby zobaczyć liczbę sztuk do kupienia.</span>
      </section>
      ${showSummary && uniqueMessages.length > 0 ? `
        <div class="validation-summary">
          <strong>Do poprawy:</strong>
          <ul>${uniqueMessages.slice(0, 4).map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>
        </div>
      ` : ""}
    </div>
  `;
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
      addValidationError(errors, `${secondDimension.key}_${index}`, `${rowLabel}: ${secondDimension.label.toLowerCase()} nie może być większa niż ${firstDimension.label.toLowerCase()}.`);
    }

    const perimeter = 2 * (firstValue + secondValue);
    if (config.constraints?.maxPerimeterCm && perimeter > config.constraints.maxPerimeterCm) {
      addValidationError(errors, `${secondDimension.key}_${index}`, `${rowLabel}: suma boków jednej formatki nie może przekroczyć ${formatLength(config.constraints.maxPerimeterCm, config)}.`);
    }

    const selectedEdges = ["top", "right", "bottom", "left"].filter((edge) => row.querySelector(`[name="edge_${edge}_${cssEscape(index)}"]`)?.checked);
    const dimensions = {
      [firstDimension.key]: firstValue,
      [secondDimension.key]: secondValue,
    };
    for (const edge of selectedEdges) {
      const edgeLength = edge === "top" || edge === "bottom"
        ? dimensionValueFor("length", dimensions, config)
        : dimensionValueFor("width", dimensions, config);
      if (config.edges?.minFinishEdgeCm && edgeLength < config.edges.minFinishEdgeCm) {
        addValidationError(errors, `edges_${index}`, `${rowLabel}: wykańczany bok musi mieć minimum ${formatLength(config.edges.minFinishEdgeCm, config)}.`);
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
    addValidationError(errors, name, `${rowLabel}: podaj ilość.`);
    return null;
  }
  if (!Number.isInteger(number) || number <= 0) {
    addValidationError(errors, name, `${rowLabel}: ilość musi być liczbą całkowitą większą od 0.`);
    return null;
  }
  return number;
}

function validateDimension(row, index, dimension, rowLabel, config, errors) {
  const name = `${dimension.key}_${index}`;
  const value = row.querySelector(`[name="${cssEscape(name)}"]`)?.value;
  const displayNumber = Number(value);
  if (isBlank(value)) {
    addValidationError(errors, name, `${rowLabel}: podaj ${dimension.label.toLowerCase()}.`);
    return null;
  }
  if (!Number.isFinite(displayNumber) || displayNumber <= 0) {
    addValidationError(errors, name, `${rowLabel}: ${dimension.label.toLowerCase()} musi być liczbą większą od 0.`);
    return null;
  }

  const valueCm = displayNumber * (config.displayUnit === "m" ? 100 : 1);
  const minimum = minimumForDimension(dimension.key, config);
  const maximum = maximumForDimension(dimension.key, config);
  if (minimum && valueCm < minimum) {
    addValidationError(errors, name, `${rowLabel}: ${dimension.label.toLowerCase()} musi mieć minimum ${formatLength(minimum, config)}.`);
  }
  if (maximum && valueCm > maximum) {
    addValidationError(errors, name, `${rowLabel}: ${dimension.label.toLowerCase()} nie może przekroczyć ${formatLength(maximum, config)}.`);
  }
  if (Array.isArray(dimension.allowedValuesCm) && dimension.allowedValuesCm.length > 0) {
    const allowed = dimension.allowedValuesCm.some((allowedValue) => Math.abs(Number(allowedValue) - valueCm) < 0.000001);
    if (!allowed) {
      addValidationError(errors, name, `${rowLabel}: ${dimension.label.toLowerCase()} wybierz z listy dostępnych wartości.`);
    }
  }
  return errors.some((error) => error.field === name) ? null : valueCm;
}

function validateCustomFields(row, rowIndex, rowLabel, config, errors) {
  customFieldDefinitions(config).forEach((field, fieldIndex) => {
    const name = `custom_${fieldIndex}_${rowIndex}`;
    const value = row.querySelector(`[name="${cssEscape(name)}"]`)?.value?.trim() ?? "";
    if (field.required && !value) {
      addValidationError(errors, name, `${rowLabel}: podaj ${field.label.toLowerCase()}.`);
      return;
    }
    if (value && field.allowedValues.length > 0 && !field.allowedValues.includes(value)) {
      addValidationError(errors, name, `${rowLabel}: ${field.label.toLowerCase()} wybierz z listy dostępnych wartości.`);
    }
  });
}

function addValidationError(errors, field, message) {
  errors.push({ field, message });
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

function calculatorRuleChips(calculator) {
  const config = calculator.configuration;
  const firstDimension = config.dimensions?.first ?? { key: "length", label: "Długość" };
  const secondDimension = config.dimensions?.second ?? { key: "width", label: "Szerokość" };
  return [
    ...rectangularRuleChips(config),
    config.edges?.minFinishEdgeCm ? `${config.edges.label ?? "Wykończenie"}: bok min. ${formatLength(config.edges.minFinishEdgeCm, config)}` : null,
    config.constraints?.maxPerimeterCm ? `Max suma boków ${formatLength(config.constraints.maxPerimeterCm, config)}` : null,
    config.constraints?.maxFirstCm ? `Max ${firstDimension.label.toLowerCase()} ${formatLength(config.constraints.maxFirstCm, config)}` : null,
    config.constraints?.maxSecondCm ? `Max ${secondDimension.label.toLowerCase()} ${formatLength(config.constraints.maxSecondCm, config)}` : null,
  ].filter(Boolean);
}

function rectangularRuleChips(config) {
  const pricing = config.pricing ?? {};
  const rules = [];

  if (pricing.coefficient) {
    rules.push(`Powierzchnia ${areaUnitLabel(pricing.areaUnit)} x ${formatMetric(pricing.coefficient)}`);
  }

  if (config.dimensions?.rounding?.enabled) {
    rules.push(`Wymiary: ${roundingLabel(config.dimensions.rounding)}`);
  }
  if (config.rowArea?.rounding?.enabled) {
    rules.push(`Wiersze: ${roundingLabel(config.rowArea.rounding)}`);
  }
  if (config.totalArea?.rounding?.enabled) {
    rules.push(`Suma: ${roundingLabel(config.totalArea.rounding)}`);
  }
  rules.push(`Wynik: ${roundingLabel(config.purchasableQuantity?.rounding ?? { mode: "round", precision: 0 })}`);

  return rules;
}

function renderEdgePicker(index, config) {
  if (!config.edges?.enabled) {
    return "";
  }

  return `
    <div class="field edge-field" data-field="edges_${index}">
      <span class="field-label">${escapeHtml(config.edges.label ?? "Wykończenie")}</span>
      <fieldset class="edge-picker" aria-label="${escapeHtml(config.edges.label ?? "Wykończenie")}">
        ${["top", "right", "bottom", "left"].map((edge) => `
          <label class="edge-toggle edge-${edge}">
            <input type="checkbox" name="edge_${edge}_${index}" ${checkedEdge(config, edge)}>
            <span>${edgeLabel(edge)}</span>
          </label>
        `).join("")}
        <div class="board-preview" aria-hidden="true">
          <span>${escapeHtml(config.edges.label ?? "Wykończenie")}</span>
        </div>
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
    label: "Ilość",
    guidance: "Liczba sztuk tego elementu",
    control: `<input id="${escapeHtml(name)}" name="${escapeHtml(name)}" type="number" min="1" step="1" value="1" inputmode="numeric" required>`,
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
  if (Array.isArray(dimension.allowedValuesCm) && dimension.allowedValuesCm.length > 0) {
    return renderField({
      name,
      label,
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
    label,
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

function renderField({ name, label, unit = "", guidance = "", control }) {
  return `
    <label class="field" data-field="${escapeHtml(name)}">
      <span class="field-label">${escapeHtml(label)}${unit ? ` <span>${escapeHtml(unit)}</span>` : ""}</span>
      ${control}
      ${guidance ? `<span class="field-guidance">${escapeHtml(guidance)}</span>` : ""}
      <span class="field-error" aria-live="polite"></span>
    </label>
  `;
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

function roundingLabel(rounding) {
  const mode = {
    ceil: "w górę",
    floor: "w dół",
    round: "matematycznie",
  }[rounding.mode] ?? rounding.mode;
  return `${mode} do ${rounding.precision === 0 ? "pełnej liczby" : `${rounding.precision} miejsc`}`;
}

function areaUnitLabel(areaUnit) {
  return areaUnit === "m2" ? "m²" : "cm²";
}

function fromCentimeters(valueCm, unit) {
  return valueCm / (unit === "m" ? 100 : 1);
}

function dimensionValueFor(key, dimensions, config) {
  if (dimensions[key] !== undefined) {
    return dimensions[key];
  }
  if (key === "length") {
    return dimensions[config.dimensions?.first?.key] ?? dimensions[config.dimensions?.second?.key];
  }
  if (key === "width") {
    return dimensions.width ?? dimensions[config.dimensions?.second?.key] ?? dimensions[config.dimensions?.first?.key];
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

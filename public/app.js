import { calculateForCalculator, formatResultPieceLine, sellerMetricsFor, ValidationError } from "./js/calculations.js";
import { isValidCalculatorId, loadCalculator } from "./js/calculators.js";

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
    <section class="panel">
      <h1>${escapeHtml(calculator.calculatorName)}</h1>
      <p class="muted">${escapeHtml(calculator.customerName)}</p>
      ${usesGraphicalRectangularCalculatorForm(calculator) ? renderFurnitureCalculatorForm(calculator) : renderAreaCalculatorForm(calculator)}
    </section>
  `;
  bindCalculatorForm(calculator);
  bindRows(() => document.querySelector("[data-calculation-form]")?.updateCalculation?.());
}

function usesGraphicalRectangularCalculatorForm(calculator) {
  return Boolean(
    calculator.configuration.edges?.enabled
      || calculator.configuration.decor?.enabled
      || calculator.configuration.dimensions?.first?.key === "length"
      || calculator.configuration.dimensions?.second?.key === "length",
  );
}

function renderAreaCalculatorForm(calculator) {
  const config = calculator.configuration;
  const first = config.dimensions?.first ?? { key: "width", label: "Szerokość" };
  const second = config.dimensions?.second ?? { key: "height", label: "Wysokość" };
  const rules = rectangularRuleChips(config);

  return `
    <form data-calculation-form>
      ${rules.length > 0 ? `<div class="rule-strip">${rules.map((rule) => `<span>${escapeHtml(rule)}</span>`).join("")}</div>` : ""}
      <div class="form-grid" data-piece-rows>
        <div class="piece-row" data-piece-row>
          <input name="quantity_0" type="number" min="1" step="1" value="1" placeholder="Ilość" required>
          ${renderDimensionInput(first, 0, config)}
          ${renderDimensionInput(second, 0, config)}
          <button type="button" class="icon-button secondary" data-remove-row aria-label="Usuń wiersz">-</button>
        </div>
      </div>
      <div class="row-controls">
        <button type="button" class="icon-button" data-add-row aria-label="Dodaj wiersz">+</button>
      </div>
    </form>
    <template data-row-template>
      <div class="piece-row" data-piece-row>
        <input name="quantity___INDEX__" type="number" min="1" step="1" value="1" placeholder="Ilość" required>
        ${renderDimensionInput(first, "__INDEX__", config)}
        ${renderDimensionInput(second, "__INDEX__", config)}
        <button type="button" class="icon-button secondary" data-remove-row aria-label="Usuń wiersz">-</button>
      </div>
    </template>
    <section id="result" aria-live="polite"></section>
  `;
}

function renderFurnitureCalculatorForm(calculator) {
  const config = calculator.configuration;
  const firstDimension = config.dimensions?.first ?? { key: "length", label: "Długość" };
  const secondDimension = config.dimensions?.second ?? { key: "width", label: "Szerokość" };
  const rules = [
    ...rectangularRuleChips(config),
    config.edges?.minFinishEdgeCm ? `${config.edges.label ?? "Wykończenie"}: bok min. ${formatLength(config.edges.minFinishEdgeCm, config)}` : null,
    config.constraints?.maxPerimeterCm ? `Max suma boków ${formatLength(config.constraints.maxPerimeterCm, config)}` : null,
    config.constraints?.maxFirstCm ? `Max ${firstDimension.label.toLowerCase()} ${formatLength(config.constraints.maxFirstCm, config)}` : null,
    config.constraints?.maxSecondCm ? `Max ${secondDimension.label.toLowerCase()} ${formatLength(config.constraints.maxSecondCm, config)}` : null,
  ].filter(Boolean);

  return `
    <form data-calculation-form>
      <div class="rule-strip">
        ${rules.map((rule) => `<span>${escapeHtml(rule)}</span>`).join("")}
      </div>
      <div class="form-grid furniture-grid" data-piece-rows>
        ${renderFurnitureRow(0, calculator)}
      </div>
      <div class="row-controls">
        <button type="button" class="icon-button" data-add-row aria-label="Dodaj wiersz">+</button>
      </div>
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
  const decorInput = config.decor?.enabled
    ? `<input name="decor_${index}" type="text" placeholder="Dekor" ${config.decor.required ? "required" : ""}>`
    : "";

  return `
    <div class="furniture-row ${config.edges?.enabled ? "" : "no-edge-picker"}" data-piece-row>
      <div class="furniture-fields">
        <input name="quantity_${index}" type="number" min="1" step="1" value="1" placeholder="Ilość" required>
        ${firstInput}
        ${secondInput}
        ${decorInput}
      </div>
      ${renderEdgePicker(index, config)}
      <button type="button" class="icon-button secondary" data-remove-row aria-label="Usuń wiersz">-</button>
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
    rows.forEach((row) => {
      const removeButton = row.querySelector("[data-remove-row]");
      if (removeButton) {
        removeButton.hidden = rowCount <= 1;
      }
    });
  };

  addButton.addEventListener("click", () => {
    const rowCount = rowsContainer.querySelectorAll("[data-piece-row]").length;
    if (rowCount >= maxRows) {
      return;
    }
    const template = document.querySelector("[data-row-template]");
    const wrapper = document.createElement("div");
    wrapper.innerHTML = template.innerHTML.replaceAll("__INDEX__", String(rowCount));
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
    try {
      const body = Object.fromEntries(new FormData(form));
      const calculation = calculateForCalculator({ pieces: collectPieces(body, calculator) }, calculator);
      renderBuyerResult(calculation, calculator);
    } catch (error) {
      if (error instanceof ValidationError) {
        renderValidationState(error.message, showErrors);
        return;
      }
      throw error;
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    updateResult({ showErrors: true });
  });

  form.addEventListener("input", () => updateResult());
  form.addEventListener("change", () => updateResult());
  form.updateCalculation = updateResult;
  updateResult();
}

function collectPieces(body, calculator) {
  const pieces = [];
  const firstKey = calculator.configuration?.dimensions?.first?.key ?? "width";
  const secondKey = calculator.configuration?.dimensions?.second?.key ?? "height";
  for (let index = 0; index < 10; index += 1) {
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
      decor: body[`decor_${index}`] ?? "",
      edges: ["top", "right", "bottom", "left"].filter((edge) => body[`edge_${edge}_${index}`] === "on"),
    });
  }
  return pieces;
}

function isBlank(value) {
  return value === undefined || value === "";
}

function renderBuyerResult(calculation, calculator) {
  const result = calculation.result;
  const target = document.querySelector("#result");
  target.innerHTML = `
    <div class="result-panel">
      <p class="muted">${escapeHtml(calculator.calculatorName)}</p>
      <h2>Kup ${result.purchasableItems} sztuk</h2>
      <h3>Do uwag do zamówienia wklej</h3>
      <pre id="marketplace-note">${escapeHtml(calculation.marketplaceNote)}</pre>
      <div class="actions">
        <button type="button" data-copy-target="marketplace-note">Kopiuj</button>
      </div>
      <details class="calculation-details">
        <summary>Szczegóły kalkulacji</summary>
        <h3>Elementy</h3>
        <ul class="pieces">
          ${result.pieces.map((piece) => `<li>${escapeHtml(formatResultPieceLine(piece, calculator))}</li>`).join("")}
        </ul>
        <dl>
          ${sellerMetricsFor(result, calculator).map(([label, value]) => `
            <div><dt>${escapeHtml(label)}:</dt><dd>${escapeHtml(value)}</dd></div>
          `).join("")}
        </dl>
      </details>
    </div>
  `;
  target.querySelector("[data-copy-target]").addEventListener("click", async (event) => {
    const id = event.currentTarget.getAttribute("data-copy-target");
    await navigator.clipboard.writeText(document.getElementById(id).textContent);
    event.currentTarget.textContent = "Skopiowano";
  });
}

function renderValidationState(message, showErrors) {
  const target = document.querySelector("#result");
  if (!target) {
    return;
  }
  target.innerHTML = showErrors ? `<p class="error">${escapeHtml(message)}</p>` : "";
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

  return `<fieldset class="edge-picker" aria-label="${escapeHtml(config.edges.label ?? "Wykończenie")}">
    ${["top", "right", "bottom", "left"].map((edge) => `
      <label class="edge-toggle edge-${edge}">
        <input type="checkbox" name="edge_${edge}_${index}" ${checkedEdge(config, edge)}>
        <span>${edgeLabel(edge)}</span>
      </label>
    `).join("")}
    <div class="board-preview" aria-hidden="true">
      <span>${escapeHtml(config.edges.label ?? "Wykończenie")}</span>
    </div>
  </fieldset>`;
}

function renderDimensionInput(dimension, index, config) {
  const name = `${dimension.key}_${index}`;
  const unit = config.displayUnit ?? "cm";
  const label = `${dimension.label} ${unit}`;
  if (Array.isArray(dimension.allowedValuesCm) && dimension.allowedValuesCm.length > 0) {
    return `<select name="${escapeHtml(name)}" required aria-label="${escapeHtml(label)}">
      <option value="">${escapeHtml(label)}</option>
      ${dimension.allowedValuesCm.map((value) => {
        const displayValue = fromCentimeters(value, unit);
        const normalized = String(Number(displayValue));
        return `<option value="${escapeHtml(normalized)}">${escapeHtml(formatMetric(displayValue))} ${escapeHtml(unit)}</option>`;
      }).join("")}
    </select>`;
  }

  const min = formatMetric(fromCentimeters(minimumForDimension(dimension.key, config) ?? 0.01, unit)).replace(",", ".");
  const max = maximumForDimension(dimension.key, config);
  const maxAttribute = max ? ` max="${formatMetric(fromCentimeters(max, unit)).replace(",", ".")}"` : "";
  return `<input name="${escapeHtml(name)}" type="number" min="${min}"${maxAttribute} step="0.01" placeholder="${escapeHtml(label)}" required>`;
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

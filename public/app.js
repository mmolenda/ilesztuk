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
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      ${usesGraphicalRectangularCalculatorForm(calculator) ? renderFurnitureCalculatorForm(calculator) : renderAreaCalculatorForm(calculator)}
    </section>
  `;
  bindRows();
  bindCalculatorForm(calculator);
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
  const minDimension = formatMetric(config.constraints?.minDimensionCm ?? 0.01).replace(",", ".");
  const rules = rectangularRuleChips(config);

  return `
    <form data-calculation-form>
      ${rules.length > 0 ? `<div class="rule-strip">${rules.map((rule) => `<span>${escapeHtml(rule)}</span>`).join("")}</div>` : ""}
      <div class="form-grid" data-piece-rows>
        <div class="piece-row" data-piece-row>
          <input name="quantity_0" type="number" min="1" step="1" value="1" placeholder="Ilość" required>
          ${renderDimensionInput(first, 0, minDimension)}
          ${renderDimensionInput(second, 0, minDimension)}
          <span class="row-spacer" aria-hidden="true"></span>
        </div>
      </div>
      <div class="row-controls">
        <button type="button" class="icon-button" data-add-row aria-label="Dodaj wiersz">+</button>
      </div>
      <button type="submit">Oblicz</button>
    </form>
    <template data-row-template>
      <div class="piece-row" data-piece-row>
        <input name="quantity___INDEX__" type="number" min="1" step="1" value="1" placeholder="Ilość" required>
        ${renderDimensionInput(first, "__INDEX__", minDimension)}
        ${renderDimensionInput(second, "__INDEX__", minDimension)}
        <button type="button" class="icon-button secondary" data-remove-row aria-label="Usuń wiersz">-</button>
      </div>
    </template>
    <section id="result"></section>
  `;
}

function renderFurnitureCalculatorForm(calculator) {
  const config = calculator.configuration;
  const rules = [
    ...rectangularRuleChips(config),
    config.billableDimensions?.minCm ? `Min. wymiar do rozliczenia ${formatMetric(config.billableDimensions.minCm)} cm` : null,
    config.edges?.minCoatedEdgeCm ? `Oklejany bok min. ${formatMetric(config.edges.minCoatedEdgeCm)} cm` : null,
    config.constraints?.maxPerimeterCm ? `Max suma boków ${formatMetric(config.constraints.maxPerimeterCm)} cm` : null,
    config.constraints?.maxLengthCm ? `Max długość ${formatMetric(config.constraints.maxLengthCm)} cm` : null,
    config.constraints?.packageMaxCm ? `Paczka max ${formatMetric(config.constraints.packageMaxCm)} cm` : null,
  ].filter(Boolean);

  return `
    <form data-calculation-form>
      <div class="rule-strip">
        ${rules.map((rule) => `<span>${escapeHtml(rule)}</span>`).join("")}
      </div>
      <div class="form-grid furniture-grid" data-piece-rows>
        ${renderFurnitureRow(0, false, calculator)}
      </div>
      <div class="row-controls">
        <button type="button" class="icon-button" data-add-row aria-label="Dodaj wiersz">+</button>
      </div>
      <button type="submit">Oblicz</button>
    </form>
    <template data-row-template>
      ${renderFurnitureRow("__INDEX__", true, calculator)}
    </template>
    <section id="result"></section>
  `;
}

function renderFurnitureRow(index, removable, calculator) {
  const config = calculator.configuration;
  const minDimension = formatMetric(config.constraints?.minDimensionCm ?? 0.01).replace(",", ".");
  const firstDimension = config.dimensions?.first ?? { key: "length", label: "Długość" };
  const secondDimension = config.dimensions?.second ?? { key: "width", label: "Szerokość" };
  const noteOrder = config.dimensions?.noteOrder ?? [firstDimension.key, secondDimension.key];
  const firstInput = renderDimensionInput(dimensionForKey(noteOrder[0], config), index, minDimension);
  const secondInput = renderDimensionInput(dimensionForKey(noteOrder[1], config), index, minDimension);
  const decorInput = config.decor?.enabled
    ? `<input name="decor_${index}" type="text" placeholder="Dekor" ${config.decor.required ? "required" : ""}>`
    : "";

  return `
    <div class="furniture-row" data-piece-row>
      <div class="furniture-fields">
        <input name="quantity_${index}" type="number" min="1" step="1" value="1" placeholder="Ilość" required>
        ${firstInput}
        ${secondInput}
        ${decorInput}
      </div>
      <fieldset class="edge-picker" aria-label="Oklejane boki">
        ${["top", "right", "bottom", "left"].map((edge) => `
          <label class="edge-toggle edge-${edge}">
            <input type="checkbox" name="edge_${edge}_${index}" ${checkedEdge(config, edge)}>
            <span>${edgeLabel(edge)}</span>
          </label>
        `).join("")}
        <div class="board-preview" aria-hidden="true"></div>
      </fieldset>
      ${removable ? '<button type="button" class="icon-button secondary" data-remove-row aria-label="Usuń wiersz">-</button>' : '<span class="row-spacer" aria-hidden="true"></span>'}
    </div>
  `;
}

function bindRows() {
  const maxRows = 10;
  const rowsContainer = document.querySelector("[data-piece-rows]");
  const addButton = document.querySelector("[data-add-row]");
  if (!rowsContainer || !addButton) {
    return;
  }

  const updateRowControls = () => {
    const rowCount = rowsContainer.querySelectorAll("[data-piece-row]").length;
    addButton.disabled = rowCount >= maxRows;
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
  });

  rowsContainer.addEventListener("click", (event) => {
    if (event.target.matches("[data-remove-row]")) {
      event.target.closest("[data-piece-row]").remove();
      updateRowControls();
    }
  });

  updateRowControls();
}

function bindCalculatorForm(calculator) {
  const form = document.querySelector("[data-calculation-form]");
  if (!form) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const body = Object.fromEntries(new FormData(form));
      const calculation = calculateForCalculator({ pieces: collectPieces(body, calculator) }, calculator);
      renderBuyerResult(calculation, calculator);
    } catch (error) {
      if (error instanceof ValidationError) {
        renderCalculatorPage(calculator, error.message);
        return;
      }
      throw error;
    }
  });
}

function collectPieces(body, calculator) {
  const pieces = [];
  const firstKey = calculator.configuration?.dimensions?.first?.key ?? "width";
  const secondKey = calculator.configuration?.dimensions?.second?.key ?? "height";
  for (let index = 0; index < 10; index += 1) {
    const quantity = body[`quantity_${index}`];
    const first = body[`${firstKey}_${index}`];
    const second = body[`${secondKey}_${index}`];
    if ([quantity, first, second].every((value) => value === undefined || value === "")) {
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

function renderBuyerResult(calculation, calculator) {
  const result = calculation.result;
  const target = document.querySelector("#result");
  target.innerHTML = `
    <div class="result-panel">
      <p class="muted">${escapeHtml(calculator.calculatorName)}</p>
      <h2>Kup ${result.purchasableItems} ${escapeHtml(result.purchasableUnitLabel)}</h2>
      <h3>Elementy</h3>
      <ul class="pieces">
        ${result.pieces.map((piece) => `<li>${escapeHtml(formatResultPieceLine(piece, calculator))}</li>`).join("")}
      </ul>
      <dl>
        ${sellerMetricsFor(result, calculator).map(([label, value]) => `
          <div><dt>${escapeHtml(label)}:</dt><dd>${escapeHtml(value)}</dd></div>
        `).join("")}
      </dl>
      <h3>Do uwag do zamówienia wklej</h3>
      <pre id="marketplace-note">${escapeHtml(calculation.marketplaceNote)}</pre>
      <div class="actions">
        <button type="button" data-copy-target="marketplace-note">Kopiuj</button>
      </div>
    </div>
  `;
  target.querySelector("[data-copy-target]").addEventListener("click", async (event) => {
    const id = event.currentTarget.getAttribute("data-copy-target");
    await navigator.clipboard.writeText(document.getElementById(id).textContent);
    event.currentTarget.textContent = "Skopiowano";
  });
}

function rectangularRuleChips(config) {
  const pricing = config.pricing ?? {};
  const rules = [];

  if (pricing.mode === "multiply_area") {
    rules.push(`Powierzchnia ${areaUnitLabel(pricing.areaUnit)} x ${formatMetric(pricing.multiplier)}`);
  } else if (pricing.mode === "divide_by_area_per_item") {
    rules.push(`${formatMetric(pricing.areaPerItemCm2)} cm² / sztuka`);
  } else if (pricing.coefficient) {
    rules.push(`Powierzchnia ${areaUnitLabel(pricing.areaUnit)} / ${formatMetric(pricing.coefficient)}`);
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

function renderDimensionInput(dimension, index, min) {
  const name = `${dimension.key}_${index}`;
  const label = `${dimension.label} cm`;
  if (Array.isArray(dimension.allowedValuesCm) && dimension.allowedValuesCm.length > 0) {
    return `<select name="${escapeHtml(name)}" required aria-label="${escapeHtml(label)}">
      <option value="">${escapeHtml(label)}</option>
      ${dimension.allowedValuesCm.map((value) => {
        const normalized = String(Number(value));
        return `<option value="${escapeHtml(normalized)}">${escapeHtml(formatMetric(value))} cm</option>`;
      }).join("")}
    </select>`;
  }

  return `<input name="${escapeHtml(name)}" type="number" min="${min}" step="0.01" placeholder="${escapeHtml(label)}" required>`;
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

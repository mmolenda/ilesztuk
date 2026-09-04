export function formatPiecesQuantity(quantity, grammaticalCase = "nominative") {
  const absolute = Math.abs(Number(quantity));
  const singular = grammaticalCase === "accusative" ? "sztukę" : "sztuka";
  const lastTwo = absolute % 100;
  const lastOne = absolute % 10;

  if (absolute === 1) {
    return `${quantity} ${singular}`;
  }
  if (lastOne >= 2 && lastOne <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) {
    return `${quantity} sztuki`;
  }
  return `${quantity} sztuk`;
}

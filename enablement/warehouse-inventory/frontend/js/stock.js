/**
 * Stock adjustment + history — UI-3 (STK-1/2) and the history half of
 * UI-4 (HIST-1).
 */

let openStockAdjustmentProductId = null;
let openHistoryProductId = null;

function getStockMessageEl() {
  return document.getElementById("stock-adjustment-error");
}

function showStockMessage(message) {
  const el = getStockMessageEl();
  el.textContent = message;
  el.hidden = false;
}

function clearStockMessage() {
  const el = getStockMessageEl();
  el.textContent = "";
  el.hidden = true;
}

function openStockAdjustmentForm(productId) {
  openStockAdjustmentProductId = productId;
  const section = document.getElementById("stock-adjustment-form-section");
  section.hidden = false;
  document.getElementById("stock-adjustment-delta").value = "";
  clearStockMessage();
}

function closeStockAdjustmentForm() {
  openStockAdjustmentProductId = null;
  document.getElementById("stock-adjustment-form-section").hidden = true;
}

async function handleAdjustStock(event) {
  event.preventDefault();
  if (openStockAdjustmentProductId === null) return;
  clearStockMessage();

  const delta = document.getElementById("stock-adjustment-delta").value;
  const submitButton = document.getElementById("stock-adjustment-form-submit-button");

  submitButton.disabled = true;
  try {
    const adjustment = await adjustStock(openStockAdjustmentProductId, delta);
    showStockMessage(`Stock adjusted. New balance: ${adjustment.resulting_balance}.`);
    await refreshProducts();
  } catch (err) {
    showStockMessage(err.message);
  } finally {
    submitButton.disabled = false;
  }
}

async function openHistoryView(productId) {
  openHistoryProductId = productId;
  const section = document.getElementById("history-view-section");
  section.hidden = false;

  const tbody = document.getElementById("history-view-body");
  tbody.innerHTML = "";

  try {
    const history = await getProductHistory(productId);
    for (const entry of history) {
      const row = document.createElement("tr");
      row.dataset.testid = "history-view-row";

      const timeCell = document.createElement("td");
      timeCell.textContent = new Date(entry.created_at).toLocaleString();
      row.appendChild(timeCell);

      const deltaCell = document.createElement("td");
      deltaCell.textContent = entry.delta > 0 ? `+${entry.delta}` : String(entry.delta);
      row.appendChild(deltaCell);

      const balanceCell = document.createElement("td");
      balanceCell.textContent = String(entry.resulting_balance);
      row.appendChild(balanceCell);

      tbody.appendChild(row);
    }
  } catch (err) {
    showStockMessage(err.message);
  }
}

function closeHistoryView() {
  openHistoryProductId = null;
  document.getElementById("history-view-section").hidden = true;
}

function initStockSection() {
  document
    .getElementById("stock-adjustment-form")
    .addEventListener("submit", handleAdjustStock);
  document
    .getElementById("stock-adjustment-cancel-button")
    .addEventListener("click", closeStockAdjustmentForm);
  document
    .getElementById("history-view-close-button")
    .addEventListener("click", closeHistoryView);
}

/**
 * Products section — UI-2 (PROD-1..5), plus the listing/filter half of
 * UI-4. Re-queries the API on every sort/filter change (no client-side
 * sort/filter duplication, per business-rules.md).
 */

let products = [];
let currentSortBy = "name";
let currentSortDir = "asc";
let currentCategoryFilter = "";
let editingProductId = null; // null = create-form mode; otherwise = update-form mode

function getProductMessageEl() {
  return document.getElementById("product-form-error");
}

function showProductMessage(message) {
  const el = getProductMessageEl();
  el.textContent = message;
  el.hidden = false;
}

function clearProductMessage() {
  const el = getProductMessageEl();
  el.textContent = "";
  el.hidden = true;
}

async function refreshCategoryPicker() {
  const activeCategories = await listCategories();
  const selects = [
    document.getElementById("product-create-category"),
    document.getElementById("product-filter-category"),
  ];

  for (const select of selects) {
    if (!select) continue;
    const previousValue = select.value;
    select.innerHTML = "";

    if (select.id === "product-filter-category") {
      const allOption = document.createElement("option");
      allOption.value = "";
      allOption.textContent = "All categories";
      select.appendChild(allOption);
    }

    for (const category of activeCategories) {
      const option = document.createElement("option");
      option.value = String(category.id);
      option.textContent = category.name;
      select.appendChild(option);
    }
    select.value = previousValue;
  }
}

function renderProductList() {
  const tbody = document.getElementById("product-list-body");
  tbody.innerHTML = "";

  for (const product of products) {
    const row = document.createElement("tr");
    row.dataset.testid = "product-list-row";
    row.dataset.productId = String(product.id);

    const nameCell = document.createElement("td");
    nameCell.textContent = product.name;
    row.appendChild(nameCell);

    const priceCell = document.createElement("td");
    priceCell.textContent = `$${product.price}`;
    row.appendChild(priceCell);

    const codeCell = document.createElement("td");
    codeCell.textContent = product.code;
    row.appendChild(codeCell);

    const quantityCell = document.createElement("td");
    quantityCell.dataset.testid = "product-list-row-quantity";
    quantityCell.textContent = String(product.quantity);
    row.appendChild(quantityCell);

    const actionsCell = document.createElement("td");

    const editButton = document.createElement("button");
    editButton.textContent = "Edit";
    editButton.dataset.testid = "product-list-row-edit-button";
    editButton.addEventListener("click", () => enterEditMode(product));
    actionsCell.appendChild(editButton);

    const adjustButton = document.createElement("button");
    adjustButton.textContent = "Adjust Stock";
    adjustButton.dataset.testid = "product-list-row-adjust-stock-button";
    adjustButton.addEventListener("click", () => openStockAdjustmentForm(product.id));
    actionsCell.appendChild(adjustButton);

    const historyButton = document.createElement("button");
    historyButton.textContent = "History";
    historyButton.dataset.testid = "product-list-row-history-button";
    historyButton.addEventListener("click", () => openHistoryView(product.id));
    actionsCell.appendChild(historyButton);

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.dataset.testid = "product-list-row-delete-button";
    deleteButton.addEventListener("click", () => handleDeleteProduct(product.id, product.name));
    actionsCell.appendChild(deleteButton);

    row.appendChild(actionsCell);
    tbody.appendChild(row);
  }
}

async function refreshProducts() {
  products = await listProducts({
    sortBy: currentSortBy,
    sortDir: currentSortDir,
    categoryId: currentCategoryFilter || null,
  });
  renderProductList();
  return products;
}

function enterEditMode(product) {
  editingProductId = product.id;
  document.getElementById("product-create-name").value = product.name;
  document.getElementById("product-create-price").value = product.price;
  document.getElementById("product-create-code").value = product.code;
  document.getElementById("product-create-category").value = String(product.category_id);

  const initialStockInput = document.getElementById("product-create-initial-stock");
  initialStockInput.value = "";
  initialStockInput.disabled = true; // stock is not editable via this form (business-rules.md)

  document.getElementById("product-create-submit-button").textContent = "Save Changes";
  document.getElementById("product-create-cancel-button").hidden = false;
  clearProductMessage();
}

function exitEditMode() {
  editingProductId = null;
  document.getElementById("product-create-form").reset();
  document.getElementById("product-create-initial-stock").disabled = false;
  document.getElementById("product-create-submit-button").textContent = "Create Product";
  document.getElementById("product-create-cancel-button").hidden = true;
}

async function handleCreateOrUpdateProduct(event) {
  event.preventDefault();
  clearProductMessage();

  const name = document.getElementById("product-create-name").value;
  const price = document.getElementById("product-create-price").value;
  const code = document.getElementById("product-create-code").value;
  const categoryId = document.getElementById("product-create-category").value;
  const initialStock = document.getElementById("product-create-initial-stock").value;
  const submitButton = document.getElementById("product-create-submit-button");

  submitButton.disabled = true;
  try {
    if (editingProductId !== null) {
      await updateProduct(editingProductId, { name, price, code, categoryId });
      exitEditMode();
    } else {
      await createProduct({ name, price, code, categoryId, initialStock });
      document.getElementById("product-create-form").reset();
    }
    await refreshProducts();
  } catch (err) {
    showProductMessage(err.message);
  } finally {
    submitButton.disabled = false;
  }
}

async function handleDeleteProduct(productId, productName) {
  const confirmed = window.confirm(
    `Delete product '${productName}'? This cannot be undone if it has no stock history.`
  );
  if (!confirmed) return;

  clearProductMessage();
  try {
    const result = await deleteProduct(productId);
    if (result.outcome === "hard_deleted") {
      showProductMessage("Product permanently deleted.");
    } else {
      showProductMessage(
        "Product archived — it has stock history, so it was hidden rather than removed. Its history remains viewable."
      );
    }
    await refreshProducts();
  } catch (err) {
    showProductMessage(err.message);
    await refreshProducts();
  }
}

function handleFilterOrSortChange() {
  currentSortBy = document.getElementById("product-filter-sort-by").value;
  currentSortDir = document.getElementById("product-filter-sort-dir").value;
  currentCategoryFilter = document.getElementById("product-filter-category").value;
  refreshProducts();
}

function initProductsSection() {
  document
    .getElementById("product-create-form")
    .addEventListener("submit", handleCreateOrUpdateProduct);
  document
    .getElementById("product-create-cancel-button")
    .addEventListener("click", exitEditMode);
  document
    .getElementById("product-filter-sort-by")
    .addEventListener("change", handleFilterOrSortChange);
  document
    .getElementById("product-filter-sort-dir")
    .addEventListener("change", handleFilterOrSortChange);
  document
    .getElementById("product-filter-category")
    .addEventListener("change", handleFilterOrSortChange);

  refreshCategoryPicker();
  refreshProducts();
}

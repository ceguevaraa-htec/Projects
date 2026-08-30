/**
 * Categories section — UI-1 (CAT-1..4).
 * No component framework: plain DOM manipulation, re-rendering the list
 * from the last-fetched `categories` array on every mutation.
 */

let categories = [];

function getCategoryMessageEl() {
  return document.getElementById("category-form-error");
}

function showCategoryMessage(message) {
  const el = getCategoryMessageEl();
  el.textContent = message;
  el.hidden = false;
}

function clearCategoryMessage() {
  const el = getCategoryMessageEl();
  el.textContent = "";
  el.hidden = true;
}

function renderCategoryList() {
  const tbody = document.getElementById("category-list-body");
  tbody.innerHTML = "";

  for (const category of categories) {
    const row = document.createElement("tr");
    row.dataset.testid = "category-list-row";
    row.dataset.categoryId = String(category.id);

    const nameCell = document.createElement("td");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = category.name;
    nameInput.dataset.testid = "category-list-row-name-input";
    nameCell.appendChild(nameInput);
    row.appendChild(nameCell);

    const totalCell = document.createElement("td");
    totalCell.textContent = String(category.total_stock);
    row.appendChild(totalCell);

    const renameCell = document.createElement("td");
    const renameButton = document.createElement("button");
    renameButton.textContent = "Rename";
    renameButton.dataset.testid = "category-list-row-rename-button";
    renameButton.addEventListener("click", () => handleRenameCategory(category.id, nameInput.value));
    renameCell.appendChild(renameButton);
    row.appendChild(renameCell);

    const deleteCell = document.createElement("td");
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.dataset.testid = "category-list-row-delete-button";
    deleteButton.addEventListener("click", () => handleDeleteCategory(category.id, category.name));
    deleteCell.appendChild(deleteButton);
    row.appendChild(deleteCell);

    tbody.appendChild(row);
  }
}

async function refreshCategories() {
  categories = await listCategories();
  renderCategoryList();
  return categories;
}

async function handleCreateCategory(event) {
  event.preventDefault();
  clearCategoryMessage();
  const input = document.getElementById("category-create-name");
  const submitButton = document.getElementById("category-create-submit-button");

  submitButton.disabled = true;
  try {
    await createCategory(input.value);
    input.value = "";
    await refreshCategories();
  } catch (err) {
    showCategoryMessage(err.message);
  } finally {
    submitButton.disabled = false;
  }
}

async function handleRenameCategory(categoryId, newName) {
  clearCategoryMessage();
  try {
    await renameCategory(categoryId, newName);
    await refreshCategories();
  } catch (err) {
    showCategoryMessage(err.message);
  }
}

async function handleDeleteCategory(categoryId, categoryName) {
  const confirmed = window.confirm(
    `Delete category '${categoryName}'? This cannot be undone if it has no products.`
  );
  if (!confirmed) return;

  clearCategoryMessage();
  try {
    const result = await deleteCategory(categoryId);
    if (result.outcome === "hard_deleted") {
      showCategoryMessage("Category permanently deleted.");
    } else {
      showCategoryMessage(
        "Category archived — it still has products, so it was hidden rather than removed."
      );
    }
    await refreshCategories();
    // Also refresh the product form's category picker, since it depends on
    // the active-category list.
    if (typeof refreshCategoryPicker === "function") {
      await refreshCategoryPicker();
    }
  } catch (err) {
    showCategoryMessage(err.message);
    await refreshCategories(); // resync in case of a stale row (e.g. NOT_FOUND)
  }
}

function initCategoriesSection() {
  document
    .getElementById("category-create-form")
    .addEventListener("submit", handleCreateCategory);
  refreshCategories();
}

/**
 * Centralized fetch wrapper and error-message translation, per
 * Application Design's decision and Unit 2's Functional Design
 * (business-rules.md's Error-Message Mapping Rule).
 *
 * No component in this app calls `fetch` directly — everything goes
 * through `request()` below, so error-message translation lives in
 * exactly one place.
 */

const ERROR_MESSAGES = {
  CATEGORY_NOT_FOUND: "That category no longer exists.",
  PRODUCT_NOT_FOUND: "That product no longer exists.",
  CATEGORY_NAME_ALREADY_EXISTS: "A category with that name already exists.",
  PRODUCT_CODE_ALREADY_EXISTS: "A product with that code already exists.",
  CATEGORY_INACTIVE: "That category has been archived and can't be used.",
  PRODUCT_INACTIVE:
    "This product has been archived and can no longer receive stock changes.",
  INVALID_INITIAL_STOCK: "Initial stock cannot be negative.",
  INVALID_ADJUSTMENT_DELTA: "Enter a non-zero amount to adjust stock by.",
  STOCK_WOULD_GO_NEGATIVE: "Not enough stock — this would go below zero.",
};

class ApiError extends Error {
  constructor(errorCode, rawMessage) {
    // Fall back to the API's own message for any code not in the map,
    // per business-rules.md — never silently drop an error.
    super(ERROR_MESSAGES[errorCode] || rawMessage);
    this.errorCode = errorCode;
    this.rawMessage = rawMessage;
  }
}

const API_BASE = "";

async function request(method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204 || response.status === 205) {
    return null;
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    payload = JSON.parse(text);
  }

  if (!response.ok) {
    const errorCode = (payload && payload.error_code) || "UNKNOWN_ERROR";
    const message = (payload && payload.message) || "An unexpected error occurred.";
    throw new ApiError(errorCode, message);
  }

  return payload;
}

// --- Categories -----------------------------------------------------

function listCategories() {
  return request("GET", "/categories");
}

function createCategory(name) {
  return request("POST", "/categories", { name });
}

function renameCategory(categoryId, name) {
  return request("PATCH", `/categories/${categoryId}`, { name });
}

function deleteCategory(categoryId) {
  return request("DELETE", `/categories/${categoryId}`);
}

// --- Products ---------------------------------------------------------

function listProducts({ sortBy = "name", sortDir = "asc", categoryId = null } = {}) {
  const params = new URLSearchParams({ sort_by: sortBy, sort_dir: sortDir });
  if (categoryId !== null && categoryId !== undefined && categoryId !== "") {
    params.set("category_id", categoryId);
  }
  return request("GET", `/products?${params.toString()}`);
}

function getProduct(productId) {
  return request("GET", `/products/${productId}`);
}

function createProduct({ name, price, code, categoryId, initialStock }) {
  return request("POST", "/products", {
    name,
    price,
    code,
    category_id: Number(categoryId),
    initial_stock: Number(initialStock),
  });
}

function updateProduct(productId, fields) {
  const body = {};
  if (fields.name !== undefined) body.name = fields.name;
  if (fields.price !== undefined) body.price = fields.price;
  if (fields.code !== undefined) body.code = fields.code;
  if (fields.categoryId !== undefined) body.category_id = Number(fields.categoryId);
  return request("PATCH", `/products/${productId}`, body);
}

function deleteProduct(productId) {
  return request("DELETE", `/products/${productId}`);
}

// --- Stock adjustments / history ---------------------------------------

function adjustStock(productId, delta) {
  return request("POST", `/products/${productId}/stock-adjustments`, {
    delta: Number(delta),
  });
}

function getProductHistory(productId) {
  return request("GET", `/products/${productId}/stock-adjustments`);
}

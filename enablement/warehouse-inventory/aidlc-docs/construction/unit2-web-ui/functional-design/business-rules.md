# Business Rules — Unit 2: Web UI

**Note**: These are client-side-only UX rules, not data invariants — every rule that actually protects data integrity (non-negative stock, uniqueness, active-category checks, etc.) lives in Unit 1 and is re-enforced there regardless of what the UI does. The UI never trusts its own validation as authoritative.

## Confirmation Rule
Every delete action (category or product) requires a `window.confirm()` before the DELETE request is sent (Q2: A). No other action (create, update, stock adjustment) requires confirmation — those are reversible via a subsequent action (e.g. a bad update can be corrected with another update; a bad stock adjustment can be corrected with an offsetting adjustment, which itself still produces an honest history entry).

## In-Flight Request Rule
While a request triggered by a form submit is in flight, that form's submit button is disabled (to prevent duplicate submissions from a double-click) and re-enabled on response (success or error).

## Error-Message Mapping Rule (Q4: A)
`api-client.js` maintains a single `ERROR_MESSAGES` object keyed by `error_code`:
```js
const ERROR_MESSAGES = {
  CATEGORY_NOT_FOUND: "That category no longer exists.",
  PRODUCT_NOT_FOUND: "That product no longer exists.",
  CATEGORY_NAME_ALREADY_EXISTS: "A category with that name already exists.",
  PRODUCT_CODE_ALREADY_EXISTS: "A product with that code already exists.",
  CATEGORY_INACTIVE: "That category has been archived and can't be used.",
  PRODUCT_INACTIVE: "This product has been archived and can no longer receive stock changes.",
  INVALID_INITIAL_STOCK: "Initial stock cannot be negative.",
  INVALID_ADJUSTMENT_DELTA: "Enter a non-zero amount to adjust stock by.",
  STOCK_WOULD_GO_NEGATIVE: "Not enough stock — this would go below zero.",
};
```
For any `error_code` not in this map (including a future code Unit 1 adds that the UI hasn't been updated for yet, or the generic `INTERNAL_SERVER_ERROR`), the API's own `message` field is displayed as-is — the UI never swallows an error silently.

## Error Display Rule (Q3: A)
Each form/action has its own inline error element (e.g. `<div class="error-message" data-testid="product-form-error">`), populated on failure and cleared on the next successful submission or on navigating away from that section. Errors are never aggregated into a single global banner — a category-form error and a product-form error are shown independently, next to their respective triggers.

## Delete-Outcome Messaging Rule
Per the amended Unit 1 contract (`{"outcome": "hard_deleted" | "soft_deleted"}`), the UI always distinguishes the two cases in its confirmation-of-success message (see `business-logic-model.md`'s delete workflows) — it never shows a generic "Deleted" message that hides which branch occurred, since that distinction was this stage's entire reason for existing.

## Category-Picker Freshness Rule
The `<select>` used to choose a product's category (create/update forms) is populated from `GET /categories` each time the create/update form is opened — not cached indefinitely — to minimize (though not eliminate, since a race is always possible in a multi-tab scenario) the chance of offering a category that's since been soft-deleted. Unit 1's own `CATEGORY_INACTIVE`/`CATEGORY_NOT_FOUND` check is the actual enforcement point regardless.

## No Client-Side Sort/Filter Duplication
The UI never sorts or filters the product listing itself — every sort/filter change re-queries `GET /products` with the corresponding query parameters, so the displayed order/filter is always exactly what Unit 1 defines (avoids the two layers silently disagreeing).

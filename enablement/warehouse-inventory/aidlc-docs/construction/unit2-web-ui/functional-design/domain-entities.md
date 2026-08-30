# Domain Entities (View Models) — Unit 2: Web UI

Unit 2 has no database of its own — these are the JS object shapes the UI works with, matching Unit 1's JSON responses exactly (no client-side transformation of field names/types beyond what's needed for display).

## CategoryViewModel
```js
{ id: number, name: string }
```
Source: `GET /categories` items also include `total_stock: number` (only present in the listing response, not a standalone category fetch — Unit 1 has no single-category GET endpoint, which is fine since the UI only ever needs categories in listing/picker contexts).

## ProductViewModel
```js
{ id: number, name: string, price: string, code: string, category_id: number, quantity: number }
```
`price` arrives as a JSON string representing a decimal (e.g. `"9.99"`), per Unit 1's Pydantic `Decimal` serialization — the UI displays it directly with a `$` prefix, doing no numeric conversion itself (avoiding the exact float-currency pitfall Unit 1's `price_cents` design was meant to prevent — the UI never turns it back into a float either).

## StockAdjustmentViewModel
```js
{ id: number, product_id: number, delta: number, resulting_balance: number, created_at: string }
```
`created_at` is an ISO 8601 string, displayed via the browser's built-in `Date` parsing/formatting — no date library needed.

## DeleteOutcomeViewModel
```js
{ outcome: "hard_deleted" | "soft_deleted" }
```
Consumed only by the delete workflows to select which success message to show (see `business-rules.md`'s Delete-Outcome Messaging Rule).

## ErrorViewModel
```js
{ error_code: string, message: string }
```
Matches Unit 1's `ErrorResponse` schema exactly. `error_code` drives the `ERROR_MESSAGES` lookup; `message` is the fallback.

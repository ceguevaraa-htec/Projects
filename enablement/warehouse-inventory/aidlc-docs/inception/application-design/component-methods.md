# Component Methods — Warehouse Inventory System

**Note**: Signatures show intent, inputs, and outputs. Detailed business-rule logic (exact validation order, transaction boundaries) is defined in Functional Design (Construction phase, per-unit).

## CategoryComponent
| Method | Purpose | Input | Output |
|---|---|---|---|
| `create(name)` | Persist a new category | `name: str` | `Category` |
| `get_by_id(category_id)` | Fetch one category (active or soft-deleted) | `category_id: int` | `Category \| None` |
| `list_active()` | List categories excluding soft-deleted | — | `list[Category]` |
| `rename(category_id, new_name)` | Update a category's name | `category_id: int, new_name: str` | `Category` |
| `soft_delete(category_id)` | Mark a category deleted (`deleted_at` set) | `category_id: int` | `Category` |
| `hard_delete(category_id)` | Remove a category row permanently | `category_id: int` | `None` |
| `name_exists(name)` | Check name uniqueness across all rows | `name: str` | `bool` |
| `get_stock_totals()` | Sum of product stock per active category. **Explicit rule**: excludes soft-deleted categories AND excludes stock from soft-deleted products, even if their category is active. | — | `list[CategoryStockTotal]` |

## ProductComponent
| Method | Purpose | Input | Output |
|---|---|---|---|
| `create(name, price, code, category_id, initial_stock)` | Persist a new product. **Explicit rule**: `initial_stock` must be >= 0 (see ProductService.create_product validation). | fields | `Product` |
| `get_by_id(product_id)` | Fetch one product (active or soft-deleted) | `product_id: int` | `Product \| None` |
| `list(sort_by, sort_dir, category_id_filter)` | List active products, sortable/filterable | filter/sort params | `list[Product]` |
| `update(product_id, fields)` | Update name/price/code/category. **Explicit rule**: `fields` excludes `quantity`/stock — stock is never modified through this method; the only path to change stock is `StockAdjustmentService.adjust_stock()`. | `product_id: int, fields: {name?, price?, code?, category_id?}` | `Product` |
| `soft_delete(product_id)` | Mark a product deleted | `product_id: int` | `Product` |
| `hard_delete(product_id)` | Remove a product row permanently | `product_id: int` | `None` |
| `code_exists(code)` | Check product-code uniqueness across all rows | `code: str` | `bool` |
| `count_by_category(category_id)` | Count products referencing a category (active + soft-deleted) | `category_id: int` | `int` |
| `set_stock(product_id, new_quantity)` | Persist an updated stock quantity (called only by StockAdjustmentService within a transaction) | `product_id: int, new_quantity: int` | `Product` |

## StockAdjustmentComponent
| Method | Purpose | Input | Output |
|---|---|---|---|
| `record(product_id, delta, resulting_balance)` | Persist an immutable history entry | fields | `StockAdjustment` |
| `list_for_product(product_id)` | Chronological history for a product | `product_id: int` | `list[StockAdjustment]` |
| `count_for_product(product_id)` | Count of history entries (delete-eligibility check) | `product_id: int` | `int` |

## CategoryService (wraps CategoryComponent)
| Method | Purpose | Calls Into |
|---|---|---|
| `create_category(name)` | Validate uniqueness, create | `CategoryComponent` |
| `rename_category(category_id, new_name)` | Validate existence + uniqueness, rename | `CategoryComponent` |
| `delete_category(category_id)` | Decide hard vs. soft delete | `CategoryComponent`, `ProductComponent.count_by_category` |
| `list_categories_with_totals()` | Active categories + stock totals | `CategoryComponent` |

## ProductService (wraps ProductComponent)
| Method | Purpose | Calls Into |
|---|---|---|
| `create_product(name, price, code, category_id, initial_stock)` | Validate category is active + code uniqueness + `initial_stock >= 0`, create | `ProductComponent`, `CategoryComponent` |
| `update_product(product_id, fields)` | Validate category (if changed) is active + code uniqueness, update (stock not accepted here — see ProductComponent.update) | `ProductComponent`, `CategoryComponent` |
| `delete_product(product_id)` | Decide hard vs. soft delete | `ProductComponent`, `StockAdjustmentComponent.count_for_product` |
| `get_product(product_id)` | Fetch detail | `ProductComponent` |
| `list_products(sort_by, sort_dir, category_id_filter)` | Sortable/filterable listing | `ProductComponent` |

## StockAdjustmentService (wraps StockAdjustmentComponent)
| Method | Purpose | Calls Into |
|---|---|---|
| `adjust_stock(product_id, delta)` | Validate product is active + non-negative resulting balance, then atomically update stock and record history | `ProductComponent`, `StockAdjustmentComponent` |
| `get_history(product_id)` | Chronological history retrieval (works for soft-deleted products) | `StockAdjustmentComponent`, `ProductComponent.get_by_id` |

## API Layer (per-domain routers + global exception handler)
| Element | Purpose |
|---|---|
| `categories` router | Maps HTTP verbs/paths to `CategoryService` methods |
| `products` router | Maps HTTP verbs/paths to `ProductService` methods |
| `stock-adjustments` router | Maps HTTP verbs/paths to `StockAdjustmentService` methods |
| Global exception handler | Catches the domain-exception hierarchy (`NotFoundError`, `ValidationError`, `ConflictError`, `InvariantViolationError`) and any unhandled exception; maps to HTTP status + structured error body; logs with context |

## Web UI Component
| Module | Purpose |
|---|---|
| `api-client.js` | Centralized `fetch` wrapper; translates API error responses into user-facing messages; single place error-surfacing logic lives |
| `categories.js` | Category listing/create/rename/delete views and destructive-action confirmation |
| `products.js` | Product listing (sort/filter)/create/update/delete views and destructive-action confirmation |
| `stock.js` | Stock adjustment forms and adjustment-history view |

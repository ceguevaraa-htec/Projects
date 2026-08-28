# Component Dependencies — Warehouse Inventory System

## Dependency Matrix

| Component | Depends On | Reason |
|---|---|---|
| CategoryComponent | Database | Persistence access |
| ProductComponent | Database | Persistence access |
| StockAdjustmentComponent | Database | Persistence access |
| CategoryService | CategoryComponent, ProductComponent | Category CRUD + cross-domain delete-eligibility check |
| ProductService | ProductComponent, CategoryComponent, StockAdjustmentComponent | Product CRUD + category validation + cross-domain delete-eligibility check |
| StockAdjustmentService | StockAdjustmentComponent, ProductComponent | Adjustment recording + product-status/stock validation |
| API Layer (routers) | CategoryService, ProductService, StockAdjustmentService | Request handling delegates to exactly one service call |
| API Layer (global exception handler) | (cross-cutting) | Wraps all router calls; catches domain exceptions raised by any service |
| Web UI Component | API Layer (over HTTP, out-of-process) | All UI actions are REST calls; no in-process dependency on backend components |

## Communication Patterns
- **In-process (Unit 1 — Inventory API)**: Direct Python method calls — Service → Component, Service → other Component (read-only cross-domain checks), Router → Service.
- **Out-of-process (Unit 2 → Unit 1)**: HTTP/JSON over `fetch`, matching the REST API contract exposed by the API Layer.
- **No circular dependencies**: `CategoryComponent` and `ProductComponent` never call each other directly — only their respective Services reach across (Service → other domain's Component), and only for read-only eligibility checks (counts), never for writes.

## Data Flow: Illustrative Example (Delete a Category)
1. Web UI sends `DELETE /categories/{id}` after user confirms the destructive action.
2. `categories` router calls `CategoryService.delete_category(id)`.
3. `CategoryService` calls `ProductComponent.count_by_category(id)`.
4. If count is 0 → `CategoryComponent.hard_delete(id)`; else → `CategoryComponent.soft_delete(id)`.
5. Result returned up through the router; on success, Web UI refreshes the category listing. On a raised domain exception (e.g. category not found), the global exception handler formats the error response, which `api-client.js` translates into a user-facing message.

## Dependency Diagram

```mermaid
flowchart TD
    UI["Web UI Component<br/>(Unit 2)"]

    subgraph API["API Layer (Unit 1)"]
        RC["categories router"]
        RP["products router"]
        RS["stock-adjustments router"]
        EH["Global Exception Handler"]
    end

    subgraph SVC["Services"]
        CS["CategoryService"]
        PS["ProductService"]
        SS["StockAdjustmentService"]
    end

    subgraph COMP["Domain Components"]
        CC["CategoryComponent"]
        PC["ProductComponent"]
        SC["StockAdjustmentComponent"]
    end

    DB["Database Component"]

    UI -->|HTTP/JSON| RC
    UI -->|HTTP/JSON| RP
    UI -->|HTTP/JSON| RS

    RC --> CS
    RP --> PS
    RS --> SS

    CS --> CC
    CS --> PC
    PS --> PC
    PS --> CC
    PS --> SC
    SS --> SC
    SS --> PC

    CC --> DB
    PC --> DB
    SC --> DB

    EH -.->|wraps| RC
    EH -.->|wraps| RP
    EH -.->|wraps| RS

    style UI fill:#BBDEFB,stroke:#1565C0,stroke-width:2px,color:#000
    style API fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px,color:#000
    style SVC fill:#FFF59D,stroke:#F57F17,stroke-width:2px,color:#000
    style COMP fill:#FFE0B2,stroke:#E65100,stroke-width:2px,color:#000
    style DB fill:#E1BEE7,stroke:#6A1B9A,stroke-width:2px,color:#000
```

### Text Alternative
```
Web UI (Unit 2)
  -> HTTP/JSON -> categories router / products router / stock-adjustments router  (Unit 1, API Layer)
       [wrapped by Global Exception Handler]
       categories router    -> CategoryService
       products router      -> ProductService
       stock-adjustments router -> StockAdjustmentService

CategoryService        -> CategoryComponent, ProductComponent (read-only count)
ProductService          -> ProductComponent, CategoryComponent (read-only get), StockAdjustmentComponent (read-only count)
StockAdjustmentService  -> StockAdjustmentComponent, ProductComponent (read-only get + write set_stock)

CategoryComponent, ProductComponent, StockAdjustmentComponent -> Database Component
```

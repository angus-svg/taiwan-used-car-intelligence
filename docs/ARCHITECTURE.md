# Architecture V0.1

```text
User Entry
  ├─ Budget → Budget Frontier
  ├─ Model  → Year / Mileage / Residual
  └─ Listing → Price Position
          ↓
   Vehicle Normalization
          ↓
   Comparable Logic
          ↓
   Price Intelligence
          ↓
   Trade-off Explanation
          ↓
   Residual Value
```

## Why static first?

V0.1 needs no account, no private data, and no persistent user writes. A static app reduces cost and deployment risk while validating the decision UX.

## When to introduce backend?

Add a real backend/database when any of these become required:
- user accounts / saved cars
- price alerts
- user-submitted transaction results
- dealer feed ingestion
- scheduled market snapshots
- private data / VIN

## Upgrade path

Static JS → React/TypeScript + TanStack Table + Recharts → DuckDB-Wasm/Parquet for client analytics → PostgreSQL/API when persistence is required.

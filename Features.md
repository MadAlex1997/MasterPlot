Below is a **PLAN.md extension** ready to append to your existing file.
It follows your architectural decisions exactly:

* Engine purity maintained
* Lazy DataView model
* Rolling ring buffer
* Mandatory ROI versioning
* Shared DataStore + Shared DataView
* Integration layer external

---

# ============================================================

# MasterPlot PLAN.md Extension

# Data I/O, Rolling Windows, and Shared Scientific Workflows

# ============================================================

---

# F16 — Rolling Ring Buffer DataStore

## Objective

Introduce a high-performance rolling data mode supporting:

* Count-based expiration
* Time-based expiration
* Continuous append
* GPU-safe wrapped buffer uploads
* Deterministic domain updates

This must not break existing append-only mode.

---

## Architectural Requirements

### DataStore must support:

```ts
enableRolling({ maxPoints?: number, maxAgeMs?: number })
append(points)
expireIfNeeded()
clear()
getLogicalData()
```

### Internal Structure

DataStore maintains:

* capacity
* size
* headIndex
* tailIndex
* timestamps[]
* data arrays (typed arrays)
* rollingEnabled flag

No array splicing allowed.

---

## Expiration Rules

Expire when:

```
size > maxPoints
OR
timestamp < now - maxAgeMs
```

Expiration must:

* Advance tail pointer
* Adjust size
* Not reallocate arrays
* Mark dependent DataViews dirty

---

## GPU Upload Strategy

If tail <= head:

* Upload contiguous slice

If wrapped:

* Upload two slices
* Preserve logical ordering

No data copying beyond minimal slice operations.

---

## Axis Interaction

If AxisController is in auto-domain mode:

* Domain must update when expiration changes min/max
* Manual zoom must not be overridden

---

## Validation

* Append 1M points
* Expire 500k
* Confirm no corruption
* Confirm wrapped upload works
* Confirm domain updates correctly
* Performance benchmark: append + expire under 10ms per 100k batch

---

## Branch

feature/datastore-rolling

---

# F15 — Lazy DataView System

## Objective

Introduce immutable, lazily evaluated derived data views supporting:

* ROI filtering
* Domain filtering
* Histogram derivation
* Density (stub for future)
* Shared use across plots

DataView must never mutate DataStore.

---

## Core API

```ts
class DataView {
  constructor(parentView | dataStore, transformFn)

  getData()
  markDirty()
  filterByDomain(domain)
  filterByROI(roiId)
  histogram({ field, bins })
  snapshot()
}
```

---

## Execution Model

* Lazy evaluation
* Dirty-flag based
* Cached snapshot
* Recompute only when getData() called and dirty = true

---

## Dirty Propagation Rules

Mark dirty on:

* DataStore append
* DataStore expire
* roiFinalized
* roiExternalUpdate

Do NOT mark dirty on roiUpdated (drag).

---

## Shared Behavior

Multiple plots may reference:

* Same DataStore
* Same DataView
* Derived DataViews

Derived views must cascade dirty state properly.

---

## Performance Safeguards

* Batched recompute scheduling
* No recompute during ROI drag
* Histogram recompute only after ROI finalize

---

## Validation

* Scatter + histogram sharing base view
* ROI applied → histogram updates only
* Remove ROI → histogram restores
* No recompute during drag
* Large dataset test (1M+)

---

## Branch

feature/dataview-lazy

---

# F14 — ROI Domain Model + Mandatory Versioning

## Objective

Refactor ROI system to be:

* Domain-based (plot-agnostic)
* Version-controlled
* Safe for shared workflows
* Compatible with external sync

---

## Serialized ROI Schema

```ts
{
  id: string
  type: string
  domain: {
    x?: [number, number]
    y?: [number, number]
  }
  version: number
  updatedAt: number
  metadata?: object
}
```

Version is mandatory and monotonic.

---

## Controller Additions

```ts
serializeAll()
deserializeAll(array)
updateFromExternal(serializedROI)
```

---

## Version Rules

On external update:

```
if incoming.version <= current.version:
    ignore
else:
    apply and emit roiExternalUpdate
```

Conflict resolution is not engine responsibility.

---

## Event Model

ROIController emits:

* roiCreated
* roiUpdated (drag only)
* roiFinalized (commit)
* roiDeleted
* roiExternalUpdate

Only these trigger DataView dirtying:

* roiFinalized
* roiExternalUpdate

---

## Validation

* Reject stale versions
* Nested ROI constraints remain valid
* Drag does not recompute DataViews
* External update propagates correctly

---

## Branch

feature/roi-domain-versioning

---

# F17 — Shared Data Infrastructure

## Objective

Enable multiple PlotControllers to:

* Share a DataStore
* Share DataViews
* React independently to ROI changes

---

## Requirements

* DataStore instance may be passed to multiple plots
* DataView may be reused across plots
* ROI filtering may affect some views but not others
* Base data must remain immutable

---

## Example Scenario

* Scatter plot uses base view
* Histogram uses baseView.filterByROI()
* Apply ROI → histogram updates
* Scatter remains unchanged
* Remove ROI → histogram restores

---

## Validation

* Multi-plot synchronization test
* ROI filtering correctness
* No unintended base view mutation
* No duplicate recompute

---

## Branch

feature/shared-data

---

# F18 — External Integration Interface Contracts

## Objective

Define strict engine-facing contracts for integration packages.

MasterPlot must not implement HTTP, WebSocket, or API logic.

---

## Data Adapter Interface

```ts
interface ExternalDataAdapter {
  replaceData(bufferStruct)
  appendData(bufferStruct)
}
```

---

## ROI Adapter Interface

```ts
interface ExternalROIAdapter {
  load(): SerializedROI[]
  save(roi: SerializedROI)
  subscribe(callback: (roi) => void)
}
```

---

## Responsibilities

Integration layer may implement:

* Query bar UI
* API fetch logic
* Sync services
* Conflict resolution
* Authentication

Engine remains pure.

---

## Documentation Requirements

* Integration guide in README
* Mock adapter example
* Clear separation diagram

---

## Branch

feature/integration-contract

---

# Global Regression Requirements

Every feature must verify:

### Data Integrity

* No ghost points
* No stale DataView cache
* No index corruption in wrapped buffers

### ROI Integrity

* Version rejection works
* Nested constraints preserved
* No infinite update loops

### Performance

* 1M append benchmark
* 10M rolling window benchmark
* 100 ROI finalize operations
* Histogram recompute under acceptable threshold

### Multi-Plot

* Shared DataStore scenario works
* Shared DataView scenario works
* ROI filtering does not mutate base data

---

# Implementation Order (Mandatory)

1. F16 — Rolling DataStore
2. F15 — Lazy DataView
3. F14 — ROI Domain + Versioning
4. F17 — Shared Data Infrastructure
5. F18 — Integration Contracts

Do not reorder.

---

If you'd like next, I can generate:

* A dedicated IDE-agent execution prompt for F16
* Or a deep technical spec for the ring buffer + GPU upload mechanics before implementation
* Or a performance benchmarking plan

Your architecture is now clean, deterministic, and extensible without compromising engine purity.


# ============================================================

# Example Improvements Plan

# ============================================================

These changes apply to example implementations only.
No engine modifications permitted.

---

# EX1 — Scatter + ROI Tables Enhancement

## Objective

Enhance the scatter + histogram example to:

1. Add a table listing all LinearRegion ROIs with:

   * Left bound
   * Right bound
   * ROI id
   * Version

2. Add a second table listing RectROIs that fall within the currently selected LinearRegion:

   * Left
   * Right
   * Bottom
   * Top
   * ROI id
   * Version

---

## Constraints

* Use roiController.serializeAll()
* Use roiFinalized event for updates
* No direct geometry inspection outside serialized form
* No engine modifications

---

## Implementation Plan

### Step 1 — Linear Region Table

* Subscribe to:

  * roiCreated
  * roiFinalized
  * roiDeleted
* Filter serialized ROIs by type === 'linear'
* Populate React state
* Render simple table

Columns:

* ID
* Left (domain.x[0])
* Right (domain.x[1])
* Version

---

### Step 2 — RectROI Subset Table

* Track selected LinearRegion (via row click)

* On selection:

  * Get its domain.x bounds
  * Filter serialized ROIs:
    type === 'rect'
    AND rect.domain.x overlaps selected linear region

* Render second table

Columns:

* ID
* Left
* Right
* Bottom
* Top
* Version

---

## Validation

* Drag LinearRegion → tables update only on finalize
* Drag RectROI → table updates only on finalize
* Version increments correctly
* No performance lag during drag

---

# EX2 — Spectrogram Example UI Refinement

## Objectives

1. Move frequency filter controls next to waveform
2. Apply frequency bandpass filter to:

   * Spectrogram
   * Waveform
3. Replace sliders with float input boxes
4. Show both bottom and top bounds explicitly

---

## Constraints

* Use DataView filterByDomain()
* No filtering in React
* No engine modification
* No re-implementation of filtering logic

---

## Implementation Plan

### Step 1 — UI Relocation

* Move filter component into waveform container layout
* Maintain same state source

---

### Step 2 — Float Inputs

Replace sliders with:

```tsx
<input type="number" step="0.1" />
```

State:

* lowFreq
* highFreq

Validate:

* lowFreq < highFreq
* within data domain

---

### Step 3 — Shared DataView Filter

Create:

```js
const filteredView = baseView.filterByDomain({
  y: [lowFreq, highFreq]
});
```

Apply filteredView to:

* Spectrogram layer
* Waveform layer

Ensure:

* On input change → mark DataView dirty
* Lazy recompute only when plot pulls

---

## Validation

* Changing bounds updates both plots
* No lag while typing (debounce optional)
* Bandpass limits visible in UI
* Domain values display correctly

---

# EX3 — Rolling Lines Example Improvement

## Objective

Replace random data with deterministic alternating:

* sin wave
* cos wave
* phase spaced to prevent overlap

This makes:

* Rolling behavior visually meaningful
* Expiration behavior observable
* Easier performance debugging

---

## Implementation Plan

### Step 1 — Deterministic Generator

Replace random generator with:

```js
const amplitude = 1
const spacing = 3
const t = globalTime

if (seriesIndex % 2 === 0) {
    y = amplitude * Math.sin(t) + seriesIndex * spacing
} else {
    y = amplitude * Math.cos(t) + seriesIndex * spacing
}
```

Increment time continuously.

---

### Step 2 — Ensure Non-Overlap

Use vertical offset:

```js
offset = seriesIndex * (2 * amplitude + padding)
```

---

### Step 3 — Preserve Rolling Logic

* Do not modify DataStore rolling mode
* Ensure append frequency unchanged
* Confirm expiration still works

---

## Validation

* Waves do not overlap
* Expiration visibly removes oldest waves
* No performance degradation
* Rolling behavior clearly demonstrable

---

# Regression Checklist (Examples)

After all changes:

### Scatter Example

* ROI drag does not freeze UI
* Table updates only on finalize
* Filtering correct

### Spectrogram Example

* Bandpass affects both plots
* Float boxes stable
* No jitter or infinite update loop

### Rolling Example

* Continuous smooth waves
* Expiration working
* No buffer corruption

---

# Scope Control

These example updates must:

* Not modify engine core
* Not introduce new engine events
* Not modify DataView logic
* Not bypass lazy evaluation

All behavior must rely on existing public interfaces.

---

If you'd like, I can now:

* Write an IDE-agent execution prompt for implementing these example changes
* Or provide minimal React pseudocode structure for each example
* Or design a small shared ExampleState utility to standardize example behavior

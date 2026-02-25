# Features.md

Phase 3 specs (F19, F20, F21, EX4, EX5) have been incorporated into [PLAN.md](PLAN.md).

This file holds specs for future features not yet scheduled into PLAN.md.

---

# EX6 [PENDING] — ROI Table Double-Click Selection

**Type:** Example Only (ExampleApp.jsx)
**File:** `examples/ExampleApp.jsx`

---

## Problem

The LinearRegion table requires a single-click to filter the RectROI table. This is non-obvious to first-time users — the affordance is invisible unless you already know to click.

---

## Behavior

### LinearRegion Table Row — Double-Click

* Selects the LinearRegion as the active table filter (same effect as current single-click)
* Additionally calls `roiController` to programmatically set the ROI as selected (visual highlight on plot)
* Single-click continues to work as before (filter only, no plot highlight)

### RectROI Table Row — Double-Click

* Selects the RectROI as the active selection
* Also selects its parent LinearRegion:
  * Sets `selectedLinearId` / `selectedLinearIdRef` to the parent's id
  * Highlights the parent row in the LinearRegion table
* Calls `roiController` to programmatically set both ROIs as selected on plot

---

## Implementation Notes

* No engine changes. ExampleApp.jsx only.
* Use `onDoubleClick` handlers on `<tr>` elements (in addition to existing `onClick`).
* To programmatically select an ROI, call `roiController._selectOnly(roi)` where `roi = roiController.getROI(id)`. This sets `roi.selected = true` on the target and clears all others. Follow with `roiController.emit('roisChanged', { rois: roiController.getAllROIs() })` to trigger a redraw.
* The RectROI table row needs access to its parent LinearRegion id. Currently `childRects` entries come from `serializeAll()` which does not include `parentId`. Either:
  * Add `parentId: roi.parent?.id` to the `serializeAll()` output, OR
  * Look up the parent by scanning `roiController.getAllROIs()` for rects that share the same parent
  * Prefer option 1 (add `parentId` to `serializeAll`) — clean and O(1).
* Visual indicator: add a distinct double-click highlight style (e.g. brighter border or `outline`) on selected rows to distinguish from single-click filter state.

---

## Acceptance Criteria

* Double-clicking a LinearRegion row selects it as table filter AND highlights it on the plot
* Double-clicking a RectROI row selects the rect AND auto-selects its parent linear (both table rows highlighted)
* Single-click on LinearRegion rows continues to filter rect table (unchanged)
* No engine modifications
* No memory leaks or stale-closure issues

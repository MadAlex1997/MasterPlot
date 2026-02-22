Here is a **clear implementation-oriented specification** you can give directly to your AI agent.

---

# HistogramLUTItem — Spectrogram Context Specification

## Concept

In a spectrogram viewer, `HistogramLUTItem` is a **dynamic amplitude remapping controller**.

It does **not modify the spectrogram data**.
It modifies how amplitude values are **mapped to colors** before rendering.

It consists of:

1. Histogram of spectrogram amplitude values
2. Interactive min/max level controls
3. Colormap (LUT) editor
4. Real-time shader remapping

---

# 1️⃣ Spectrogram Data Model

Assume spectrogram:

```
S ∈ R^(freq_bins × time_frames)
```

Values may be:

* Linear power
* Log power (dB)
* Magnitude

The display pipeline:

```
raw amplitude → normalization → LUT lookup → RGB → screen
```

HistogramLUTItem controls:

```
normalization parameters (min, max)
LUT texture
```

---

# 2️⃣ Functional Responsibilities

## A. Histogram Computation

Compute histogram over all visible amplitude values:

```
histogram = histogram(S.flatten(), bins=N)
```

Implementation requirements:

* Configurable bin count (e.g. 256–1024)
* Must support:

  * Linear amplitude
  * Log-scaled (dB) amplitude
* Recompute only when:

  * New spectrogram loaded
  * User toggles log/linear domain
  * ROI-limited histogram enabled

Optional advanced:

* Histogram only from currently visible time range
* Histogram only from ROI-selected region

---

## B. Level Control (Core Feature)

Two interactive values:

```
level_min
level_max
```

These define the visible amplitude window.

### Mapping Formula

For each pixel:

```
normalized = clamp((value - level_min) / (level_max - level_min), 0, 1)
```

This MUST be done in shader for performance.

### Interaction Requirements

* Two draggable vertical handles
* Drag region between handles
* Numeric entry allowed
* Auto-level button:

  * Use percentiles (e.g. 1%–99%)
  * Or mean ± k·std

---

## C. LUT (Color Map) System

A LUT is a 1D texture:

```
LUT: [0,1] → RGB
```

Implementation:

* 256 or 1024 resolution texture
* Interpolated sampling
* Swappable presets:

  * grayscale
  * viridis
  * plasma
  * inferno
  * magma

Optional:

* Editable gradient stops
* Save/load custom LUT

---

# 3️⃣ Rendering Architecture (WebGL / GPU)

### Required Shader Uniforms

```
uniform float level_min;
uniform float level_max;
uniform sampler2D spectrogramTexture;
uniform sampler1D lutTexture;
```

### Fragment Shader Logic

```
float raw = texture(spectrogramTexture, uv).r;

float normalized = clamp(
    (raw - level_min) / (level_max - level_min),
    0.0,
    1.0
);

vec3 color = texture(lutTexture, normalized).rgb;
```

Must update interactively without re-uploading spectrogram texture.

---

# 4️⃣ UI Layout (Spectrogram Viewer)

Typical layout:

```
+----------------------+-----------+
|                      | Histogram |
|     Spectrogram      | + LUT     |
|                      |           |
+----------------------+-----------+
```

Right panel contains:

* Histogram plot (vertical orientation preferred)
* Draggable region overlay
* Gradient preview bar
* Preset dropdown
* Auto-level button

---

# 5️⃣ Spectrogram-Specific Considerations

Spectrograms differ from images in key ways:

### A. Log Scaling Is Common

Often:

```
S_dB = 20 * log10(|STFT|)
```

Histogram must reflect displayed domain.

### B. Wide Dynamic Range

Audio spectrograms often span:

```
-120 dB → 0 dB
```

Default auto-level recommendation:

```
lower = percentile(S, 5%)
upper = percentile(S, 99.5%)
```

Avoid using absolute min/max.

### C. Performance Constraints

For large spectrograms (e.g. 2048 × 100k):

* Histogram must use:

  * Downsampled data OR
  * GPU histogram OR
  * Cached histogram from preprocessing

Never recompute histogram on every frame.

---

# 6️⃣ State Model for Agent

Agent should implement state container:

```
state = {
    level_min: float,
    level_max: float,
    lut: Float32Array,
    histogram_bins: Array,
    auto_level_mode: 'percentile' | 'stddev',
    histogram_source: 'full' | 'visible' | 'roi'
}
```

---

# 7️⃣ Event System

Must emit:

```
onLevelsChanged(min, max)
onLUTChanged(lut)
onAutoLevel()
```

Spectrogram re-renders on:

* Levels change
* LUT change

NOT on histogram drag (until release optional optimization).

---

# 8️⃣ Advanced Optional Features

### ROI Histogram Mode

Compute histogram only for:

* Selected frequency band
* Selected time window
* Rectangular ROI

### Linked Views

If multiple spectrogram panels exist:

* Shared LUT
* Independent levels
* Or fully shared scaling

### Log-Histogram Mode

Display histogram y-axis in log count scale.

---

# 9️⃣ Behavioral Summary (For Agent)

The HistogramLUTItem for a spectrogram:

* Visualizes amplitude distribution
* Allows interactive contrast windowing
* Controls dynamic range mapping
* Controls color mapping
* Performs normalization in shader
* Must be decoupled from raw data
* Must not modify spectrogram tensor

It is a **view-layer amplitude remapping controller**, not a data processor.

---

If you'd like, I can now:

* Convert this into a structured JSON spec for your IDE agent
* Convert into a React + WebGL implementation plan
* Convert into a deck.gl layer design
* Or write it as a formal engineering requirements document

Just tell me which format your agent expects.

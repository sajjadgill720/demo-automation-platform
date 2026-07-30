# UI/UX Fixes and Styling Enhancements Reference

This file documents the styling bugs encountered, design system fixes, button interactions, and container layouts implemented in the **DataQuartz Convoa** frontend application.

---

## 1. The Tailwind Square Radius Issue
### The Bug
All buttons and styled card elements throughout the landing page and portal rendered as perfectly square, sharp rectangles. Applying utility classes like `rounded-lg`, `rounded-md`, or `rounded-xl` had no effect on the borders.

### The Root Cause
Tailwind CSS border-radius utilities dynamically compute standard pixel values relative to the `--radius` CSS custom property (e.g., `rounded-lg` corresponds to `calc(var(--radius) + 8px)` or mapping to `var(--radius-lg)` depending on setup). The global stylesheet `styles.css` had explicitly defined:
```css
:root {
  --radius: 0px;
}
```
This reset the computed value of all Tailwind border radius classes to `0px`, causing all components across the app to lose their rounded borders.

### The Solution
We updated the variable value in `:root` to a standard modern size and added page-specific overrides for custom aesthetics:
1. **Global CSS (`styles.css`):**
   ```css
   :root {
     --radius: 0.5rem; /* Replaced 0px */
   }
   
   /* Adjusted theme radius override for Convoa Landing Page */
   .skydda-sentinel-theme {
     --radius: 0.75rem; 
   }
   ```
2. **Component Upgrades:**
   * Explicitly set `rounded-2xl` on large CTAs like "Build My Demo" and "Watch Demo" to create a premium tech appearance.

---

## 2. Document Ingestion Center Overlay Bug
### The Bug
During document upload, when a user clicked the CTA to proceed or skip, a loading screen displaying the ingestion progress state popped up. However, the overlay container was pinned relative to the card dimensions (`absolute inset-0`). Because the onboarding form card has variable heights depending on file list length and error states, the loading window frequently aligned at the bottom of the section, clipping off-screen or forcing users to scroll down to view progress.

### The Solution (In-Place Interactive Swap)
Rather than applying viewport-fixed overlays which take context away from the page, we refactored the UI hierarchy in `_wizard.upload.tsx` to handle the transition as an **in-place DOM swap**:
* When `isIngesting` is `true`, the drag-and-drop container, uploaded files list, and the consent checkbox are conditionally unmounted.
* The processing steps checklist mounts into the exact same parent container, matching the dimensions and maintaining background context.
* The header text ("Make it sound like your team") and footer buttons remain active, keeping the onboarding workflow unified.

---

## 3. "Skip for now" Styling and Button Contrast
### The Bug
The "Skip for now" fallback button was built as a bare text anchor with simple underlining. It lacked visual weight, did not support keyboard navigation states properly, and competed with the main call-to-action because it had no clear button bounding box.

### The Solution
We converted it from a bare link into a secondary outlined button block, matching the primary "Build My Agent" button's border radius (`rounded-xl` / `0.75rem`) but using secondary coloring:
```tsx
<button
  type="button"
  onClick={handleSkipUploadStep}
  disabled={isIngesting}
  className="inline-flex items-center gap-2 border border-border/60 bg-secondary/40 text-foreground/70 hover:text-foreground hover:bg-secondary hover:border-border font-sans text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed btn-themed-shadow hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.97]"
>
  Skip for now
</button>
```

---

## 4. Theme-Aware Button Hover Shadows
### The Design Requirement
Buttons required high-fidelity hover shadows tailored to the active color theme: a warm yellow glow in the white theme and a cool sky-blue glow in the dark theme.

### Implementation
We created `.btn-themed-shadow` in `styles.css` with a multi-layered shadow stack to generate dense, soft atmospheric lighting without looking pixelated:
```css
/* Light/White Theme: Dense Amber-Yellow Glow */
.btn-themed-shadow {
  box-shadow:
    0 2px 6px oklch(0 0 0 / 0.10),
    0 1px 3px oklch(0 0 0 / 0.08);
  transition:
    box-shadow 0.22s ease-out,
    transform 0.18s ease-out,
    background-color 0.15s ease-out;
}

.btn-themed-shadow:hover:not(:disabled) {
  box-shadow:
    0 0 0 3px oklch(0.92 0.21 82 / 0.30),
    0 0 18px 2px oklch(0.88 0.20 78 / 0.45),
    0 6px 28px -2px oklch(0.82 0.19 74 / 0.60),
    0 12px 48px -6px oklch(0.80 0.18 70 / 0.35),
    0 2px 8px oklch(0 0 0 / 0.10);
  transform: translateY(-2px);
}

/* Dark Theme: Dense Sky-Blue Glow */
.dark .btn-themed-shadow:hover:not(:disabled) {
  box-shadow:
    0 0 0 3px oklch(0.72 0.19 208 / 0.35),
    0 0 20px 3px oklch(0.68 0.20 212 / 0.50),
    0 6px 30px -2px oklch(0.62 0.21 216 / 0.65),
    0 14px 54px -6px oklch(0.60 0.20 215 / 0.40),
    0 2px 8px oklch(0 0 0 / 0.25);
}
```
* **Lift Interaction:** Added `-translate-y-[2px]` (or `[3px]` on larger buttons) on hover for depth, and `scale-[0.97]` on click active state to offer tactile input response.

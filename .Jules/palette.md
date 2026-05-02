## 2024-05-14 - Accessible Dynamic Wizard Errors
**Learning:** When adding dynamic error messages inside multi-step wizards or modals (like the add-domain wizard), adding `aria-describedby` on the input linking to an error container with `role="alert"` and `aria-live="polite"` ensures screen readers immediately announce validation errors without losing focus context.
**Action:** Always pair inputs with dynamic validation to an associated error container using `aria-describedby` and `role="alert"` to guarantee robust accessibility feedback for complex flows.

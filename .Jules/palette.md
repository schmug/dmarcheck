## 2026-04-30 - Destructive Action Styling
**Learning:** The application's CSS includes predefined utility classes for critical UI states, specifically `.btn-danger` which utilizes the `var(--clr-fail)` token. Using this semantic class ensures destructive actions (like "Delete") visually stand out and align with the rest of the application's feedback system.
**Action:** When adding or updating buttons for destructive actions, always check for and apply `.btn-danger` rather than falling back to standard or secondary button styles, ensuring consistent and clear UX signaling.

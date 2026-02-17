# Code Style

## General Code Conventions

- Indent with tabs (`\t`), not spaces.

## HTML/CSS

- For parent DOM elements, ALWAYS use `grid` or `flex` with `gap` for consistent spacing of child elements, instead of setting margin on every child element. Top-level elements inside a component should never have a margin set.
- All colors MUST use CSS variables defined in `src/app.css` - no hard-coded color values in components
- Light/dark mode theming via CSS variables
- Create and refer to `src/app.css` for CSS variable naming conventions.
- Use pixels (`px`) for all measurements - no `rem`, `em`, or other units
- Common spacing variables available: `--spacing-{size}` where `{size}` is xs, sm, md, lg, xl, 2xl, 3xl
- Hard-coded pixel values are allowed in exceptional cases (e.g. `width: 200px` is fine)

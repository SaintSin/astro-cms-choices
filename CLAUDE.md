# Claude Code Instructions for AstroInitial

## CSS & Styling

- Use modern CSS with `@layers` for organization and cascade management
- **Never use `!important`** — solve specificity issues through proper layer organization
- Follow CUBE CSS methodology where applicable
- Organize styles using logical layers (e.g., reset, tokens, components, utilities)

## Project Structure

- Components are organized by semantic categories:
  - `@components/global/` - Layout components (Header, Footer, Basehead, etc.)
  - `@components/schema/` - JSON-LD schema components
  - Other component subdirectories for feature-specific components
- Use `@config/` for configuration files
- Use path aliases consistently (defined in tsconfig.json)

## Code Quality

- Component imports and variables should be used; remove unused code
- Run `pnpm biome check` to catch linting issues before committing
- Biome may flag legitimate unused imports during development — fix them when implementing the component

## Development Workflow

- Use `pnpm dev` to run the development server
- Use path aliases for all imports (e.g., `@components/`, `@layouts/`, `@types`)

## Git & GitHub

- **Never commit unless explicitly instructed** — always ask before creating commits
- **Never use Claude as a contributor** — all commits should be authored by the project owner only
- Only create commits when the user explicitly requests it

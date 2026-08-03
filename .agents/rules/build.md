# Command Execution & Build Rules

- **NEVER** run `npx tsc --noEmit` or any TypeScript type-check background tasks.
- **NEVER** run `npm run build` or full production build commands.
- Simply edit files directly as instructed without triggering background build or tsc commands.

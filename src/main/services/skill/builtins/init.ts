import type { Skill } from '../../../../shared/types';

export const initSkill: Skill = {
  name: 'init',
  description: 'Initialize project context, analyze codebase and generate AGENTS.md',
  template: `Please analyze this codebase and create an AGENTS.md file that will help AI assistants understand and work with this project effectively.

The AGENTS.md file should include:

## Project Overview
- A brief description of what the project does
- The main technologies and frameworks used

## Commands
- Build commands (e.g., npm run build, pnpm build)
- Development server commands
- Test commands
- Linting/formatting commands

## Code Style & Conventions
- Language preferences (TypeScript/JavaScript)
- Naming conventions
- Import patterns
- Any special coding guidelines

## Project Structure
- Key directories and their purposes
- Important files to be aware of

## Architecture Patterns
- State management approach
- Component patterns
- API/data fetching patterns

## Important Notes
- Any configuration requirements
- Environment variables needed
- Known issues or limitations

Please explore the codebase thoroughly to understand:
1. Package.json for commands and dependencies
2. Config files (tsconfig, vite, webpack, etc.)
3. Source code structure
4. Existing documentation

After analysis, create the AGENTS.md file in the project root.

$ARGUMENTS`,
  source: 'builtin',
  hints: ['$ARGUMENTS'],
}

# Contributing to Workstream

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. Fork and clone the repo
2. Run `npm install`
3. Copy `.env.example` to `.env` and fill in your Firebase config
4. Run `npm run dev` to start the development server

## Making Changes

1. Create a new branch from `main`
2. Make your changes
3. Run `npm run lint` to check for lint errors
4. Run `npm run build` to verify the build passes
5. Commit your changes with a clear, descriptive message

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Update the README if your change affects the public API or setup
- Make sure the build passes before requesting review

## Code Style

- TypeScript strict mode
- Functional React components with hooks
- TailwindCSS for styling (no inline styles or CSS modules)
- Use the existing UI components in `src/components/ui/` where possible

## Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS info

## Feature Requests

Open an issue describing the feature and why it would be useful. Discussion before implementation is encouraged for larger changes.

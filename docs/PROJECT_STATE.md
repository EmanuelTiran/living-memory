# Project State

**Last updated:** 2026-07-26
**Current phase:** Phase 1 - Foundations
**Current branch:** `agent/complete-phase-1-foundations`
**Status:** Foundation implementation and runtime verification completed.

## Product

Living Memory is a Hebrew RTL application for creating private, source-grounded digital memories and interactive family legacies.

## Completed Work

- npm monorepo with `client`, `server`, and `shared` workspaces.
- React and Vite client.
- Hebrew RTL and responsive initial screen.
- Express API with centralized environment configuration.
- `GET /api/health` endpoint.
- Express signature disabled.
- Vitest and Supertest API integration tests.
- Root ESLint Flat Config.
- Root development, lint, test, build, and check scripts.
- Concurrent client and server development command.
- Vite development proxy for relative `/api` requests.
- Local environment file excluded from Git.
- Safe client environment example included in Git.
- Public GitHub repository and feature-branch workflow.

## Architecture Decisions

- JavaScript only.
- ES Modules throughout the project.
- Modular monolith architecture.
- Feature modules will be added only when needed.
- The client will use relative `/api` requests.
- Vite and Express run separately during development.
- Express will provide a single origin in production.
- Environment-specific addresses will not be stored in React components.

## Verification Results

- ESLint passed.
- Server tests passed: 2/2.
- Client production build passed.
- Client started on port 5173.
- Server started on port 5000.
- `/api/health` passed successfully through the Vite proxy.

## Verification Commands

- `node --check .\client\vite.config.js`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run check`
- `npm run dev`
- `Invoke-RestMethod http://localhost:5173/api/health`

## Known Limitations

- MongoDB is not connected yet.
- Central error handling and request IDs are not implemented yet.
- Authentication is not implemented yet.
- Production deployment is not configured yet.
- GitHub Actions are not configured yet.

These items are intentionally deferred to later phases.

## Exact Next Step

Complete the Phase 1 documentation and review the pending Git diff before requesting approval to commit and push the branch.

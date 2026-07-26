# Architecture

## Style

Living Memory is built as a modular monolith inside an npm monorepo.

The application uses JavaScript and ES Modules throughout the codebase.

## Workspaces

- `client` — React and Vite user interface.
- `server` — Express REST API.
- `shared` — safe constants and contracts shared between workspaces.

## Development Request Flow

1. The browser sends a relative request to `/api`.
2. Vite receives the request.
3. Vite proxies it to the local Express server.
4. Express returns the standard API response.

React components must not contain localhost or production API addresses.

## Production Direction

Express will serve the React production build so the client and API use one origin.

External addresses and secrets will come from validated environment variables.

## Server Structure

Business capabilities will be organized under `server/src/modules`.

Each module may contain validation, repository, service, controller, routes, permissions, and tests when required.

Cross-cutting infrastructure will live under:

- `server/src/config`
- `server/src/middleware`
- `server/src/platform`
- `server/src/workers`

## Security Boundary

A memory profile will become a central authorization boundary.

Database operations for memory-owned resources must verify both the resource identifier and the authorized `memoryId`.

System roles and memory roles will remain separate.

## Current Scope

Phase 1 contains the development foundation, health endpoint, linting, root scripts, configuration, development proxy, and basic API tests.

MongoDB, authentication, authorization, AI, uploads, and production deployment are intentionally deferred.
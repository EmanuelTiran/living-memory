# Roadmap

## Phase 1 — Foundations

- npm monorepo.
- React and Vite.
- Express.
- ESLint.
- Environment examples.
- Health endpoint.
- Root scripts.
- Basic API tests.
- Vite `/api` development proxy.

Status: completed and awaiting final Git review.

## Phase 2 — MongoDB and Server Infrastructure

- MongoDB and Mongoose connection.
- Expanded environment validation.
- Central error handling.
- Request IDs.
- Safe logging.
- Initial feature-module structure.

## Phase 3 — Authentication

- User model.
- Registration and login.
- Password hashing.
- Short-lived access token.
- Refresh-token rotation.
- Logout and session revocation.
- Authentication tests.

## Phase 4 — Memory Profiles

- Create multiple memory profiles.
- List owned and shared memories.
- View and update a memory.
- Private visibility by default.
- Authorization boundary tests.

## Phase 5 — Memberships and Permissions

- Owner, editor, contributor, and viewer roles.
- Central permission service.
- Role-matrix tests.

## Phase 6 — Invitations

- Secure invitation tokens.
- Acceptance, expiration, cancellation, and resend.
- Membership creation after acceptance.
- Audit records.

## Phase 7 — Written Content and Contributions

- Written memory items.
- Contribution review.
- Approval and rejection.
- Basic version history.
- Approved-content boundary.

## Phase 8 — Knowledge and RAG

- Knowledge chunks.
- Embeddings and vector-search adapters.
- Isolation by `memoryId`.
- Indexing of approved content only.

## Phase 9 — Grounded Chat

- Conversations and messages.
- Structured AI responses.
- VERIFIED, INFERRED, and UNKNOWN levels.
- Source validation and usage limits.

## Later Phases

- Private media storage.
- Processing jobs and workers.
- Audio transcription.
- Administration.
- Advanced privacy and security.
- Accessibility and performance.
- Production deployment and monitoring.

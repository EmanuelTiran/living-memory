
### `docs/ROADMAP.md`

```md
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
- Public GitHub repository.
- Feature-branch and pull-request workflow.

Status: completed and merged.

## Phase 2 — MongoDB and Server Infrastructure

- MongoDB Atlas and Mongoose connection.
- Dedicated application database.
- Expanded environment validation.
- Database connection before HTTP startup.
- Graceful HTTP and database shutdown.
- Startup failure handling.
- Central error handling.
- Consistent API error responses.
- Safe malformed-JSON handling.
- Request IDs.
- Safe structured logging.
- Request duration logging.
- Cross-cutting server infrastructure structure.
- Feature-module conventions without premature empty modules.
- Server infrastructure integration tests.

Status: implementation and runtime verification completed. Final Git review is pending.

## Phase 3 — Authentication

- First business feature module.
- User model.
- Registration and login.
- Password hashing.
- Short-lived access token.
- Refresh-token rotation.
- Secure logout and session revocation.
- Authentication validation.
- Authentication integration tests.
- Security headers and authentication-specific rate limiting.

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
- Optional voice interaction.
- Optional avatar and video experiences.
- Administration.
- Advanced privacy and security.
- Accessibility and performance.
- Production deployment and monitoring.
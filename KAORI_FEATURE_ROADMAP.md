# Kaori AI - Implementation Plan

## Goal

Turn Kaori into a reliable, model-independent AI workspace with the strongest useful ideas from ChatGPT, Claude, Gemini, Grok, and Kimi while preserving Kaori's identity, current UI, expressive avatar personality, and existing animations.

This plan is intentionally incremental. A phase is complete only when its tests and acceptance checks pass. New features must be additive and remain disabled behind feature flags until they are production-ready.

## Non-Negotiable Rules

1. Preserve the current visual language, layout, responsive behavior, bounce effects, and animation timing unless a specific design change is approved.
2. Do not rewrite stable chat behavior to add a feature. Extend existing contracts or add versioned contracts.
3. Use additive database migrations. Never delete or rename user data in place without a tested migration and rollback path.
4. Put unfinished features behind server-enforced feature flags.
5. Every external action must pass authentication, ownership, rate-limit, permission, and Quartzwall checks.
6. External content is untrusted data, never instructions.
7. Every long-running operation must support progress, cancellation, retry, and recovery after refresh.
8. Every phase must pass lint, type checking, unit tests, production build, desktop checks, and mobile checks.
9. Do not expose provider keys, internal errors, private prompts, or sensitive memory to the browser.
10. Keep model providers interchangeable. Projects, memory, tools, research, and artifacts belong to Kaori, not to one model.

## Current Baseline

### Already present

- Multi-provider chat and streaming
- Chat persistence, titles, starring, and history
- File and PDF input
- Web fetch tool
- Web search tool, currently requiring repair
- Tool result cards and action passport UI
- Quartzwall policy and event logging
- Authentication, refresh sessions, rate limits, and spend controls
- Live2D avatar and the established Kaori interface, providing a safe fallback while a web-rendered 3D avatar is evaluated
- Document download support
- Early projects and editable memory implementation in the current working tree
- Database foundations for tasks, schedules, monitors, snippets, and generated documents

### Partially implemented or unverified

- Project CRUD, project-scoped chats, and project instructions
- User-managed memory APIs and settings UI
- Search reliability and provider fallback
- Mobile behavior for the new project and memory surfaces
- Automated coverage for newly added workspace APIs

### Not yet implemented as complete product features

- Deep Research
- Canvas and interactive Artifacts
- Sandboxed code execution and data analysis
- Custom Kaoris and reusable skills
- Connected apps
- Real-time voice, camera, and screen interaction
- Durable background agents and automation workers
- Conversation branching, sharing, global search, and temporary chats
- Council or multi-model comparison mode

## Delivery Strategy

Each phase follows the same release path:

1. Define or freeze the API contract.
2. Add additive schema changes and migrations.
3. Implement the server capability with authorization and policy checks.
4. Add the UI using existing Kaori design tokens and motion patterns.
5. Add unit, integration, and failure-path tests.
6. Verify desktop and mobile behavior.
7. Enable for development, then opt-in beta, then default-on.

### Required release gates

- No regression in ordinary chat, streaming, stop-generation, retries, uploads, or history.
- No changes to existing animations unless the feature directly needs a new motion state.
- No horizontal overflow or layout jump at 320 px, 375 px, 768 px, and desktop widths.
- Keyboard navigation, focus visibility, reduced-motion support, and screen-reader labels work.
- Loading, empty, offline, timeout, unauthorized, rate-limit, and server-error states are designed.
- Database changes are restart-safe and idempotent.
- Feature can be disabled without corrupting existing conversations or data.

## Phase 0 - Stabilize the Existing Product

This phase comes first because every advanced feature depends on reliable tools and stable chat behavior.

### Work

- [ ] Freeze the existing animation and responsive behavior as a visual baseline.
- [ ] Repair web search using the configured Brave Search API as the primary provider.
- [ ] Keep a normalized fallback provider so one upstream outage does not break search.
- [ ] Normalize, deduplicate, sanitize, and validate all search results.
- [ ] Return provider-safe errors with correct HTTP status codes.
- [ ] Add search parser, timeout, empty-result, upstream-error, and fallback tests.
- [ ] Verify web fetch protections, redirects, response limits, and DNS rebinding defenses.
- [ ] Audit streaming cleanup, abort behavior, duplicate messages, and tool-loop limits.
- [ ] Resolve current TypeScript, lint, test, and production-build failures.
- [ ] Add a small smoke suite for login, new chat, send, stop, reload, search, fetch, upload, and delete.
- [ ] Test the current UI on mobile without replacing or simplifying its animations.

### Acceptance criteria

- A current-information prompt produces non-empty, clickable, source-attributed results when a provider is available.
- Search falls back cleanly or gives a useful error; it never silently returns a false success.
- Ordinary chat works exactly as before with search disabled.
- Existing desktop and mobile animations remain visually unchanged.
- The full verification suite passes from a clean start.

## Phase 1 - Projects and User-Controlled Memory

This phase completes the workspace context already started in the working tree.

### Projects

- [ ] Complete create, read, update, archive, and delete flows.
- [ ] Add project instructions and project-scoped chats.
- [ ] Add project files, source metadata, storage quotas, and safe deletion.
- [ ] Add project search, sorting, and recent activity.
- [ ] Explain which project sources were used in an answer.
- [ ] Preserve standalone chats and allow moving a chat into or out of a project.

### Memory

- [ ] Support personal, project, session, and temporary scopes.
- [ ] Add memory on/off controls globally and per project.
- [ ] Require approval for automatically suggested durable memories.
- [ ] Allow review, edit, delete, import, and export.
- [ ] Show why a memory was used and provide a one-click ignore control.
- [ ] Exclude secrets and highly sensitive categories from automatic storage.
- [ ] Add retrieval ranking with source references and deterministic limits.
- [ ] Add temporary chats that neither read nor write durable memory.

### Acceptance criteria

- Users can always see and control what Kaori remembers.
- Project context never leaks into another project or user account.
- Deleting a project follows an explicit, tested policy for chats, files, and memories.
- Existing non-project conversations continue to work unchanged.

## Avatar Track - Web-Rendered 3D Kaori Prototype

Evaluate a VRM-based 3D Kaori before committing to a full replacement of Live2D. This track can run after the Phase 0 reliability baseline and does not block workspace features.

### Proposed stack

- Three.js as the browser renderer
- React Three Fiber as the React integration layer
- `@pixiv/three-vrm` and the VRM 1.0 avatar format
- glTF animation clips for idle, speaking, thinking, greeting, and emotion motion
- VRM expressions, look-at controls, humanoid bones, and spring bones
- Compressed textures and geometry with lazy loading

### Compatibility architecture

- [ ] Define one `AvatarRenderer` contract using the current `emotion`, `speaking`, and `audioLevel` inputs.
- [ ] Keep the current Live2D renderer unchanged as a fallback.
- [ ] Add the 3D renderer behind a development feature flag and user setting.
- [ ] Dynamically import the 3D runtime only when 3D mode is enabled.
- [ ] Fall back to Live2D or a static avatar when WebGL, memory, temperature, or battery conditions are unsuitable.
- [ ] Preserve the existing avatar container, layout, show/hide behavior, and surrounding UI animation.

### Prototype scope

- [ ] Load one licensed VRM 1.0 Kaori model locally.
- [ ] Implement transparent-background rendering and camera framing for the current avatar panel.
- [ ] Map idle, happy, shy, caring, excited, thinking, and sad to VRM expressions and animation layers.
- [ ] Add natural blinking, breathing, gaze, small head movement, and spring-bone updates.
- [ ] Drive initial lip movement from the existing audio level.
- [ ] Add phoneme or viseme-driven mouth shapes later when the voice pipeline can provide timing data.
- [ ] Cross-fade animation clips so state changes do not snap.
- [ ] Pause or reduce rendering when hidden, offscreen, or in a background tab.
- [ ] Dispose geometry, textures, animation mixers, and the WebGL context cleanly on unmount.
- [ ] Add loading, model-error, context-loss, and fallback states.

### Asset requirements

- [ ] Confirm commercial rights for the character model, textures, outfit, animations, and redistribution.
- [ ] Keep the initial download small enough for mobile use and display real loading progress.
- [ ] Use mesh, bone, material, and texture budgets defined by measurements rather than visual guesswork.
- [ ] Remove unused blend shapes, hidden geometry, oversized textures, and unnecessary materials.
- [ ] Store a versioned avatar manifest so model and animation updates can roll back safely.

### Performance decision gate

- [ ] Measure frame time, memory, model load time, draw calls, triangles, and context loss on representative devices.
- [ ] Target smooth desktop rendering and a stable reduced-quality mobile mode without affecting chat scrolling or typing.
- [ ] Dynamically scale pixel ratio, shadows, post-processing, animation update rate, and secondary motion.
- [ ] Test 320 px and 375 px mobile layouts, slow CPU, constrained network, and extended voice sessions.
- [ ] Compare 3D and Live2D for character quality, responsiveness, battery usage, bundle cost, and maintenance effort.

The 3D avatar becomes the default only if it meets the performance gate and feels at least as expressive as the current avatar. Otherwise, users keep Live2D by default while 3D remains optional.

## Phase 2 - Durable Task and Agent Foundation

Deep Research, automations, and multi-step tools must share one execution engine.

### Core task model

- [ ] Add durable runs, steps, events, approvals, artifacts, and usage records.
- [ ] Define states: queued, planning, running, waiting-for-approval, paused, completed, failed, and cancelled.
- [ ] Persist structured progress events and stream them to the current action passport UI.
- [ ] Support cancellation, resume, retry, idempotency keys, and timeout propagation.
- [ ] Add per-run tool, token, source, time, and spending budgets.
- [ ] Add model routing and fallback without duplicating tool executions.
- [ ] Store permission snapshots and an auditable action history.
- [ ] Add a feature-flag registry and server-side entitlement checks.

### Acceptance criteria

- A run survives page refresh and server restart.
- Cancellation stops downstream work and releases reservations.
- Retries do not repeat consequential actions.
- Every task exposes what it did, which tools it used, its sources, and its cost.

## Phase 3 - Deep Research

Deep Research is a durable workflow, not a single long prompt.

### Workflow

- [ ] Accept a question, project sources, uploaded files, domain filters, and budget limits.
- [ ] Generate an editable research plan before execution.
- [ ] Search multiple queries, fetch evidence, and record source snapshots.
- [ ] Deduplicate sources and score freshness, authority, relevance, and independence.
- [ ] Separate direct evidence, conflicting evidence, and model inference.
- [ ] Let the user redirect, pause, resume, or cancel while research runs.
- [ ] Verify important claims against cited source passages.
- [ ] Produce a cited report with Markdown, PDF, and Word export.
- [ ] Add a compact research-progress surface using the existing Kaori UI.

### Acceptance criteria

- Every factual claim that needs a source links to supporting evidence.
- The report clearly labels uncertainty and inference.
- Interrupted research can resume without starting over.
- Source and spending limits are enforced by the server.

## Phase 4 - Canvas and Interactive Artifacts

Build one split workspace for documents, code, research reports, and previews.

### Artifact foundation

- [ ] Add artifacts, revisions, comments, selections, and export metadata.
- [ ] Support Markdown, rich text, source code, HTML, React, diagrams, charts, and research reports.
- [ ] Add direct editing, autosave, selection-based AI edits, diff view, and version restoration.
- [ ] Stream patches rather than replacing an entire artifact.
- [ ] Add artifact reuse across chats and projects.

### Secure previews

- [ ] Render HTML and application previews in a sandboxed, isolated origin.
- [ ] Block parent access, secrets, unrestricted network calls, and unsafe navigation.
- [ ] Capture preview errors and offer bounded repair attempts.
- [ ] Provide responsive desktop/mobile preview modes.

### Acceptance criteria

- User edits are never overwritten silently.
- Any revision can be inspected and restored.
- Preview code cannot access the Kaori session or application origin.
- Opening Canvas does not disturb chat layout or animation behavior.

## Phase 5 - Sandboxed Code, Data Analysis, and Professional Files

Generated code must never execute inside the main Next.js process.

### Runtime

- [ ] Add ephemeral isolated Python and JavaScript workers.
- [ ] Enforce CPU, memory, disk, process, and execution-time limits.
- [ ] Disable network access by default and use explicit allowlists when required.
- [ ] Mount only per-run files; expose no application secrets or production database.
- [ ] Store logs and generated files, then destroy the environment.
- [ ] Support CSV, TSV, JSON, spreadsheets, PDFs, and document analysis.
- [ ] Support plots, charts, statistics, transformations, and reproducible notebooks.
- [ ] Generate and edit PDF, Word, PowerPoint, spreadsheet, and web artifacts.

### Acceptance criteria

- Malicious code cannot reach the application host, secrets, or another user's files.
- Resource limits terminate runaway jobs predictably.
- Results include code, logs, inputs, outputs, and downloadable files.
- The same analysis can be rerun from its recorded environment metadata.

## Phase 6 - Custom Kaoris, Skills, and Model Council

### Custom Kaoris

- [ ] Add name, icon, description, instructions, knowledge, starters, model preference, voice, and avatar settings.
- [ ] Add per-assistant tools, connectors, budgets, and safety policies.
- [ ] Support draft, private, link-shared, team, and published states.
- [ ] Add version history, duplication, templates, import, and export.
- [ ] Show a permission review before publishing or enabling a tool.

### Reusable skills

- [ ] Define a versioned skill format with instructions, inputs, outputs, tools, and tests.
- [ ] Add a permission manifest and dependency review.
- [ ] Keep skills sandboxed and revocable.

### Council mode

- [ ] Let users compare selected models on one prompt.
- [ ] Run responses independently with equal context and tool rules.
- [ ] Add an optional synthesis step that cites which model contributed each point.
- [ ] Show latency and cost before starting.

### Acceptance criteria

- Custom assistants cannot exceed their declared permissions.
- Editing a published assistant creates a new reviewable version.
- Council mode never multiplies cost without explicit user confirmation.

## Phase 7 - Voice, Vision, Image, and Web 3D Avatar

### Voice and avatar

- [ ] Add streaming speech recognition and low-latency speech synthesis.
- [ ] Add voice activity detection and interruption while Kaori is speaking.
- [ ] Keep searchable transcripts and clear microphone state controls.
- [ ] Synchronize the 3D VRM avatar's lip movement, gaze, expression, body motion, and thinking states.
- [ ] Keep Live2D and the static portrait as runtime fallbacks.
- [ ] Provide graceful reduced-motion and low-power mobile modes without removing the original animation style.

### Vision and generation

- [ ] Add image, camera, OCR, screenshot, chart, and UI understanding.
- [ ] Add opt-in screen sharing with a persistent capture indicator.
- [ ] Add image generation and editing with provenance metadata.
- [ ] Add optional video understanding.
- [ ] Add audio overviews for research and project material.

### Acceptance criteria

- Microphone, camera, and screen capture are visibly opt-in and immediately stoppable.
- Voice interruption feels natural on desktop and supported mobile browsers.
- The selected avatar renderer stays within an agreed frame-time, memory, and battery budget.
- Generated media clearly identifies its origin and model.

## Phase 8 - Connected Apps

### Initial order

1. Google Drive
2. Gmail
3. Google Calendar
4. GitHub
5. Notion
6. Slack or Microsoft Teams

### Connector platform

- [ ] Encrypt access and refresh tokens and support immediate revocation.
- [ ] Request narrow OAuth scopes and separate read from write permissions.
- [ ] Add per-project connector access and source selection.
- [ ] Preview and confirm email sends, calendar changes, publishing, and destructive writes.
- [ ] Scan retrieved content for prompt injection.
- [ ] Record visible action history with actor, target, permission, and outcome.
- [ ] Add provider rate limits, retries, token refresh, and degraded states.

### Acceptance criteria

- Revocation takes effect immediately.
- No connector write happens without the required confirmation.
- One project cannot access connectors that were not granted to it.
- Expired or missing permissions fail safely and explain how to recover.

## Phase 9 - Background Agents and Automations

### Capabilities

- [ ] Add one-time and recurring timezone-aware schedules.
- [ ] Add web monitors, change detection, digests, and background research.
- [ ] Add prepared email and calendar actions with approval before execution.
- [ ] Add notifications, unread results, pause, resume, edit, and delete.
- [ ] Add a durable worker queue, retries with backoff, concurrency controls, and dead-letter handling.
- [ ] Automatically disable repeatedly failing or stale jobs.
- [ ] Re-check current permissions before each consequential execution.

### Acceptance criteria

- Jobs execute at the expected local time across daylight-saving changes.
- Duplicate delivery does not duplicate external actions.
- Users can inspect every execution and disable a job immediately.
- Failed jobs have actionable errors and bounded retries.

## Phase 10 - Conversation and Collaboration Features

- [ ] Conversation branching from any message.
- [ ] Global search across chats, projects, memories, sources, and artifacts.
- [ ] Share links with expiration, revocation, and privacy controls.
- [ ] Export and import conversations with attachments and citations.
- [ ] Temporary and incognito conversations.
- [ ] Team projects, roles, comments, and change history.
- [ ] Study mode with quizzes, flashcards, guided explanations, and progress.
- [ ] Accessibility, localization, installable app behavior, offline drafts, and sync recovery.

## UI Integration Contract

Every new feature must look like Kaori rather than a separate embedded product.

- Reuse current color tokens, borders, radii, typography, shadows, spacing, and icon style.
- Extend existing sidebars, modals, tool cards, and action passports before creating new patterns.
- Keep the current bounce, entrance, hover, sidebar, and message animations intact; the 3D prototype changes only the avatar renderer.
- New motion should use the same easing and spring vocabulary.
- Animate transform and opacity where practical, but do not rewrite existing transitions solely for optimization.
- Maintain reduced-motion support without changing the default experience.
- Avoid permanent UI clutter: advanced controls should appear progressively when relevant.
- Mobile surfaces should use sheets or full-screen workspaces when split views do not fit.
- No feature is accepted with placeholder buttons, dead controls, fake progress, or mocked success states.

## Testing Matrix

### Automated

- Unit tests for validation, parsing, policy decisions, reducers, and state transitions
- API integration tests for authentication, ownership, rate limits, errors, and idempotency
- Database migration and rollback tests
- Tool-contract tests for every model provider
- End-to-end smoke tests for primary user journeys
- Security tests for SSRF, prompt injection, unsafe files, cross-user access, and secret leakage
- Accessibility checks and reduced-motion checks

### Manual verification

- Desktop: Chromium, Firefox, and WebKit-compatible browser
- Mobile: 320 px and 375 px widths, touch input, slow CPU, and constrained network
- Light and dark themes if both are supported
- Refresh, offline/online transition, expired session, provider outage, and task cancellation
- Visual comparison against the pre-feature baseline for chat and animations
- Avatar comparison on desktop and mobile with 3D enabled, Live2D fallback, context loss, and reduced-quality mode

## Immediate Implementation Batches

### Batch A - Reliability baseline

1. Repair web search and add provider fallback.
2. Add search and web-fetch regression tests.
3. Audit chat streaming, tool-loop, abort, and retry behavior.
4. Run lint, tests, type checking, and production build.
5. Capture desktop and mobile visual baselines.
6. Add the feature-flagged 3D avatar proof of concept without removing Live2D.

### Batch B - Finish existing workspace work

1. Complete and test Projects CRUD and project chat scoping.
2. Complete and test editable memory controls.
3. Add project files and temporary chats.
4. Verify all new workspace UI on mobile.

### Batch C - Shared durable runs

1. Add task/run schema and feature flags.
2. Add progress event streaming, cancellation, retry, and audit history.
3. Connect runs to the existing action passport.

### Batch D - First flagship capability

1. Build Deep Research on the durable run engine.
2. Add cited report artifacts.
3. Add Canvas for viewing and editing those reports.

Later batches proceed through sandboxed analysis, Custom Kaoris, multimodality, connectors, automation, and collaboration only after the preceding acceptance gates pass.

## Definition of 10/10

Kaori is ready to be called a top-tier assistant when a user can reliably:

- Organize long-running work in projects without context leakage.
- Understand and control every stored memory.
- Get current, cited web answers and durable research reports.
- Edit documents, code, and interactive artifacts with version history.
- Analyze data and create professional files in a secure sandbox.
- Build specialized Custom Kaoris with explicit permissions.
- Use natural voice, vision, image tools, and an expressive web-rendered 3D Kaori with reliable fallbacks.
- Connect services and approve consequential actions safely.
- Schedule background work and inspect every execution.
- Switch models without losing Kaori's context, personality, safety, or UI consistency.

The target is not feature count alone. A feature only improves Kaori when it is reliable, understandable, secure, responsive, and visually native to the product.

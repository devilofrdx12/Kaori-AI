# Kaori AI — Unified Assistant Feature Roadmap

Kaori AI can combine the strongest public capabilities associated with ChatGPT, Claude, and Gemini while retaining its own identity. The goal is not to copy proprietary implementations, but to build original equivalents on top of a shared, model-independent architecture.

## Product Vision

Kaori should become a unified AI workspace with:

- Persistent and user-controlled memory
- Projects with files, instructions, and scoped conversations
- An editable Canvas and interactive Artifacts
- Deep Research with plans, progress, citations, and reports
- Sandboxed code execution and data analysis
- Natural voice, vision, and screen interaction
- Custom assistants and reusable skills
- Connected apps and external services
- Background agents, monitors, and scheduled actions
- Transparent permissions, costs, sources, and action history

Models should remain interchangeable. Features such as projects, memory, research, tools, and artifacts should belong to Kaori rather than to a specific model provider.

## Target Feature Set

### ChatGPT-Inspired Capabilities

- Persistent, editable memory
- Projects with project-specific files, instructions, and chats
- Canvas for directly editing documents and source code
- Deep Research with editable plans and cited reports
- Image generation and editing
- Natural, interruptible voice conversations
- Sandboxed code execution and advanced data analysis
- Custom assistants
- Scheduled tasks
- Conversation branching, sharing, search, export, and temporary chats

ChatGPT Projects can incorporate connected sources, while Canvas supports direct editing, targeted revisions, and version restoration.

Sources:

- [ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-memory-a-guide)
- [ChatGPT Canvas guide](https://help.openai.com/en/articles/9930697-deep-research)

### Claude-Inspired Capabilities

- Live Artifacts for websites, diagrams, visualizations, and interactive tools
- Large-document analysis
- Professional PDF, Word, PowerPoint, and spreadsheet creation
- Reusable skills and workflows
- MCP-compatible connectors
- Auditable agent actions and artifact history
- Browser and computer operation with explicit approval
- Project-scoped memory
- Long-running background agents

Claude supports interactive Artifacts, office-file creation, project knowledge, connectors, scheduled tasks, and controlled computer use.

Sources:

- [Claude Artifacts](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them)
- [Claude file creation](https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude)
- [Claude computer use](https://support.claude.com/en/articles/14128542-let-claude-use-your-computer-in-cowork)

### Gemini-Inspired Capabilities

- Natural live voice and camera conversations
- Canvas for documents, code, and applications
- Deep Research using the web, uploaded files, and connected accounts
- Custom personas similar to Gems
- Google Drive, Gmail, Calendar, and GitHub integrations
- Audio overviews
- Image, music, and video generation
- Quizzes, flashcards, study guides, and learning modes
- Scheduled recurring actions
- Multi-step agent tasks

Gemini Deep Research can use web sources, uploaded files, Gmail, Drive, and notebooks. Its scheduled actions support recurring reports and digests.

Sources:

- [Gemini Deep Research](https://support.google.com/gemini/answer/15719111?hl=en)
- [Gemini scheduled actions](https://support.google.com/gemini/answer/16316416?hl=en)
- [Gemini Gems](https://support.google.com/gemini/answer/15236321?hl=en)

## Proposed Architecture

```text
Kaori interface
      │
      ├── Chats and Projects
      ├── Canvas and Artifacts
      ├── Voice and Vision
      └── Research and Agents
              │
       Agent orchestration engine
              │
   ┌──────────┼───────────┬──────────┐
 Models     Tools       Memory     Connectors
 Gemini     Search      Personal    Google
 Groq       Browser     Project     GitHub
 NVIDIA     Code        Session     Email
 Others     Files       Temporary   Calendar
              │
    Permission and safety layer
              │
      Jobs, database, and storage
```

## Implementation Roadmap

### Phase 1 — Projects and Real Memory

Build the shared context foundation first.

#### Features

- Project creation, editing, archiving, and deletion
- Project-specific instructions
- Project file collections
- Project-scoped conversations
- Personal, project, session, and temporary memory scopes
- Automatic memory suggestions with user approval
- Memory review, editing, deletion, import, and export
- Temporary chats that do not update memory
- Retrieval using embeddings
- Source references for retrieved knowledge
- Data-retention and privacy controls

#### Required safeguards

- Never store passwords, secrets, financial data, or health information automatically
- Let users disable memory globally or per project
- Display why a memory was used
- Encrypt sensitive stored content
- Provide complete account-data export and deletion

### Phase 2 — Kaori Canvas and Artifacts

Create a split-screen workspace combining document editing and interactive previews.

#### Supported artifacts

- Markdown and rich-text documents
- Source code
- HTML and React previews
- Diagrams and charts
- Reports and research outputs
- PDF, Word, PowerPoint, and Excel files

#### Features

- Direct user editing
- AI editing of selected content
- Inline comments and suggestions
- Version history and restoration
- Diff view
- Automatic error detection
- Secure preview sandbox
- Export and sharing
- Artifact reuse across conversations and projects

### Phase 3 — Deep Research

Implement research as a durable background workflow rather than a single model response.

#### Research lifecycle

1. Accept the question and preferred sources.
2. Generate an editable research plan.
3. Divide the plan into smaller investigations.
4. Search sources concurrently.
5. Fetch and extract relevant evidence.
6. Track supporting and contradictory information.
7. Allow the user to redirect the research while it runs.
8. Verify important claims against their sources.
9. Produce a cited report and downloadable artifact.

#### Requirements

- Store source metadata and evidence snapshots
- Distinguish sourced facts from model inference
- Link citations directly to supporting material
- Detect duplicate and low-quality sources
- Support trusted-domain filters
- Display progress and intermediate findings
- Enforce time, search, source, and spending limits
- Allow cancellation and resumption

### Phase 4 — Sandboxed Code Execution and Data Analysis

Model-generated code must never run inside the main Next.js server.

#### Runtime capabilities

- Ephemeral isolated containers
- Python and JavaScript runtimes
- CSV, TSV, JSON, spreadsheet, and document processing
- Plot and chart generation
- Statistical and data analysis
- Generated-file storage
- Package installation from approved registries

#### Security controls

- CPU, memory, storage, process, and execution-time limits
- Network disabled by default
- Explicit network allowlists when enabled
- Dependency allowlists and malware scanning
- Read-only base images
- No access to application secrets or the production database
- Complete execution logs
- Automatic environment destruction

### Phase 5 — Custom Kaoris

Build a custom-assistant system equivalent in purpose to GPTs, Gems, and Skills.

#### Configuration

- Name, icon, description, and instructions
- Knowledge files and project sources
- Default model and fallback preferences
- Enabled tools and connectors
- Conversation starters
- Voice and avatar preferences
- Safety and spending limits
- Private, link-shared, team, or public visibility

#### Management

- Version history
- Draft and published states
- Usage analytics
- Import and export format
- Duplication and templates
- Permission review before publishing

### Phase 6 — Connected Apps

Recommended initial integrations:

1. Google Drive
2. Gmail
3. Google Calendar
4. GitHub
5. Slack or Microsoft Teams
6. Notion

#### Connector requirements

- Narrow OAuth scopes
- Encrypted access and refresh tokens
- Immediate revocation
- Read and write permissions handled separately
- Preview and confirmation before consequential writes
- Visible action history
- Per-project connector access
- Prompt-injection scanning for retrieved content
- Rate and spending limits

### Phase 7 — Voice, Vision, and Multimodality

#### Voice

- Streaming speech recognition
- Low-latency response streaming
- Voice activity detection
- Interruptible speech synthesis
- User interruption while Kaori is speaking
- Multiple languages, voices, and speaking styles
- Searchable transcripts
- Clear microphone state and privacy controls

#### Vision

- Image and camera input
- OCR and document vision
- Screen sharing
- Chart, UI, and screenshot analysis
- Image generation and editing
- Optional video understanding

The existing Live2D avatar can become Kaori's defining advantage by synchronizing speech, lip movement, expression, gaze, and emotional state.

### Phase 8 — Background Agents and Automation

Complete the existing scheduled-task and monitoring foundation.

#### Capabilities

- One-time and recurring schedules
- Timezone-aware execution
- Web monitors and change detection
- Daily and weekly digests
- Background research
- Calendar and email preparation
- Notifications and unread results
- Pause, resume, edit, and delete
- Execution history and result artifacts

#### Operational requirements

- Durable job queue
- Idempotent execution
- Retry policies with exponential backoff
- Dead-letter queue
- Concurrency controls
- Per-user execution and spending limits
- Approval gates for external writes
- Permission snapshots captured when jobs are created
- Automatic disabling after repeated failures or inactivity

## Shared Agent Platform

All advanced features should use one orchestration engine.

### Core responsibilities

- Model routing and fallback
- Tool selection and execution
- Context assembly
- Memory retrieval
- Permission checking
- Cost estimation and reservation
- Cancellation and timeout propagation
- Structured event streaming
- Durable task state
- Audit logging
- Error recovery

### Suggested execution model

```text
User request
    ↓
Validate and classify
    ↓
Build visible action plan
    ↓
Check permissions and budget
    ↓
Select model and tools
    ↓
Execute bounded agent loop
    ↓
Verify results and citations
    ↓
Persist approved memory and artifacts
    ↓
Present result with action passport
```

## Safety and Trust Requirements

Every agent capability should follow these principles:

- Read operations before write operations
- Explicit confirmation for destructive or consequential actions
- Least-privilege tool permissions
- Per-tool time, call, data, and spending limits
- Maximum agent-loop depth
- Clear cancellation behavior
- Prompt-injection detection for external content
- Source attribution and uncertainty disclosure
- Full audit trail for external actions
- User-visible reason when an action is blocked
- Secrets excluded from model context and logs
- Human approval before email sending, publishing, purchasing, or account changes

Quartzwall should evolve into the central policy engine for these controls.

## Kaori's Differentiators

Kaori should not become a generic clone. Its strongest unique advantages can be:

- One consistent personality across every model
- A visible action passport explaining plans, tools, permissions, and results
- Inspectable Quartzwall security decisions
- Model-independent memory
- Expressive Live2D voice interaction
- Research, artifacts, and automation in one workspace
- Transparent model fallback and cost information
- User-controlled permissions and privacy
- A strong study and productivity mode

## Recommended Delivery Order

1. Finish production security and automated tests
2. Projects and memory
3. Canvas and Artifacts
4. Deep Research
5. Sandboxed code execution
6. Custom Kaoris
7. Connected apps
8. Voice, vision, and image generation
9. Background agents and scheduled actions
10. Collaboration, sharing, mobile, and enterprise controls

## Definition of Success

Kaori reaches the intended product standard when users can:

- Organize durable work into projects
- Control exactly what Kaori remembers
- Collaborate with Kaori on editable documents, code, and applications
- Run trustworthy cited research in the background
- Analyze data and create professional files safely
- Build specialized custom assistants
- Connect external services with narrow permissions
- Talk naturally using voice, images, camera, and screen context
- Schedule useful recurring work
- Inspect every important action, permission, source, and cost

The result should be more than a chatbot: a secure, transparent, expressive AI workspace centered on Kaori's personality and the user's control.

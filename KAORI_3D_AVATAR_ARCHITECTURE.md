# Kaori 3D Avatar - Standalone Project Architecture

## Decision

Build two fully independent websites and integrate them into one seamless Kaori experience:

1. **Kaori AI website** - chat, models, memory, projects, tools, settings, and voice.
2. **Kaori 3D website** - the complete PMX avatar viewer, renderer, animation, physics, and model controls.

The Kaori AI website will display the separate Kaori 3D website inside its avatar area. The two websites will communicate through a small, versioned browser bridge, but they will retain separate codebases, builds, deployments, domains, dependencies, and rollback histories.

The 3D renderer will not be installed inside Kaori AI's application bundle. It will run as its own website in a sandboxed iframe. If the 3D website fails, loads slowly, crashes, is redeployed, or is disabled, Kaori AI remains usable and falls back to the existing Live2D avatar or static portrait.

## Two Websites, One Product

```text
Website 1: Kaori AI
https://kaori.ai

  Chat interface
  +-----------------------------------------------+
  |                                               |
  |   Messages              Avatar panel          |
  |                         +------------------+  |
  |                         |                  |  |
  |                         | Website 2        |  |
  |                         | Kaori 3D website |  |
  |                         | embedded here    |  |
  |                         |                  |  |
  |                         +------------------+  |
  |                                               |
  +-----------------------------------------------+

Website 2: Kaori 3D
https://avatar.kaori.ai

  Also works independently as a full-page 3D experience.
```

To users, it should feel like one application. Technically, it remains two websites. Kaori AI owns the surrounding interface and assistant intelligence; Kaori 3D owns everything rendered inside its canvas.

## Goals

- Render Kaori's PMX model directly in the browser.
- Preserve the model's skeleton, morphs, textures, toon materials, and physics.
- Connect model expressions and gestures to Kaori's chat and voice state.
- Keep Babylon.js, WebAssembly, PMX parsing, and physics isolated from Kaori's core code.
- Support desktop and mobile with adaptive quality.
- Allow the avatar project to be tested, deployed, updated, or rolled back independently.
- Preserve Kaori's current interface and existing website animations.
- Let the 3D website run independently in full-screen mode for model testing, avatar interaction, and future experiences.
- Make the embedded mode visually borderless so it appears native to the Kaori AI website.

## Non-Goals for the First Version

- Rebuilding the complete Phoshco model viewer.
- Shipping Genshin Impact, Honkai: Star Rail, or Zenless Zone Zero character assets.
- Adding dance, music catalogue, WebXR, multiplayer, or full scene-editor features.
- Giving the avatar access to authentication tokens, memories, conversations, provider keys, or application secrets.
- Removing Live2D before the 3D implementation passes all quality and performance gates.

## Reference Projects

- [Phoshco/model-viewer](https://github.com/Phoshco/model-viewer)
- [Phoshco/gi](https://github.com/Phoshco/gi)
- [Phoshco/hsr](https://github.com/Phoshco/hsr)
- [Phoshco/zzz](https://github.com/Phoshco/zzz)
- [babylon-mmd](https://github.com/noname0310/babylon-mmd)
- [babylon-mmd documentation](https://noname0310.github.io/babylon-mmd/)

The Phoshco viewer demonstrates direct PMX/BPMX rendering, BVMD animation, MMD physics, SDEF skinning, toon outlines, camera control, audio synchronization, and mobile interaction using Babylon.js and `babylon-mmd`.

Its source code is MIT-licensed, but the game-model repositories do not visibly provide a reusable asset license. They may be used as technical references only. Kaori must use an original model or a model with explicit permission for modification and web redistribution.

## High-Level Architecture

```text
Kaori AI application
  |
  |-- Chat, model providers, tools, memory and projects
  |-- Voice playback and emotion state
  |-- Avatar bridge component
  |-- Live2D/static fallback
  |
  `-- Sandboxed cross-origin iframe
          |
          `-- Kaori Avatar Viewer
                 |-- Babylon.js engine
                 |-- babylon-mmd runtime
                 |-- PMX/BPMX loader
                 |-- BVMD/VMD animation loader
                 |-- WASM physics runtime
                 |-- Expression controller
                 |-- Gesture controller
                 |-- Lip-sync controller
                 |-- Camera controller
                 `-- Adaptive performance controller
```

## Repository Boundary

Create two separate repositories and websites.

### Website 1 repository - Kaori AI

```text
kaori-ai/
|-- src/
|-- public/
|-- db/
`-- package.json
```

This remains the current Kaori codebase. It does not install Babylon.js, `babylon-mmd`, Havok, or the PMX model files.

### Website 2 repository - Kaori 3D

```text
kaori-avatar-viewer/
|-- src/
|   |-- app/
|   |-- engine/
|   |-- models/
|   |-- animation/
|   |-- expressions/
|   |-- physics/
|   |-- audio/
|   |-- camera/
|   |-- bridge/
|   |-- performance/
|   `-- diagnostics/
|-- public/
|   |-- models/
|   |-- motions/
|   `-- wasm/
|-- tests/
|-- package.json
|-- tsconfig.json
`-- README.md
```

The main Kaori repository receives only a small integration layer:

```text
src/components/avatar/
|-- avatar-host.tsx
|-- avatar-bridge.ts
|-- avatar-protocol.ts
|-- avatar-fallback.tsx
`-- avatar-types.ts
```

## Deployment Boundary

Recommended production origins:

```text
Main application: https://kaori.ai
Avatar viewer:    https://avatar.kaori.ai
Model assets:     https://avatar-assets.kaori.ai
```

Recommended local development origins:

```text
Main application: http://localhost:3000
Avatar viewer:    http://localhost:3100
```

The avatar viewer must be deployable and rollbackable independently. Kaori should reference a versioned viewer release or deployment identifier rather than an uncontrolled latest build.

### Independent website behavior

Opening `https://avatar.kaori.ai` directly should show a complete standalone avatar experience with:

- Full-page renderer
- Model loading state
- Desktop and touch camera controls
- Quality selector
- Model diagnostics in development mode
- Safe error and unsupported-device states
- Optional full-screen mode

When the same website detects that it is embedded by an approved Kaori AI origin, it switches to embedded mode:

- Transparent background if selected by Kaori
- No duplicate navigation or page chrome
- Camera framing suited to the avatar panel
- Controls hidden unless Kaori enables them
- State driven by the Kaori bridge
- Pointer behavior that does not interfere with chat scrolling

The standalone and embedded modes use the same renderer and model assets; only their presentation and control ownership differ.

## Integration Method

Kaori embeds the viewer using a cross-origin iframe. Communication uses `window.postMessage` with an exact configured origin.

```tsx
<iframe
  title="Kaori 3D avatar"
  src={avatarViewerUrl}
  sandbox="allow-scripts"
  allow="autoplay"
/>
```

The final sandbox and permissions must be verified against the renderer's real requirements. Permissions must be added individually. Do not enable forms, popups, downloads, top-level navigation, microphone, camera, or storage unless a reviewed feature requires them.

Kaori should never visually redirect the user between the two websites during ordinary chat. It embeds the avatar website and controls it in place. A separate "Open 3D experience" action may open the full avatar website when the user explicitly chooses it.

Both applications must:

- Send messages only to an exact `targetOrigin`.
- Reject messages from unknown origins.
- Verify `event.source` is the expected iframe or parent window.
- Validate every message against a strict schema.
- Reject unknown protocol versions and message types.
- Enforce payload size and update-frequency limits.
- Never send private conversation text, tokens, keys, or memory content.

## Versioned Communication Protocol

### Envelope

```ts
type AvatarEnvelope<TType extends string, TPayload> = {
  namespace: "kaori-avatar";
  protocolVersion: 1;
  requestId?: string;
  type: TType;
  payload: TPayload;
};
```

### Commands from Kaori

```ts
type AvatarCommand =
  | AvatarEnvelope<"INITIALIZE", {
      quality: "low" | "medium" | "high" | "auto";
      reducedMotion: boolean;
      muted: boolean;
    }>
  | AvatarEnvelope<"SET_EMOTION", {
      emotion: "idle" | "happy" | "shy" | "caring" | "excited" | "thinking" | "sad";
      intensity?: number;
    }>
  | AvatarEnvelope<"SET_SPEAKING", { speaking: boolean }>
  | AvatarEnvelope<"SET_AUDIO_LEVEL", { level: number }>
  | AvatarEnvelope<"PLAY_GESTURE", { gesture: string; priority?: number }>
  | AvatarEnvelope<"SET_GAZE", { x: number; y: number }>
  | AvatarEnvelope<"SET_QUALITY", { quality: "low" | "medium" | "high" | "auto" }>
  | AvatarEnvelope<"SET_VISIBILITY", { visible: boolean }>
  | AvatarEnvelope<"PAUSE", Record<string, never>>
  | AvatarEnvelope<"RESUME", Record<string, never>>
  | AvatarEnvelope<"DISPOSE", Record<string, never>>;
```

### Events from the Avatar Viewer

```ts
type AvatarEvent =
  | AvatarEnvelope<"READY", {
      supportedProtocolVersions: number[];
      renderer: string;
    }>
  | AvatarEnvelope<"MODEL_LOADING", { progress: number }>
  | AvatarEnvelope<"MODEL_LOADED", {
      modelVersion: string;
      morphCount: number;
      boneCount: number;
    }>
  | AvatarEnvelope<"PERFORMANCE", {
      fps: number;
      frameTimeMs: number;
      quality: "low" | "medium" | "high";
    }>
  | AvatarEnvelope<"INTERACTION", { action: string }>
  | AvatarEnvelope<"CONTEXT_LOST", Record<string, never>>
  | AvatarEnvelope<"ERROR", {
      code: string;
      recoverable: boolean;
    }>;
```

## Avatar State Mapping

| Kaori state | Face | Body | Gaze | Voice behavior |
|---|---|---|---|---|
| Idle | Neutral | Breathing and small idle motion | Occasional natural movement | Mouth closed |
| Listening | Soft attentive expression | Upright attentive pose | Toward user | Mouth closed |
| Thinking | Focused | Thinking gesture | Slightly offset | Optional subtle movement |
| Speaking | Emotion-dependent | Small conversational gestures | Toward user | Lip-sync enabled |
| Happy | Smile | Light positive gesture | Direct | Expressive lip-sync |
| Shy | Blush or shy morph | Reserved gesture | Briefly averted | Softer movement |
| Caring | Gentle expression | Calm open posture | Direct and steady | Soft lip-sync |
| Excited | Bright expression | Energetic gesture | Direct | Stronger movement |
| Sad | Sad morph | Lower-energy posture | Lowered or indirect | Restrained movement |

## PMX Asset Pipeline

Each candidate model must pass inspection before being deployed.

### Required model package

- PMX or optimized BPMX model
- All texture files
- Toon and sphere textures
- VMD or BVMD motion files where applicable
- Physics data included in the model
- Bone and morph documentation if available
- Readme, author attribution, and license
- Explicit commercial web-redistribution permission if Kaori will be distributed commercially

### Inspection report

The avatar project should include a development-only inspector that reports:

- PMX version
- Bone names and hierarchy
- Morph names and categories
- Materials and texture dependencies
- Missing or unsupported files
- Mesh and vertex counts
- Draw calls and material count
- Rigid bodies and joints
- Model dimensions and scale
- Available animations
- Browser load time
- Peak memory estimate
- Desktop and mobile frame-time measurements

### Optimization

- Convert PMX to BPMX when measurements show a meaningful loading improvement.
- Convert VMD to BVMD for production animations when appropriate.
- Resize and compress oversized textures.
- Remove unused textures, materials, bones, morphs, and hidden meshes only after visual verification.
- Lazy-load the avatar after the chat interface becomes interactive.
- Cache immutable model versions with content hashes.
- Keep a manifest that maps model version, animation version, and compatible protocol version.

## Voice and Lip-Sync

Kaori remains responsible for speech playback. The avatar viewer does not receive provider audio URLs, authentication headers, or private TTS configuration.

### Version 1

- Kaori computes or receives an audio amplitude value.
- Kaori sends throttled `SET_AUDIO_LEVEL` messages.
- The avatar maps amplitude to the PMX mouth-open morph.
- Messages are limited to a reasonable frequency so they do not affect chat responsiveness.

### Later version

- The speech system produces timestamped phonemes or visemes.
- Kaori sends only the timing and mouth-shape identifiers.
- The avatar blends vowel and mouth morphs smoothly.
- Head movement and gestures remain separate animation layers.

## Failure Isolation and Fallback

```text
Open Kaori
   |
   |-- Render chat immediately
   |-- Render Live2D/static fallback
   `-- Start 3D iframe asynchronously
           |
           |-- READY within timeout
           |      `-- Load model and cross-fade to 3D
           |
           `-- Timeout, crash or unsupported device
                  `-- Keep fallback and record a safe diagnostic
```

Fallback conditions include:

- WebGL or WebAssembly unavailable
- Model download failure
- Missing texture or incompatible PMX data
- WebGL context loss
- Repeated runtime exceptions
- Excessive frame time or memory pressure
- Browser background state
- User-selected reduced-data or 2D mode
- Feature flag disabled

The main chat must never wait for the avatar viewer before becoming interactive.

Because the avatar is a separate website, its deployment can be taken offline, rolled back, or replaced without rebuilding Kaori AI. Kaori's integration configuration determines which approved avatar release is embedded.

## Performance Strategy

### Automatic quality controls

- Render resolution and device-pixel-ratio cap
- Shadow resolution and update frequency
- Physics update frequency
- Secondary-motion quality
- Post-processing effects
- Texture resolution
- Antialiasing
- Animation update rate
- Idle-frame throttling

### Runtime behavior

- Pause when the iframe is hidden or offscreen.
- Reduce updates when the browser tab is in the background.
- Avoid sending audio-level messages faster than the viewer can use them.
- Recover gracefully from context loss.
- Dispose meshes, materials, textures, observers, physics instances, animation objects, workers, and the engine on shutdown.

### Performance gates

- Chat scrolling and typing must remain responsive while the avatar is active.
- Desktop should feel consistently smooth on a representative mid-range device.
- Mobile must maintain a stable reduced-quality mode without overheating during normal sessions.
- Slow networks must show progress and retain the fallback avatar.
- Long voice sessions must not show continuing memory growth.

Final numerical budgets for model size, memory, draw calls, frame time, and loading time will be established after inspecting the selected Kaori PMX model.

## Security Requirements

- Host the avatar viewer on a separate origin.
- Apply a restrictive Content Security Policy.
- Restrict which parent origin may embed the viewer with `frame-ancestors`.
- Restrict Kaori's `frame-src` to the approved avatar origin.
- Disable forms, popups, top navigation, uncontrolled downloads, and unnecessary permissions.
- Validate both the message origin and message source.
- Validate messages with a runtime schema, not TypeScript types alone.
- Never pass access tokens, cookies, prompts, memories, tool outputs, or full conversation content.
- Serve models and textures only from an allowlisted asset origin.
- Do not allow arbitrary model URLs in production.
- Add integrity and version checks for model manifests.
- Return safe error codes rather than internal stack traces.

## Licensing Requirements

- Preserve MIT notices for reused or adapted source code.
- Record all third-party runtime dependencies and licenses.
- Use only a Kaori model and animations with explicit redistribution rights.
- Keep model-author attribution where required.
- Do not bundle assets from `Phoshco/gi`, `Phoshco/hsr`, or `Phoshco/zzz` without separate permission from the relevant rights holders.
- Store license metadata next to each versioned model manifest.

## Implementation Phases

### Phase 1 - Standalone proof of concept

- [ ] Create the independent Kaori 3D repository and website.
- [ ] Configure TypeScript, Babylon.js, `babylon-mmd`, and the tested WASM runtime.
- [ ] Render a simple scene and validate engine cleanup.
- [ ] Load one legally usable PMX model with all textures.
- [ ] Display model-loading progress and safe errors.
- [ ] Verify the model's bones, morphs, physics, and materials.
- [ ] Add orbit and portrait camera modes.
- [ ] Make the 3D website fully usable when opened directly.
- [ ] Add a dedicated embedded presentation mode for Kaori AI.

### Phase 2 - Kaori behavior controller

- [ ] Implement idle breathing, blinking, gaze, and subtle motion.
- [ ] Map Kaori emotions to available PMX morphs.
- [ ] Add animation layering and cross-fades.
- [ ] Add speaking state and amplitude-based lip-sync.
- [ ] Add interruption-safe gesture playback.
- [ ] Add model-specific bone and morph aliases.

### Phase 3 - Secure bridge

- [ ] Freeze protocol version 1.
- [ ] Add runtime message validation to both projects.
- [ ] Enforce exact origin and source validation.
- [ ] Add handshake, readiness, timeout, error, and disposal behavior.
- [ ] Add protocol-contract tests shared by both repositories.
- [ ] Ensure the viewer receives no private Kaori data.

### Phase 4 - Kaori integration

- [ ] Deploy the Kaori 3D website independently.
- [ ] Embed its approved URL in Kaori AI behind a development feature flag.
- [ ] Preserve the existing avatar panel and surrounding UI.
- [ ] Keep Live2D/static fallback active.
- [ ] Connect emotion, speaking, audio level, visibility, and quality states.
- [ ] Cross-fade only after the 3D viewer reports that the model is ready.
- [ ] Handle viewer reload, timeout, context loss, and unsupported devices.

### Phase 5 - Mobile optimization

- [ ] Measure actual target devices and browsers.
- [ ] Add automatic quality selection.
- [ ] Add dynamic resolution and physics scaling.
- [ ] Pause offscreen and background rendering.
- [ ] Test touch camera behavior without interfering with chat scrolling.
- [ ] Test extended voice sessions for heat, battery, and memory behavior.

### Phase 6 - Production readiness

- [ ] Deploy the viewer to its separate production origin.
- [ ] Add CSP, CORS, `frame-src`, and `frame-ancestors` policies.
- [ ] Add immutable versioned assets and rollback support.
- [ ] Add privacy-safe health and performance telemetry.
- [ ] Complete accessibility and reduced-motion behavior.
- [ ] Verify licensing and attribution.
- [ ] Run the full Kaori regression suite with 3D on, off, and failed.

## Test Plan

### Avatar project tests

- PMX/BPMX load success and failure
- Missing texture handling
- Morph and bone mapping
- Emotion transitions
- Animation interruption and cross-fading
- Lip-sync input bounds
- Physics start, pause, resume, and disposal
- WebGL context loss and recovery
- Memory cleanup after repeated mounting
- Quality scaling and visibility pausing

### Bridge tests

- Valid handshake
- Unsupported protocol version
- Invalid origin
- Invalid source window
- Unknown message type
- Malformed and oversized payload
- Excessive update rate
- Timeout and recovery
- Iframe reload during speech
- Disposal during model loading

### Kaori regression tests

- Chat loads before the viewer
- Sending, streaming, stopping, and retrying messages
- Sidebar and chat animations remain unchanged
- Avatar show/hide behavior
- Live2D/static fallback
- Mobile scrolling and input responsiveness
- Reduced motion and reduced data
- Viewer unavailable or blocked
- Slow model download
- Session refresh and route changes

## Acceptance Criteria

The standalone 3D avatar is ready for general use only when:

- Kaori chat works normally when the avatar service is offline.
- The iframe cannot access Kaori's DOM, session, tokens, or private data.
- One approved Kaori PMX model loads with correct textures, morphs, physics, and scale.
- Emotion and speaking changes feel natural and do not snap.
- Mobile chat remains responsive while the viewer uses adaptive quality.
- Repeated opening and closing does not leak significant memory or WebGL contexts.
- Every failure automatically restores or retains a usable fallback.
- The avatar can be disabled or rolled back without a Kaori application rollback.
- The 3D website works independently and also feels visually native when embedded in Kaori AI.
- All model and source-code licenses are documented and satisfied.
- The existing Kaori UI and non-avatar animations remain visually unchanged.

## Final Recommendation

Use the following production direction:

```text
Website 1: Kaori AI
        |
        | embeds and controls
        v
Website 2: Kaori 3D
Babylon.js + babylon-mmd + PMX/BPMX + BVMD
```

This architecture provides the expressive PMX avatar experience demonstrated by the reference viewer while keeping Kaori AI and Kaori 3D as two independently deployed websites that appear and behave like one product.

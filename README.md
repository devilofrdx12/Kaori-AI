# Kaori AI 🌸

Kaori AI is an advanced, multi-modal AI assistant built with Next.js and Turso/libSQL. It goes beyond simple chat by offering long-term memory, scheduled background tasks, web monitoring, and productivity tools, providing a deeply personalized and context-aware experience.

## ✨ Features

- **Multi-Provider LLM Support:** Seamlessly switch between Anthropic, Groq, and other OpenAI-compatible APIs.
- **Long-Term Memory System:** Kaori AI remembers user preferences, past conversations, and extracted facts.
- **Scheduled Tasks & Web Monitors:** Automate background tasks and set up cron-like monitors for web changes.
- **Productivity & Study Tools:** Integrated task management, code snippet library, and study session tracking.
- **OAuth Integrations:** Connect Google for one-click Single Sign-On (SSO) and account linking, plus Spotify for hands-free music and playlist playback control.
- **Pro Tier System:** Built-in support for Pro users with extended limits and capabilities.

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Language:** TypeScript
- **Database:** Turso/libSQL
- **Authentication:** Custom session-based auth with refresh token rotation + Google OAuth (SSO) & Spotify OAuth
- **AI Integration:** Anthropic SDK, Groq (via custom adapter)

## 🗄️ Database Schema Overview (v9)

The application uses a Turso-hosted libSQL database designed for online deployment.

- **`users` & `auth`**: Handles robust user management, pro tiers, and refresh token rotation.
- **`conversations` & `messages`**: Stores chat histories, tool usages, and reactions.
- **`user_memories`**: The core of the long-term memory system.
- **`scheduled_tasks` & `monitors`**: Manages active automated actions.
- **`tasks` & `snippets`**: Drives the productivity suite.
- **`oauth_tokens`**: Securely stores AES-256-GCM encrypted tokens for external integrations (Google & Spotify).

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- npm, yarn, pnpm, or bun

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/kaori-ai.git
   cd kaori-ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env.local` file in the root directory (refer to `.env.example` for all options):
   ```env
   # AI Providers
   ANTHROPIC_API_KEY=your_anthropic_key
   GROQ_API_KEY=your_groq_key

   # Google OAuth (Optional - Single Sign-On & Account Sync)
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

   # Spotify OAuth (Optional - Music Playback Control)
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/spotify/callback
   ```

   > [!NOTE]
   > For step-by-step developer console setup guides, cryptographic architecture, scopes, and troubleshooting for Google and Spotify integrations, refer to [**`oauth-readme.md`**](oauth-readme.md).

4. **Initialize Database:**
   Create a Turso database, set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, then the app will apply `db/schema.sql` automatically on first database access.

5. **Run the Development Server:**
   ```bash
   npm run dev
   ```

6. **Open the App:**
   Visit [http://localhost:3000](http://localhost:3000) in your browser. Well our chatbot is still in development so there may be some bugs, that's why I'm providing the source code here instead of a live demo, so you can test it out yourself. ~hehe sorry

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📜 License

This project is licensed under the MIT License.

**This is in Phase 4.5 right now and still in development ... feel free to contact me from my insta @_dark_shades_12_ for more assistance and questions.**

**~ Sayonara!**

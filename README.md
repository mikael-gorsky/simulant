# AI Voice Chatbot

A real-time AI voice chatbot with avatar visualization, powered by OpenAI's Realtime API and Simli's Avatar API. **Frontend-only architecture** - no backend server required!

## Features

- **Real-time Voice Conversation**: Natural speech with OpenAI's Realtime API
- **Animated Avatar**: Visual feedback through Simli's animated avatar
- **Secure Storage**: API keys and settings in Supabase database
- **Character Definitions**: Upload custom AI personalities (.txt files)
- **Live Status Updates**: Real-time system event monitoring
- **Microphone Indicator**: Visual feedback when speaking
- **Responsive Design**: Works on desktop and mobile
- **Dark Theme**: Modern interface
- **WebContainer Compatible**: Works in browser-based IDEs like Bolt.new

## Architecture

**Simplified Frontend-Only Architecture** (No Backend Required!)

```
┌─────────────────────────────────────────────────────┐
│               Frontend (React Browser)              │
│                                                     │
│  ┌────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Settings   │  │ Audio/Video │  │  Session    │ │
│  │ Management │  │  Handlers   │  │  Manager    │ │
│  └──────┬─────┘  └─────────────┘  └──────┬──────┘ │
└─────────┼────────────────────────────────┼─────────┘
          │                                 │
          │ HTTPS                           │ WebSocket
          ▼                                 ▼
  ┌───────────────┐               ┌──────────────────┐
  │   Supabase    │               │  External APIs   │
  │               │               │                  │
  │ • Database    │               │ • OpenAI Realtime│
  │ • Storage     │               │ • Simli Avatar   │
  │ • Functions   │               │   (Direct!)      │
  └───────────────┘               └──────────────────┘
```

### Why No Backend?

Both OpenAI Realtime API and Simli API support **direct browser connections**, making a backend proxy unnecessary. This provides:

- **WebContainer Compatibility** - Works in Bolt.new and similar environments
- **Reduced Latency** - Direct connections are faster
- **Simpler Deployment** - Just static files
- **Easier Development** - No server to manage

### Data Flow

**Settings & Storage:**
- Frontend ↔ Supabase Database (API keys, settings)
- Frontend ↔ Supabase Storage (character files)
- Frontend → Supabase Edge Functions (key validation)

**Real-time Conversation:**
- User speaks → Microphone capture
- Audio → OpenAI Realtime API (direct WebSocket)
- OpenAI response → Simli API (direct WebSocket/WebRTC)
- Simli video → Video display

## Prerequisites

- Modern browser with microphone support
- OpenAI API key ([platform.openai.com](https://platform.openai.com))
- Simli API key ([simli.com](https://simli.com))

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

### 3. Configure in Browser

1. Open `http://localhost:5173`
2. Click ⚙️ Settings
3. Enter OpenAI API key (starts with `sk-`)
4. Enter Simli API key
5. Click "Test" to validate each key
6. Click "Save Settings"

### 4. Start Conversation

1. Click green "Start Conversation" button
2. Allow microphone access when prompted
3. Wait 5-8 seconds for initialization (OpenAI + Simli connections)
4. Speak naturally
5. Avatar responds with animated speech
6. Click red "End Call" button when done

## Data Storage

All data stored in Supabase:

### Database Tables

- **api_keys** - Encrypted API keys (OpenAI, Simli)
- **app_settings** - User preferences
- **character_files** - File metadata

### Storage Buckets

- **character-files** - Character definition files

### Security

- Row Level Security (RLS) on all tables
- Anonymous access (demo mode)
- Secure file storage
- **Note**: API keys are visible in browser network tab when connecting to OpenAI/Simli

## Configuration

### Settings Panel Options

**API Configuration:**
- OpenAI API Key (required)
- Simli API Key (required)
- Test buttons validate via Edge Functions

**Avatar:**
- Face ID (default: tmp9i8bbq7c)

**Character:**
- Upload .txt file (max 100KB)
- Defines AI personality/behavior

**Audio/Video:**
- Avatar Delay (3 seconds default)
- Output Volume
- Mic Sensitivity

**Display:**
- Basic - Minimal info
- Detailed - Full log (recommended)
- Debug - Technical details

## Project Structure

```
├── src/
│   ├── components/             # React components
│   │   ├── SettingsPanel.tsx
│   │   ├── StatusLine.tsx
│   │   ├── MicrophoneIndicator.tsx
│   │   └── LoadingOverlay.tsx
│   ├── services/               # Frontend services
│   │   ├── settings-storage.ts     # Supabase data
│   │   ├── character-storage.ts    # File management
│   │   ├── openai-validator.ts     # Key validation
│   │   ├── simli-validator.ts      # Key validation
│   │   ├── openai-realtime.ts      # OpenAI direct connection
│   │   ├── simli-client.ts         # Simli direct connection
│   │   ├── session-manager.ts      # Session orchestration
│   │   ├── audio-capture.ts        # Microphone
│   │   └── video-handler.ts        # Video display
│   ├── lib/
│   │   ├── supabase.ts        # Supabase client
│   │   └── toast.tsx          # Notifications
│   └── App.tsx                # Main app
├── supabase/
│   ├── migrations/            # Database schema
│   └── functions/             # Edge Functions
│       ├── validate-openai-key/
│       └── validate-simli-key/
└── .env                       # Supabase credentials
```

## Troubleshooting

### Settings Won't Save

1. Check browser console for errors
2. Verify Supabase credentials in `.env`
3. Ensure internet connection
4. Check database migrations applied

### File Upload Fails

1. Verify .txt format
2. Check file size under 100KB
3. Verify Supabase Storage bucket exists
4. Check browser console

### Connection Failed

1. Verify API keys saved in Supabase database
2. Check browser console for errors
3. Ensure OpenAI API has sufficient credits
4. Verify Simli API key is valid
5. Try refreshing the page

### API Key Test Fails

1. Verify key format correct
2. Check service credits/access
3. Ensure Edge Functions deployed
4. Check browser console

### Microphone Not Working

1. Grant microphone permissions in browser
2. Check browser security settings
3. Ensure HTTPS/localhost (required for microphone)

## Building for Production

```bash
npm run build
npm run preview
```

Deploy the `dist/` folder to any static hosting service (Netlify, Vercel, Cloudflare Pages, etc.)

## Technical Details

### Audio Processing

- Format: PCM16 mono 16kHz
- Chunk size: 4096 samples
- Voice activity detection: RMS threshold
- Latency: <50ms

### Direct API Connections

**OpenAI Realtime:**
- WebSocket: `wss://api.openai.com/v1/realtime`
- Model: gpt-4o-realtime-preview-2024-10-01
- Features: Server VAD, transcription, audio responses

**Simli Avatar:**
- WebSocket: `wss://api.simli.ai/startWebRTCSession`
- WebRTC video stream
- Audio format: PCM16, 16kHz, 6000-byte chunks

### Security

- API keys stored in Supabase (encrypted at rest)
- RLS on all database tables
- Private storage buckets
- No localStorage secrets
- CORS configured
- **Note**: Keys visible in browser when active (use environment-specific keys for production)

## Browser Support

- Chrome 90+ ✓ (recommended)
- Edge 90+ ✓
- Firefox 88+ ✓
- Safari 14+ ⚠️ (limited WebRTC support)

## Migration from Backend Architecture

This project previously used a Node.js backend WebSocket proxy. We've migrated to a frontend-only architecture for:

- **Better compatibility** with WebContainer environments (Bolt.new, StackBlitz, etc.)
- **Reduced complexity** (no server to manage)
- **Lower latency** (direct API connections)
- **Simpler deployment** (static files only)

All functionality remains the same, just simplified!

## License

MIT

## Credits

- OpenAI Realtime API
- Simli Avatar API
- Supabase
- React + Vite

# Setup Guide

This guide explains how the application is configured and how data flows through the system.

## System Architecture

The application uses a **frontend-heavy architecture** with Supabase as the primary backend:

```
Frontend (React)
  ├── Supabase Client (direct connection)
  │     ├── Database - stores API keys, settings
  │     ├── Storage - stores character files
  │     └── Edge Functions - validates API keys
  │
  └── WebSocket Client
        └── Backend Server (minimal proxy)
              └── External APIs (OpenAI, Simli)
```

## Key Architectural Decisions

### 1. Frontend Talks Directly to Supabase

**What happens:**
- All settings, API keys, and files are saved directly from the frontend to Supabase
- No backend REST API for configuration
- Frontend uses Supabase JavaScript client library

**Why:**
- Simpler architecture
- Fewer moving parts
- Supabase handles authentication, security, and scaling
- Row Level Security provides data isolation

**Files involved:**
- `src/lib/supabase.ts` - Supabase client initialization
- `src/services/settings-storage.ts` - Database operations
- `src/services/character-storage.ts` - File operations

### 2. API Key Validation via Edge Functions

**What happens:**
- Frontend calls Supabase Edge Functions to validate API keys
- Edge Functions make test calls to OpenAI/Simli
- Results returned to frontend

**Why:**
- Keep API keys server-side during validation
- Edge Functions are serverless and scalable
- No need for dedicated backend validation endpoints

**Files involved:**
- `src/services/openai-validator.ts` - Calls Edge Function
- `src/services/simli-validator.ts` - Calls Edge Function
- `supabase/functions/validate-openai-key/index.ts` - Edge Function
- `supabase/functions/validate-simli-key/index.ts` - Edge Function

### 3. Backend is Minimal WebSocket Proxy

**What the backend does:**
- Provides WebSocket endpoint at `ws://localhost:3000/ws/session`
- Retrieves API keys from Supabase when session starts
- Proxies audio to OpenAI Realtime API
- Proxies video from Simli API
- That's it!

**What the backend DOES NOT do:**
- ❌ No REST API endpoints for settings
- ❌ No file upload endpoints
- ❌ No API key validation endpoints
- ❌ No database migrations
- ❌ No authentication

**Files involved:**
- `backend/src/index.ts` - WebSocket server
- `backend/src/services/supabase.ts` - Retrieves keys

## Data Storage

### Supabase Database

**api_keys table:**
```sql
CREATE TABLE api_keys (
  id uuid PRIMARY KEY,
  key_name text UNIQUE NOT NULL,
  key_value text NOT NULL,
  created_at timestamptz,
  updated_at timestamptz
);
```

Stores: `openai` and `simli` API keys

**app_settings table:**
```sql
CREATE TABLE app_settings (
  id uuid PRIMARY KEY,
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  created_at timestamptz,
  updated_at timestamptz
);
```

Stores: `simliFaceId`, `avatarDelay`, `audioVolume`, `micSensitivity`, `statusLineMode`

**character_files table:**
```sql
CREATE TABLE character_files (
  id uuid PRIMARY KEY,
  filename text NOT NULL,
  storage_path text UNIQUE NOT NULL,
  file_size integer NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz,
  updated_at timestamptz
);
```

Stores: Metadata for uploaded character files

### Supabase Storage

**character-files bucket:**
- Private bucket
- Stores .txt files (max 100KB)
- File paths stored in database
- Access controlled by RLS policies

### Security

**Row Level Security (RLS):**
- Enabled on all tables
- Anonymous users allowed (for demo)
- In production: restrict to authenticated users

**Example policies:**
```sql
-- Allow anyone to read/write (demo mode)
CREATE POLICY "Anyone can manage api_keys"
  ON api_keys FOR ALL TO anon USING (true);

CREATE POLICY "Anyone can manage settings"
  ON app_settings FOR ALL TO anon USING (true);
```

## Environment Variables

### Frontend (.env)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Used by:
- Frontend Supabase client
- Edge Function calls
- All database/storage operations

### Backend (.env)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
PORT=3000
```

Used by:
- Backend Supabase client
- Retrieving API keys for proxy
- WebSocket server configuration

**Note:** Backend file must be at `backend/.env`

## Complete Data Flow

### 1. User Saves API Key

```
User enters key in Settings Panel
         ↓
src/components/SettingsPanel.tsx
         ↓
src/services/settings-storage.ts
         ↓
Supabase Client (src/lib/supabase.ts)
         ↓
HTTP POST to Supabase API
         ↓
Supabase Database (api_keys table)
```

### 2. User Tests API Key

```
User clicks Test button
         ↓
src/components/SettingsPanel.tsx
         ↓
src/services/openai-validator.ts
         ↓
HTTP POST to Supabase Edge Function
         ↓
supabase/functions/validate-openai-key
         ↓
Edge Function calls OpenAI API
         ↓
Returns validation result
         ↓
Frontend shows success/error
```

### 3. User Uploads Character File

```
User selects .txt file
         ↓
src/components/SettingsPanel.tsx
         ↓
src/services/character-storage.ts
         ↓
Upload to Supabase Storage
         ↓
Save metadata to database
         ↓
File stored in character-files bucket
```

### 4. User Starts Conversation

```
User clicks Start button
         ↓
src/App.tsx (handleStartConversation)
         ↓
src/services/session-manager.ts
         ↓
WebSocket connection to backend
         ↓
backend/src/index.ts
         ↓
Backend retrieves API keys from Supabase
         ↓
Backend connects to OpenAI + Simli
         ↓
Audio/video streaming begins
```

## Development Workflow

### Adding a New Setting

1. Add to database:
```sql
INSERT INTO app_settings (setting_key, setting_value)
VALUES ('myNewSetting', '"defaultValue"');
```

2. Add to TypeScript interface:
```typescript
// src/services/settings-storage.ts
export interface AppSettings {
  myNewSetting?: string  // Add this
  // ... existing settings
}
```

3. Add to UI:
```typescript
// src/components/SettingsPanel.tsx
<Input
  value={settings.myNewSetting}
  onChange={(e) => setSettings({...settings, myNewSetting: e.target.value})}
/>
```

4. Save/load automatically handled by existing code

### Adding a New Edge Function

1. Create function directory:
```bash
mkdir -p supabase/functions/my-function
```

2. Create index.ts:
```typescript
// supabase/functions/my-function/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const { data } = await req.json();

  // Your logic here

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
```

3. Deploy (handled automatically by Supabase)

4. Call from frontend:
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/my-function`,
  {
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data })
  }
);
```

## Common Issues

### "Missing Supabase environment variables"

**Problem:** Backend can't find environment variables

**Solution:**
```bash
cd backend
cat .env  # Verify file exists
# Should contain SUPABASE_URL and SUPABASE_ANON_KEY
```

**Why:** Backend needs its own .env file in backend/ directory

### "Could not find column 'storage_path'"

**Problem:** Database schema out of date

**Solution:** Database migrations need to be applied (usually automatic)

**Why:** Table structure changed to use Supabase Storage instead of storing files in database

### "RLS policy prevents operation"

**Problem:** Row Level Security blocking database access

**Solution:** Check RLS policies are configured for anonymous access:
```sql
-- Example fix
CREATE POLICY "Allow anon access" ON table_name
  FOR ALL TO anon USING (true);
```

**Why:** RLS is enabled but no policy allows access

### Edge Function CORS Error

**Problem:** Browser blocks Edge Function calls

**Solution:** Ensure CORS headers in Edge Function:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
```

**Why:** Browser security requires explicit CORS headers

## Production Considerations

### Security Hardening

1. **Enable Authentication:**
   - Use Supabase Auth
   - Change RLS policies from `anon` to `authenticated`
   - Add user_id to tables

2. **Encrypt API Keys:**
   - Use Supabase Vault for encryption
   - Never log keys
   - Rotate keys regularly

3. **Rate Limiting:**
   - Add to Edge Functions
   - Limit database operations
   - Monitor usage

### Scaling

**Supabase handles:**
- Database scaling
- Storage scaling
- Edge Function scaling
- CDN for static files

**You handle:**
- Backend WebSocket server
- Horizontal scaling via load balancer
- WebSocket connection management

## Summary

The current architecture:

✅ Frontend stores all data in Supabase
✅ Edge Functions validate API keys
✅ Backend is minimal WebSocket proxy
✅ Simple, scalable, secure

❌ No backend REST API
❌ No file upload to backend
❌ No backend authentication

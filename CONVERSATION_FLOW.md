# Conversation Flow

This document explains how real-time conversations work in the AI Voice Chatbot using **direct browser connections** to OpenAI and Simli APIs.

## Overview

The conversation uses **direct WebSocket connections** from the browser to stream audio between the user and external AI services (OpenAI and Simli). No backend proxy is required!

## Architecture for Conversations

```
     Frontend (Browser)              External APIs
┌──────────────────────┐      ┌─────────────────┐
│                      │      │                 │
│  Audio Capture       │─────>│   OpenAI        │
│  (Microphone)        │ WS   │   Realtime API  │
│                      │      │   (Direct!)     │
│                      │<─────│                 │
│  Video Display       │      └─────────────────┘
│  (Avatar)            │
│                      │      ┌─────────────────┐
│  Session Manager     │─────>│    Simli        │
│  • OpenAI Client     │ WS   │    Avatar API   │
│  • Simli Client      │<─────│    (Direct!)    │
│                      │      └─────────────────┘
│  Supabase Client     │
│  • Loads API Keys    │      ┌─────────────────┐
│  • Character Files   │─────>│   Supabase      │
│                      │ HTTPS│   Database      │
└──────────────────────┘      └─────────────────┘
```

## Session Lifecycle

### 1. Initialization

When user clicks "Start Conversation":

**Step 1: Request Microphone**
```javascript
// src/services/audio-capture.ts
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
```
- Browser prompts for permission
- Creates MediaStream object
- Initializes Web Audio API

**Step 2: Load API Keys from Supabase**
```javascript
// src/services/session-manager.ts
const openaiKey = await supabase.from('api_keys').select('key_value').eq('key_name', 'openai')
const simliKey = await supabase.from('api_keys').select('key_value').eq('key_name', 'simli')
```
- Retrieves encrypted keys from database
- Validates keys are present
- Connection state: `idle` → `connecting`

**Step 3: Load Character File (Optional)**
```javascript
// src/services/session-manager.ts
const characterFile = await supabase.from('character_files')
  .select('storage_path').eq('is_active', true)
const content = await supabase.storage.from('character-files').download(path)
```
- Downloads character definition if present
- Prepares to send to OpenAI

**Step 4: Connect to OpenAI Realtime API**
```javascript
// src/services/openai-realtime.ts
const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01')
ws.headers = {
  'Authorization': `Bearer ${apiKey}`,
  'OpenAI-Beta': 'realtime=v1'
}
```
- Direct WebSocket connection from browser
- Authenticates with OpenAI key
- Sends character definition (if loaded)
- Configures server-side VAD (Voice Activity Detection)
- OpenAI connection ready

**Step 5: Connect to Simli API**
```javascript
// src/services/simli-client.ts
// Initialize session
await fetch('https://api.simli.ai/startAudioToVideoSession', {
  body: JSON.stringify({ faceId, apiKey, syncAudio: true })
})
// Setup WebRTC
const ws = new WebSocket('wss://api.simli.ai/startWebRTCSession')
```
- Direct connection from browser
- Authenticates with Simli key
- Establishes WebRTC video stream
- Mandatory 3-second warmup period
- Simli connection ready
- Connection state: `connecting` → `connected`

**Step 6: Start Audio Capture**
```javascript
// src/services/audio-capture.ts
audioCapture.start()
```
- Begin capturing from microphone
- Convert to PCM16 format (16kHz, mono)
- Connection state: `connected` → `active`

### 2. Active Conversation

#### Audio Input Flow

```
User speaks
    ↓
Microphone captures (Web Audio API)
    ↓
ScriptProcessor converts to PCM16
    ↓
src/services/audio-capture.ts
    ↓
Emit 'audio' event with ArrayBuffer
    ↓
src/services/session-manager.ts
    ↓
Forward to OpenAI client
    ↓
src/services/openai-realtime.ts
    ↓
Convert to base64, send via WebSocket directly to OpenAI
    {
      type: 'input_audio_buffer.append',
      audio: base64EncodedPCM16
    }
    ↓
OpenAI processes speech with server VAD
```

#### Response Flow

```
OpenAI generates response
    ↓
OpenAI sends audio delta events (24kHz PCM16 base64)
    {
      type: 'response.audio.delta',
      delta: base64Audio
    }
    ↓
src/services/openai-realtime.ts receives
    ↓
Emit 'audioResponse' event
    ↓
src/services/session-manager.ts
    ↓
Convert base64 to ArrayBuffer
    ↓
Send to Simli client
    ↓
src/services/simli-client.ts
    ↓
Send PCM16 audio via WebSocket to Simli (6000-byte chunks)
    ↓
Simli generates video frames
    ↓
WebRTC video stream to browser
    ↓
src/services/video-handler.ts
    ↓
Display in <video> element via srcObject
```

#### Transcript Flow

```
OpenAI transcribes user speech
    ↓
OpenAI sends transcript event
    {
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: "user's words"
    }
    ↓
src/services/openai-realtime.ts
    ↓
Emit 'transcript' event
    ↓
src/services/session-manager.ts
    ↓
Emit 'status' event
    ↓
src/components/StatusLine.tsx
    ↓
Display in UI
```

### 3. Ending Session

When user clicks "End Call":

**Step 1: Stop Audio**
```javascript
// src/services/audio-capture.ts
audioCapture.stop()
```
- Stop microphone stream
- Close audio context

**Step 2: Disconnect OpenAI**
```javascript
// src/services/openai-realtime.ts
openaiClient.disconnect()
ws.close()
```
- Close WebSocket connection
- Clean up event listeners

**Step 3: Disconnect Simli**
```javascript
// src/services/simli-client.ts
simliClient.disconnect()
ws.close()
peerConnection.close()
```
- Close WebSocket connection
- Close WebRTC peer connection
- Release video stream

**Step 4: Frontend Cleanup**
```javascript
videoRef.current.srcObject = null
setConnectionState('idle')
sessionManager = null
```
- Clear video element
- Reset state
- Connection state: `active` → `ending` → `idle`

## WebSocket Message Protocols

### OpenAI Realtime API Messages

**Browser → OpenAI:**

```json
{
  "type": "input_audio_buffer.append",
  "audio": "base64_encoded_pcm16_audio"
}
```

```json
{
  "type": "session.update",
  "session": {
    "instructions": "character definition text",
    "turn_detection": {
      "type": "server_vad",
      "threshold": 0.5,
      "silence_duration_ms": 500
    }
  }
}
```

**OpenAI → Browser:**

```json
{
  "type": "session.created",
  "session": {
    "id": "sess_123"
  }
}
```

```json
{
  "type": "response.audio.delta",
  "delta": "base64_pcm16_audio_chunk"
}
```

```json
{
  "type": "conversation.item.input_audio_transcription.completed",
  "transcript": "what the user said"
}
```

### Simli API Messages

**Browser → Simli:**

```javascript
// WebRTC offer
ws.send(JSON.stringify({
  sdp: offer.sdp,
  type: offer.type
}))

// Audio data (raw PCM16 bytes)
ws.send(new Uint8Array(audioBuffer))
```

**Simli → Browser:**

```
"START"  // Begin streaming
"STOP"   // End streaming
```

```json
{
  "sdp": "...",
  "type": "answer"
}
```

Video arrives via WebRTC MediaStream

## Connection States

```
idle
  ↓ (user clicks start)
connecting (requesting mic, loading keys, connecting to APIs)
  ↓
connected (both APIs connected, ready to start)
  ↓
active (conversation in progress)
  ↓ (user clicks end or error)
ending (cleanup in progress)
  ↓
idle
```

### Visual Indicators

- **Gray dot**: idle
- **Yellow dot**: connecting/connected
- **Green dot + pulse**: active
- **Red dot**: error

## Error Handling

### Microphone Errors

**Permission Denied:**
```javascript
// src/services/audio-capture.ts
try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
} catch (error) {
  if (error.name === 'NotAllowedError') {
    toast.error('Microphone permission denied')
  }
}
```

### API Connection Errors

**OpenAI Connection Failed:**
```javascript
// src/services/openai-realtime.ts
ws.onerror = (error) => {
  emitStatus({
    category: 'error',
    message: 'OpenAI connection failed',
    level: 'error'
  })
}
```

**Simli Connection Failed:**
```javascript
// src/services/simli-client.ts
if (peerConnection.iceConnectionState === 'failed') {
  emitStatus({
    category: 'error',
    message: 'Simli connection failed',
    level: 'error'
  })
}
```

### Missing API Keys

**Keys Not in Database:**
```javascript
// src/services/session-manager.ts
if (!openaiApiKey || !simliApiKey) {
  throw new Error('API keys not configured')
}
```

## Status Message Categories

### Connection
- Application initialized
- Microphone access granted/denied
- API keys loaded
- Services connected/disconnected
- Session lifecycle events

### Audio
- Microphone started/stopped
- Audio format conversion
- Voice activity detection

### OpenAI
- Connection status
- Character file loaded
- Session created
- Transcript received
- Response processing

### Simli
- Connection status
- WebRTC established
- Video streaming active
- Initialization delay (3s)

### User
- Speaking detected
- Transcript: "user's words"

### Error
- All error conditions
- API failures
- Connection issues

## Performance Optimization

### Audio Processing

**Efficient chunking:**
```javascript
// 4096 samples at 16kHz = 256ms of audio
const CHUNK_SIZE = 4096
```

**Voice Activity Detection:**
```javascript
// Calculate RMS to detect speech
const rms = Math.sqrt(sum / buffer.length)
if (rms > threshold) {
  // Speech detected
}
```

### Network Optimization

**Direct Connections:**
- No proxy latency
- Browser-native WebSocket and WebRTC
- Optimized by browser engine

**Chunked Audio to Simli:**
```javascript
// 6000-byte chunks (Simli recommended)
const SIMLI_CHUNK_SIZE = 6000
```

### Memory Management

**Clean up on session end:**
```javascript
// Close all connections
openaiClient.disconnect()
simliClient.disconnect()
audioCapture.stop()

// Clear video
videoElement.srcObject = null

// Clear references
sessionManager = null
```

## Debugging

### Status Line Modes

**Basic:**
- Current status only
- Minimal information

**Detailed (recommended):**
```
[14:23:45] [CONNECTION] Microphone access granted
[14:23:46] [CONNECTION] API keys loaded successfully
[14:23:47] [OPENAI] Connected to OpenAI Realtime API
[14:23:48] [SIMLI] Simli ready for audio streaming
[14:23:50] [USER] Speaking detected
[14:23:52] [USER] Transcript: "Hello there"
```

**Debug:**
```
[14:23:45] [CONNECTION] Microphone access granted
            Details: { sampleRate: 16000, channelCount: 1 }
[14:23:47] [OPENAI] Session created
            Details: { sessionId: "sess_abc123", model: "gpt-4o..." }
```

### Browser Console Logging

All services emit detailed logs:
```javascript
console.log('[OpenAI] Session created:', sessionId)
console.log('[Simli] Video track received')
console.log('[AudioCapture] Voice activity detected')
```

### Network Tab Monitoring

Use browser DevTools Network tab to inspect:
- WebSocket connections to OpenAI and Simli
- API key transmission (visible in headers)
- Message frequency and size

## Character Definition Loading

When character file is uploaded:

1. **Frontend uploads to Supabase Storage:**
```javascript
// src/services/character-storage.ts
await supabase.storage
  .from('character-files')
  .upload(storagePath, file)
```

2. **Metadata saved to database:**
```javascript
await supabase
  .from('character_files')
  .insert({
    filename: file.name,
    storage_path: storagePath,
    is_active: true
  })
```

3. **During conversation start, frontend retrieves:**
```javascript
// src/services/session-manager.ts
const characterFile = await loadCharacterFile()
// Downloads from Storage
// Reads file content
// Returns text content
```

4. **Frontend sends to OpenAI:**
```javascript
// src/services/openai-realtime.ts
openaiClient.updateSession(characterInstructions)
// Sends session.update with instructions
```

## Summary

The conversation flow (simplified):

1. Frontend requests microphone access
2. Frontend loads API keys from Supabase
3. Frontend connects directly to OpenAI Realtime API via WebSocket
4. Frontend connects directly to Simli API via WebSocket/WebRTC
5. Audio streams: User → OpenAI (direct)
6. Response streams: OpenAI → Simli (via frontend) → Video display
7. Real-time status updates throughout
8. Clean disconnect on session end

Key advantages of direct connections:

- **No backend required** - Works in any browser environment
- **Lower latency** - No proxy hop
- **Simpler deployment** - Static files only
- **WebContainer compatible** - Works in Bolt.new, StackBlitz, etc.
- **Fewer dependencies** - No server to manage

Security considerations:

- API keys loaded from Supabase (encrypted at rest)
- Keys visible in browser network tab during active session
- Use separate keys for development/production
- RLS on Supabase tables prevents unauthorized access

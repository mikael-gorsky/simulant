import { Phone, PhoneOff, Settings } from 'lucide-react';
import { Button } from './components/ui/button';

function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight">AI Voice Chatbot</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-4xl space-y-8">
          <div className="flex justify-center">
            <div
              className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800"
              style={{ width: '640px', height: '480px' }}
            >
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <div className="text-center">
                  <div className="text-6xl mb-4">🎭</div>
                  <p className="text-sm">Avatar will appear here</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled
            >
              <Phone className="w-5 h-5" />
              Start Conversation
            </Button>

            <Button
              size="lg"
              variant="secondary"
              disabled
            >
              <Settings className="w-5 h-5" />
              Settings
            </Button>

            <Button
              size="lg"
              variant="destructive"
              disabled
            >
              <PhoneOff className="w-5 h-5" />
              End Call
            </Button>
          </div>

          <div className="text-center text-sm text-zinc-500">
            All buttons are disabled until API configuration is complete
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

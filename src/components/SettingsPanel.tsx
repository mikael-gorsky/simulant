import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from '@/lib/toast'
import { testOpenAIKey } from '@/services/openai-validator'
import { testSimliKey } from '@/services/simli-validator'
import { validateSimliFaceId } from '@/services/simli-face-validator'
import {
  saveApiKey,
  getApiKey,
  saveAllSettings,
  getAllSettings,
  clearAllSettings,
} from '@/services/settings-storage'
import {
  uploadCharacterFile,
  getActiveCharacterFile,
  clearActiveCharacterFile,
} from '@/services/character-storage'

interface SettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFaceIdValidated?: (faceId: string) => void
}

interface Settings {
  openaiApiKey: string
  simliApiKey: string
  simliFaceId: string
  characterFile: File | null
  characterContent: string
  avatarDelay: number
  audioVolume: number
  micSensitivity: number
  statusLineMode: 'basic' | 'detailed' | 'debug'
}

const DEFAULT_SETTINGS: Settings = {
  openaiApiKey: '',
  simliApiKey: '',
  simliFaceId: '6ebf0aa7-6fed-443d-a4c6-fd1e3080b215',
  characterFile: null,
  characterContent: '',
  avatarDelay: 3,
  audioVolume: 80,
  micSensitivity: 50,
  statusLineMode: 'detailed',
}

export function SettingsPanel({ open, onOpenChange, onFaceIdValidated }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [characterFileName, setCharacterFileName] = useState<string>('No file loaded')
  const [isTesting, setIsTesting] = useState({ openai: false, simli: false, face: false })
  const [testResults, setTestResults] = useState({ openai: '', simli: '', face: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const [openaiKey, simliKey, appSettings, characterFile] = await Promise.all([
        getApiKey('openai'),
        getApiKey('simli'),
        getAllSettings(),
        getActiveCharacterFile(),
      ])

      setSettings((prev) => ({
        ...prev,
        openaiApiKey: openaiKey || '',
        simliApiKey: simliKey || '',
        simliFaceId: appSettings.simliFaceId || DEFAULT_SETTINGS.simliFaceId,
        avatarDelay: appSettings.avatarDelay || DEFAULT_SETTINGS.avatarDelay,
        audioVolume: appSettings.audioVolume || DEFAULT_SETTINGS.audioVolume,
        micSensitivity: appSettings.micSensitivity || DEFAULT_SETTINGS.micSensitivity,
        statusLineMode: appSettings.statusLineMode || DEFAULT_SETTINGS.statusLineMode,
        characterContent: characterFile?.content || '',
      }))

      if (characterFile) {
        setCharacterFileName(characterFile.metadata.filename)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error('Failed to load settings from database')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    try {
      const result = await uploadCharacterFile(file)
      const content = await file.text()

      setSettings((prev) => ({
        ...prev,
        characterFile: file,
        characterContent: content,
      }))
      setCharacterFileName(file.name)
      toast.success('Character file uploaded successfully')
    } catch (error) {
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error('File upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleClearFile = async () => {
    try {
      await clearActiveCharacterFile()
      setSettings((prev) => ({
        ...prev,
        characterFile: null,
        characterContent: '',
      }))
      setCharacterFileName('No file loaded')
      toast.success('Character file cleared')
    } catch (error) {
      toast.error(`Failed to clear file: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error('Clear file error:', error)
    }
  }

  const handleSave = async () => {
    if (!settings.openaiApiKey || !settings.simliApiKey) {
      toast.error('Please enter both API keys')
      return
    }

    setIsSaving(true)

    try {
      await Promise.all([
        saveApiKey('openai', settings.openaiApiKey),
        saveApiKey('simli', settings.simliApiKey),
        saveAllSettings({
          simliFaceId: settings.simliFaceId,
          avatarDelay: settings.avatarDelay,
          audioVolume: settings.audioVolume,
          micSensitivity: settings.micSensitivity,
          statusLineMode: settings.statusLineMode,
        }),
      ])

      toast.success('Settings saved successfully!')
      onOpenChange(false)
    } catch (error) {
      toast.error(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error('Save settings error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestOpenAI = async () => {
    if (!settings.openaiApiKey) {
      toast.error('Please enter OpenAI API key first')
      return
    }

    setIsTesting(prev => ({ ...prev, openai: true }))
    setTestResults(prev => ({ ...prev, openai: '' }))

    try {
      const result = await testOpenAIKey(settings.openaiApiKey)

      if (result.success) {
        setTestResults(prev => ({ ...prev, openai: 'success' }))
        toast.success(result.details || 'OpenAI connection successful!')
      } else {
        setTestResults(prev => ({ ...prev, openai: 'error' }))
        toast.error(result.details || result.message)
      }
    } catch (error) {
      console.error('OpenAI test error:', error)
      setTestResults(prev => ({ ...prev, openai: 'error' }))
      toast.error(`Failed to test OpenAI connection: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsTesting(prev => ({ ...prev, openai: false }))
    }
  }

  const handleTestSimli = async () => {
    if (!settings.simliApiKey) {
      toast.error('Please enter Simli API key first')
      return
    }

    setIsTesting(prev => ({ ...prev, simli: true }))
    setTestResults(prev => ({ ...prev, simli: '' }))

    try {
      const result = await testSimliKey(settings.simliApiKey)

      if (result.success) {
        setTestResults(prev => ({ ...prev, simli: 'success' }))
        toast.success(result.details || 'Simli connection successful!')
      } else {
        setTestResults(prev => ({ ...prev, simli: 'error' }))
        toast.error(result.details || result.message)
      }
    } catch (error) {
      console.error('Simli test error:', error)
      setTestResults(prev => ({ ...prev, simli: 'error' }))
      toast.error(`Failed to test Simli connection: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsTesting(prev => ({ ...prev, simli: false }))
    }
  }

  const handleTestFaceId = async () => {
    if (!settings.simliApiKey) {
      toast.error('Please enter Simli API key first')
      return
    }

    if (!settings.simliFaceId) {
      toast.error('Please enter Face ID first')
      return
    }

    setIsTesting(prev => ({ ...prev, face: true }))
    setTestResults(prev => ({ ...prev, face: '' }))

    try {
      const result = await validateSimliFaceId(settings.simliApiKey, settings.simliFaceId)

      if (result.success) {
        setTestResults(prev => ({ ...prev, face: 'success' }))
        toast.success(result.details || 'Face ID is valid and accessible!')
        onFaceIdValidated?.(settings.simliFaceId)
      } else {
        setTestResults(prev => ({ ...prev, face: 'error' }))
        toast.error(result.details || result.message)
      }
    } catch (error) {
      console.error('Face ID test error:', error)
      setTestResults(prev => ({ ...prev, face: 'error' }))
      toast.error(`Failed to test Face ID: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsTesting(prev => ({ ...prev, face: false }))
    }
  }

  const handleReset = async () => {
    try {
      await clearAllSettings()
      await clearActiveCharacterFile()
      setSettings(DEFAULT_SETTINGS)
      setCharacterFileName('No file loaded')
      setTestResults({ openai: '', simli: '', face: '' })
      toast.success('Settings reset to defaults')
    } catch (error) {
      toast.error(`Failed to reset settings: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error('Reset error:', error)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  const getPreviewText = () => {
    if (!settings.characterContent) return ''
    return settings.characterContent.slice(0, 500) +
           (settings.characterContent.length > 500 ? '...' : '')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configure your AI voice chatbot settings
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-8">
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white border-b border-zinc-800 pb-2">
              API Configuration
            </h3>
            <p className="text-sm text-zinc-400">
              API keys are stored securely in Supabase database
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openai-key">OpenAI API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder="sk-proj-..."
                    value={settings.openaiApiKey}
                    onChange={(e) => {
                      setSettings((prev) => ({ ...prev, openaiApiKey: e.target.value }))
                      setTestResults(prev => ({ ...prev, openai: '' }))
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestOpenAI}
                    disabled={!settings.openaiApiKey || isTesting.openai}
                  >
                    {isTesting.openai ? 'Testing...' : 'Test'}
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {testResults.openai === 'success' && (
                    <>
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs text-emerald-500">Connected</span>
                    </>
                  )}
                  {testResults.openai === 'error' && (
                    <>
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-xs text-red-500">Connection failed</span>
                    </>
                  )}
                  {!testResults.openai && (
                    <>
                      <div className="w-2 h-2 rounded-full bg-zinc-600" />
                      <span className="text-xs text-zinc-500">Not tested</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="simli-key">Simli API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="simli-key"
                    type="password"
                    placeholder="simli_..."
                    value={settings.simliApiKey}
                    onChange={(e) => {
                      setSettings((prev) => ({ ...prev, simliApiKey: e.target.value }))
                      setTestResults(prev => ({ ...prev, simli: '' }))
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestSimli}
                    disabled={!settings.simliApiKey || isTesting.simli}
                  >
                    {isTesting.simli ? 'Testing...' : 'Test'}
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {testResults.simli === 'success' && (
                    <>
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs text-emerald-500">Connected</span>
                    </>
                  )}
                  {testResults.simli === 'error' && (
                    <>
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-xs text-red-500">Connection failed</span>
                    </>
                  )}
                  {!testResults.simli && (
                    <>
                      <div className="w-2 h-2 rounded-full bg-zinc-600" />
                      <span className="text-xs text-zinc-500">Not tested</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white border-b border-zinc-800 pb-2">
              Avatar Configuration
            </h3>

            <div className="space-y-2">
              <Label htmlFor="face-id">Simli Face ID</Label>
              <div className="flex gap-2">
                <Input
                  id="face-id"
                  type="text"
                  placeholder="6ebf0aa7-6fed-443d-a4c6-fd1e3080b215"
                  value={settings.simliFaceId}
                  onChange={(e) => {
                    setSettings((prev) => ({ ...prev, simliFaceId: e.target.value }))
                    setTestResults(prev => ({ ...prev, face: '' }))
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestFaceId}
                  disabled={!settings.simliApiKey || !settings.simliFaceId || isTesting.face}
                >
                  {isTesting.face ? 'Testing...' : 'Test'}
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {testResults.face === 'success' && (
                  <>
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-emerald-500">Face ID is valid</span>
                  </>
                )}
                {testResults.face === 'error' && (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs text-red-500">Face ID not found</span>
                  </>
                )}
                {!testResults.face && (
                  <>
                    <div className="w-2 h-2 rounded-full bg-zinc-600" />
                    <span className="text-xs text-zinc-500">Not tested</span>
                  </>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                Enter Simli face ID for your chosen avatar
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white border-b border-zinc-800 pb-2">
              Character Definition
            </h3>

            <div className="space-y-2">
              <Label htmlFor="character-file">Character File</Label>
              <div className="flex gap-2">
                <Input
                  id="character-file"
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="cursor-pointer"
                />
                {settings.characterFile && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleClearFile}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                Upload character file (.txt, max 100KB)
              </p>

              <div className="mt-4 p-3 bg-zinc-800 rounded-md border border-zinc-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-zinc-300">
                    {characterFileName}
                  </span>
                  {settings.characterContent && (
                    <span className="text-xs text-zinc-500">
                      {settings.characterContent.length} characters
                    </span>
                  )}
                </div>
                {settings.characterContent && (
                  <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono mt-2 max-h-32 overflow-y-auto">
                    {getPreviewText()}
                  </pre>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white border-b border-zinc-800 pb-2">
              Audio and Video Settings
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Avatar Delay (seconds)</Label>
                  <span className="text-sm text-zinc-400">{settings.avatarDelay}s</span>
                </div>
                <Slider
                  value={[settings.avatarDelay]}
                  onValueChange={(value) =>
                    setSettings((prev) => ({ ...prev, avatarDelay: value[0] }))
                  }
                  min={0}
                  max={10}
                  step={1}
                />
                <p className="text-xs text-zinc-500">
                  Simli needs 3 second initialization delay
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Output Volume</Label>
                  <span className="text-sm text-zinc-400">{settings.audioVolume}%</span>
                </div>
                <Slider
                  value={[settings.audioVolume]}
                  onValueChange={(value) =>
                    setSettings((prev) => ({ ...prev, audioVolume: value[0] }))
                  }
                  min={0}
                  max={100}
                  step={5}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Mic Sensitivity</Label>
                  <span className="text-sm text-zinc-400">{settings.micSensitivity}%</span>
                </div>
                <Slider
                  value={[settings.micSensitivity]}
                  onValueChange={(value) =>
                    setSettings((prev) => ({ ...prev, micSensitivity: value[0] }))
                  }
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white border-b border-zinc-800 pb-2">
              Display Settings
            </h3>

            <div className="space-y-2">
              <Label>Status Line Mode</Label>
              <RadioGroup
                value={settings.statusLineMode}
                onValueChange={(value: 'basic' | 'detailed' | 'debug') =>
                  setSettings((prev) => ({ ...prev, statusLineMode: value }))
                }
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="basic" id="basic" />
                  <Label htmlFor="basic" className="font-normal cursor-pointer">
                    Basic - Essential info only
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="detailed" id="detailed" />
                  <Label htmlFor="detailed" className="font-normal cursor-pointer">
                    Detailed - Full status information (recommended)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="debug" id="debug" />
                  <Label htmlFor="debug" className="font-normal cursor-pointer">
                    Debug - Technical details for troubleshooting
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </section>

          <div className="flex flex-col gap-3 pt-4 border-t border-zinc-800">
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={isSaving || !settings.openaiApiKey || !settings.simliApiKey}
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button onClick={handleCancel} variant="secondary" className="flex-1">
                Cancel
              </Button>
            </div>
            <Button
              onClick={handleReset}
              variant="destructive"
              size="sm"
              className="w-full"
            >
              Reset to Defaults
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

import { supabase } from '@/lib/supabase'

export interface AppSettings {
  simliFaceId?: string
  avatarDelay?: number
  audioVolume?: number
  micSensitivity?: number
  statusLineMode?: 'basic' | 'detailed' | 'debug'
}

export async function saveApiKey(name: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('api_keys')
    .upsert({
      key_name: name,
      key_value: value
    }, {
      onConflict: 'key_name'
    })

  if (error) {
    throw new Error(`Failed to save API key: ${error.message}`)
  }
}

export async function getApiKey(name: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('key_value')
    .eq('key_name', name)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to get API key: ${error.message}`)
  }

  return data?.key_value || null
}

export async function getAllApiKeys(): Promise<{ [key: string]: string }> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('key_name, key_value')

  if (error) {
    throw new Error(`Failed to get API keys: ${error.message}`)
  }

  const keys: { [key: string]: string } = {}
  data?.forEach(row => {
    keys[row.key_name] = row.key_value
  })

  return keys
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({
      setting_key: key,
      setting_value: value
    }, {
      onConflict: 'setting_key'
    })

  if (error) {
    throw new Error(`Failed to save setting: ${error.message}`)
  }
}

export async function getSetting(key: string): Promise<unknown | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to get setting: ${error.message}`)
  }

  return data?.setting_value || null
}

export async function getAllSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('setting_key, setting_value')

  if (error) {
    throw new Error(`Failed to get settings: ${error.message}`)
  }

  const settings: AppSettings = {}
  data?.forEach(row => {
    settings[row.setting_key as keyof AppSettings] = row.setting_value as any
  })

  return settings
}

export async function saveAllSettings(settings: AppSettings): Promise<void> {
  const settingsArray = Object.entries(settings).map(([key, value]) => ({
    setting_key: key,
    setting_value: value
  }))

  const { error } = await supabase
    .from('app_settings')
    .upsert(settingsArray, {
      onConflict: 'setting_key'
    })

  if (error) {
    throw new Error(`Failed to save settings: ${error.message}`)
  }
}

export async function deleteSetting(key: string): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .delete()
    .eq('setting_key', key)

  if (error) {
    throw new Error(`Failed to delete setting: ${error.message}`)
  }
}

export async function deleteApiKey(name: string): Promise<void> {
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('key_name', name)

  if (error) {
    throw new Error(`Failed to delete API key: ${error.message}`)
  }
}

export async function clearAllSettings(): Promise<void> {
  const { error: settingsError } = await supabase
    .from('app_settings')
    .delete()
    .neq('setting_key', '')

  if (settingsError) {
    throw new Error(`Failed to clear settings: ${settingsError.message}`)
  }

  const { error: keysError } = await supabase
    .from('api_keys')
    .delete()
    .neq('key_name', '')

  if (keysError) {
    throw new Error(`Failed to clear API keys: ${keysError.message}`)
  }
}

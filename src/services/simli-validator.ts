export interface ValidationResult {
  success: boolean
  message: string
  details?: string
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export async function testSimliKey(apiKey: string): Promise<ValidationResult> {
  if (!apiKey || !apiKey.trim()) {
    return {
      success: false,
      message: 'API key is required'
    }
  }

  try {
    const url = `${SUPABASE_URL}/functions/v1/validate-simli-key`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    return result

  } catch (error: any) {
    return {
      success: false,
      message: 'Validation failed',
      details: error?.message || 'Unable to connect to validation service'
    }
  }
}

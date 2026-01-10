import { supabase } from '@/lib/supabase'

export interface CharacterFile {
  id: string
  filename: string
  storage_path: string
  file_size: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const BUCKET_NAME = 'character-files'
const MAX_FILE_SIZE = 100 * 1024 // 100KB

export async function uploadCharacterFile(file: File): Promise<CharacterFile> {
  if (!file.name.endsWith('.txt')) {
    throw new Error('Only .txt files are allowed')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 100KB limit')
  }

  const timestamp = Date.now()
  const storagePath = `${timestamp}-${file.name}`

  const { error: uploadError } = await supabase
    .storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`)
  }

  await deactivateAllFiles()

  const { data, error: dbError } = await supabase
    .from('character_files')
    .insert({
      filename: file.name,
      storage_path: storagePath,
      file_size: file.size,
      is_active: true
    })
    .select()
    .single()

  if (dbError) {
    await supabase.storage.from(BUCKET_NAME).remove([storagePath])
    throw new Error(`Failed to save file metadata: ${dbError.message}`)
  }

  return data
}

export async function getActiveCharacterFile(): Promise<{
  metadata: CharacterFile
  content: string
} | null> {
  const { data: metadata, error: metadataError } = await supabase
    .from('character_files')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()

  if (metadataError) {
    throw new Error(`Failed to get active character file: ${metadataError.message}`)
  }

  if (!metadata) {
    return null
  }

  const { data: fileData, error: downloadError } = await supabase
    .storage
    .from(BUCKET_NAME)
    .download(metadata.storage_path)

  if (downloadError) {
    throw new Error(`Failed to download file: ${downloadError.message}`)
  }

  const content = await fileData.text()

  return {
    metadata,
    content
  }
}

export async function getCharacterFileContent(storagePath: string): Promise<string> {
  const { data, error } = await supabase
    .storage
    .from(BUCKET_NAME)
    .download(storagePath)

  if (error) {
    throw new Error(`Failed to download file: ${error.message}`)
  }

  return await data.text()
}

export async function listCharacterFiles(): Promise<CharacterFile[]> {
  const { data, error } = await supabase
    .from('character_files')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to list character files: ${error.message}`)
  }

  return data || []
}

export async function deleteCharacterFile(id: string): Promise<void> {
  const { data: file, error: fetchError } = await supabase
    .from('character_files')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (fetchError) {
    throw new Error(`Failed to find file: ${fetchError.message}`)
  }

  const { error: storageError } = await supabase
    .storage
    .from(BUCKET_NAME)
    .remove([file.storage_path])

  if (storageError) {
    throw new Error(`Failed to delete file from storage: ${storageError.message}`)
  }

  const { error: dbError } = await supabase
    .from('character_files')
    .delete()
    .eq('id', id)

  if (dbError) {
    throw new Error(`Failed to delete file metadata: ${dbError.message}`)
  }
}

export async function setActiveCharacterFile(id: string): Promise<void> {
  await deactivateAllFiles()

  const { error } = await supabase
    .from('character_files')
    .update({ is_active: true })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to set active file: ${error.message}`)
  }
}

export async function clearActiveCharacterFile(): Promise<void> {
  await deactivateAllFiles()
}

async function deactivateAllFiles(): Promise<void> {
  const { error } = await supabase
    .from('character_files')
    .update({ is_active: false })
    .eq('is_active', true)

  if (error) {
    throw new Error(`Failed to deactivate files: ${error.message}`)
  }
}

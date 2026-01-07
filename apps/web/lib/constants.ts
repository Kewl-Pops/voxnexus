export const APP_NAME = "VoxNexus";
export const APP_DESCRIPTION = "The WordPress for AI Voice Agents";

export const LLM_PROVIDERS = [
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { id: "anthropic", name: "Anthropic", models: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"] },
  { id: "ollama", name: "Ollama", models: ["llama3.2", "mistral", "codellama"] },
] as const;

export const STT_PROVIDERS = [
  { id: "deepgram", name: "Deepgram", models: ["nova-2", "nova", "enhanced"] },
  { id: "whisper", name: "Whisper (OpenAI)", models: ["whisper-1"] },
  { id: "assemblyai", name: "AssemblyAI", models: ["default"] },
] as const;

export const TTS_PROVIDERS = [
  { id: "cartesia", name: "Cartesia", models: ["sonic-english", "sonic-multilingual"] },
  { id: "elevenlabs", name: "ElevenLabs", models: ["eleven_turbo_v2_5", "eleven_multilingual_v2"] },
  { id: "openai", name: "OpenAI TTS", models: ["tts-1", "tts-1-hd"] },
  { id: "kokoro", name: "Kokoro (Local)", models: ["kokoro-82m"] },
] as const;

// Kokoro voice options for local TTS
export const KOKORO_VOICES = [
  { id: "af_bella", name: "Bella", gender: "female", accent: "american" },
  { id: "af_sarah", name: "Sarah", gender: "female", accent: "american" },
  { id: "af_nicole", name: "Nicole", gender: "female", accent: "american" },
  { id: "af_sky", name: "Sky", gender: "female", accent: "american" },
  { id: "am_adam", name: "Adam", gender: "male", accent: "american" },
  { id: "am_michael", name: "Michael", gender: "male", accent: "american" },
  { id: "bf_emma", name: "Emma", gender: "female", accent: "british" },
  { id: "bf_isabella", name: "Isabella", gender: "female", accent: "british" },
  { id: "bm_george", name: "George", gender: "male", accent: "british" },
  { id: "bm_lewis", name: "Lewis", gender: "male", accent: "british" },
] as const;

export const NAV_ITEMS = [
  { name: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { name: "Agents", href: "/agents", icon: "Bot" },
  { name: "Conversations", href: "/conversations", icon: "MessageSquare" },
  { name: "API Keys", href: "/api-keys", icon: "Key" },
  { name: "Settings", href: "/settings", icon: "Settings" },
] as const;

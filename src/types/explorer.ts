export type GeminiModelId = string;

export interface GeminiModelOption {
  id: string;
  label: string;
}

export const RECOMMENDED_GEMINI_MODELS: GeminiModelOption[] = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Recommandé)' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
];

export const RETIRED_GEMINI_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
]);

export interface DatasetResource {
  id: string;
  title: string;
  format: string;
  url: string;
  filesize?: number;
}

export interface DatasetResult {
  id: string;
  title: string;
  description: string;
  uri: string;
  organization?: {
    name: string;
    isPublicService?: boolean;
  };
  formats?: string[];
  resources?: DatasetResource[];
  lastModified?: string;
}

export interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  results?: DatasetResult[];
  followUpSuggestions?: string[];
}

export interface SavedConversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: ConversationMessage[];
  geminiInteractionId?: string | null;
}

export interface AppSettings {
  geminiApiKey: string;
  geminiModel: GeminiModelId;
}

export const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  geminiModel: 'gemini-3.8-flash',
};

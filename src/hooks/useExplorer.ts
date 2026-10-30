import { useState, useEffect, useCallback } from 'react';
import {
  AppSettings,
  ConversationMessage,
  DEFAULT_SETTINGS,
  RETIRED_GEMINI_MODELS,
  SavedConversation,
} from '@/types/explorer';
import {
  buildDirectSynthesis,
  extractFrenchSearchQuery,
  searchDataGouv,
} from '@/services/datagouv';
import { planDataGouvSearch, synthesizeWithGemini } from '@/services/gemini';
import { useToast } from '@/hooks/use-toast';

const SETTINGS_STORAGE_KEY = 'datagouv_explorer_settings_v2';
const CONVERSATIONS_STORAGE_KEY = 'datagouv_explorer_conversations_v2';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadInitialSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const rawModel = parsed.geminiModel?.trim() || DEFAULT_SETTINGS.geminiModel;
    const geminiModel =
      RETIRED_GEMINI_MODELS.has(rawModel) ||
      rawModel.startsWith('gemini-2.') ||
      rawModel.startsWith('gemini-1.')
        ? DEFAULT_SETTINGS.geminiModel
        : rawModel;

    return {
      geminiApiKey:
        parsed.geminiApiKey ?? import.meta.env.VITE_GEMINI_API_KEY ?? '',
      geminiModel,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadInitialConversations(): SavedConversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedConversation[]) : [];
  } catch {
    return [];
  }
}

export function useExplorer() {
  const { toast } = useToast();

  const [settings, setSettings] = useState<AppSettings>(loadInitialSettings);
  const [savedConversations, setSavedConversations] = useState<
    SavedConversation[]
  >(loadInitialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string>(() =>
    generateId()
  );
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [geminiInteractionId, setGeminiInteractionId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(
        CONVERSATIONS_STORAGE_KEY,
        JSON.stringify(savedConversations)
      );
    } catch {
      // ignore
    }
  }, [savedConversations]);

  useEffect(() => {
    if (messages.length === 0) return;

    const firstUserMsg = messages.find((m) => m.type === 'user');
    const title = firstUserMsg
      ? firstUserMsg.content.length > 50
        ? `${firstUserMsg.content.slice(0, 50).trim()}…`
        : firstUserMsg.content
      : 'Nouvelle recherche';

    setSavedConversations((prev) => {
      const entry: SavedConversation = {
        id: activeConversationId,
        title,
        updatedAt: new Date().toISOString(),
        messages,
        geminiInteractionId,
      };
      return [entry, ...prev.filter((c) => c.id !== activeConversationId)].slice(
        0,
        25
      );
    });
  }, [messages, activeConversationId, geminiInteractionId]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(generateId());
    setMessages([]);
    setGeminiInteractionId(null);
  }, []);

  const loadConversation = useCallback((conv: SavedConversation) => {
    setActiveConversationId(conv.id);
    setMessages(conv.messages);
    setGeminiInteractionId(conv.geminiInteractionId || null);
  }, []);

  const deleteConversation = useCallback(
    (convId: string) => {
      setSavedConversations((prev) => prev.filter((c) => c.id !== convId));
      if (convId === activeConversationId) {
        startNewConversation();
      }
    },
    [activeConversationId, startNewConversation]
  );

  const sendMessage = useCallback(
    async (rawInput: string) => {
      const query = rawInput.trim();
      if (!query || isLoading) return;

      const userMessage: ConversationMessage = {
        id: generateId(),
        type: 'user',
        content: query,
        timestamp: new Date().toISOString(),
      };

      const historySnapshot = [...messages];
      const previousDatasets =
        [...messages]
          .reverse()
          .find((m) => m.type === 'assistant' && m.results?.length)?.results ||
        [];

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        if (settings.geminiApiKey.trim()) {
          try {
            const plan = await planDataGouvSearch({
              apiKey: settings.geminiApiKey,
              model: settings.geminiModel,
              userQuestion: query,
              history: historySnapshot,
              hasPreviousDatasets: previousDatasets.length > 0,
            });

            let datasets = previousDatasets;
            let totalAvailable = previousDatasets.length;
            let effectiveQuery = plan.searchQuery;

            if (plan.needsSearch || previousDatasets.length === 0) {
              const searchRes = await searchDataGouv(plan.searchQuery, {
                alternativeQuery: plan.alternativeQuery,
                formatFilter: plan.formatFilter,
                pageSize: 5,
              });
              datasets = searchRes.datasets;
              totalAvailable = searchRes.total;
              effectiveQuery = searchRes.effectiveQuery;
            }

            const synthesis = await synthesizeWithGemini({
              apiKey: settings.geminiApiKey,
              model: settings.geminiModel,
              userQuestion: query,
              searchQueryUsed: effectiveQuery,
              datasets,
              totalAvailable,
              history: historySnapshot,
              previousInteractionId: geminiInteractionId,
            });

            if (synthesis.interactionId) {
              setGeminiInteractionId(synthesis.interactionId);
            }

            setMessages((prev) => [
              ...prev,
              {
                id: generateId(),
                type: 'assistant',
                content: synthesis.answer,
                timestamp: new Date().toISOString(),
                results: datasets,
                followUpSuggestions: synthesis.followUpSuggestions,
              },
            ]);
            return;
          } catch (geminiError) {
            toast({
              title: 'Gemini indisponible — recherche directe utilisée',
              description:
                geminiError instanceof Error
                  ? geminiError.message
                  : 'Vérifiez votre clé API Gemini.',
              variant: 'destructive',
            });
          }
        }

        // Mode sans clé (ou repli) : recherche directe data.gouv.fr
        const extractedQuery = extractFrenchSearchQuery(query);
        const searchRes = await searchDataGouv(extractedQuery, { pageSize: 5 });
        const direct = buildDirectSynthesis(
          searchRes.effectiveQuery,
          searchRes.datasets,
          searchRes.total,
          searchRes.isDemoFallback
        );

        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            type: 'assistant',
            content: direct.answer,
            timestamp: new Date().toISOString(),
            results: searchRes.datasets,
            followUpSuggestions: direct.followUpSuggestions,
          },
        ]);
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : 'Erreur inattendue.';
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            type: 'assistant',
            content: `Désolé, une erreur est survenue : ${msg}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, settings, geminiInteractionId, toast]
  );

  return {
    settings,
    updateSettings,
    savedConversations,
    activeConversationId,
    messages,
    isLoading,
    sendMessage,
    startNewConversation,
    loadConversation,
    deleteConversation,
  };
}

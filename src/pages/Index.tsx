import React, { useState, useRef, useEffect } from 'react';
import {
  Database,
  History,
  Plus,
  Send,
  Settings,
  Sun,
  Moon,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useExplorer } from '@/hooks/useExplorer';
import { DatasetResult } from '@/types/explorer';
import { ChatMessage } from '@/components/explorer/ChatMessage';
import { DatasetModal } from '@/components/explorer/DatasetModal';
import { SettingsModal } from '@/components/explorer/SettingsModal';

const EXAMPLES = [
  'Prix des ventes immobilières par commune (DVF)',
  'Bornes de recharge pour véhicules électriques (IRVE)',
  'Collecte et recyclage des déchets ménagers',
  'Horaires et ponctualité des trains SNCF',
];

const Index: React.FC = () => {
  const {
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
  } = useExplorer();

  const { theme, setTheme } = useTheme();
  const [inputValue, setInputValue] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inspectedDataset, setInspectedDataset] =
    useState<DatasetResult | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasGeminiKey = Boolean(settings.geminiApiKey.trim());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    const text = inputValue.trim();
    setInputValue('');
    sendMessage(text);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* En-tête épuré */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHistoryOpen(true)}
              title="Historique"
            >
              <History className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>DataGouv Explorer</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={startNewConversation}
                className="h-8 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Nouveau
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Thème clair / sombre"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="h-8 text-xs gap-1.5"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  hasGeminiKey ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
              />
              <span>Gemini</span>
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </header>

      {/* Zone centrale unique et aérée */}
      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
            <div className="h-11 w-11 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <Database className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Explorez les données publiques françaises
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Recherchez en langage naturel dans le catalogue officiel{' '}
              <strong>data.gouv.fr</strong>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl mt-8">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => sendMessage(example)}
                  disabled={isLoading}
                  className="text-left text-xs rounded-xl border bg-card hover:bg-muted/60 px-3.5 py-3 text-muted-foreground hover:text-foreground transition"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 py-6 space-y-8">
            {messages.map((msg, idx) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isLast={idx === messages.length - 1}
                isLoading={isLoading}
                onInspectDataset={setInspectedDataset}
                onFollowUp={sendMessage}
              />
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                <span>Recherche sur data.gouv.fr…</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {/* Barre de saisie fixe en bas */}
        <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pt-3 pb-5">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 rounded-2xl border bg-card p-1.5 shadow-sm focus-within:ring-1 focus-within:ring-ring"
          >
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Posez une question sur les jeux de données publics…"
              disabled={isLoading}
              className="border-0 shadow-none focus-visible:ring-0 bg-transparent text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !inputValue.trim()}
              className="h-9 w-9 rounded-xl shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </main>

      {/* Tiroir latéral discret pour l'historique */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-72 p-4 flex flex-col">
          <SheetHeader className="text-left pb-2 border-b">
            <SheetTitle className="text-sm">Historique</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto space-y-1 py-2">
            {savedConversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Aucune recherche récente.
              </p>
            ) : (
              savedConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => {
                    loadConversation(conv);
                    setHistoryOpen(false);
                  }}
                  className={`group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs cursor-pointer transition ${
                    conv.id === activeConversationId
                      ? 'bg-muted font-medium'
                      : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="truncate">{conv.title}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition shrink-0"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <DatasetModal
        dataset={inspectedDataset}
        onClose={() => setInspectedDataset(null)}
      />

      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onUpdateSettings={updateSettings}
      />
    </div>
  );
};

export default Index;

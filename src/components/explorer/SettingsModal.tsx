import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AppSettings,
  GeminiModelOption,
  RECOMMENDED_GEMINI_MODELS,
} from '@/types/explorer';
import {
  fetchAvailableGeminiModels,
  testGeminiConnection,
} from '@/services/gemini';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onOpenChange,
  settings,
  onUpdateSettings,
}) => {
  const [testing, setTesting] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [dynamicModels, setDynamicModels] = useState<GeminiModelOption[]>([]);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const modelOptions = useMemo(() => {
    const map = new Map<string, GeminiModelOption>();
    for (const m of RECOMMENDED_GEMINI_MODELS) map.set(m.id, m);
    for (const m of dynamicModels) {
      if (!map.has(m.id)) map.set(m.id, m);
    }
    if (settings.geminiModel && !map.has(settings.geminiModel)) {
      map.set(settings.geminiModel, {
        id: settings.geminiModel,
        label: settings.geminiModel,
      });
    }
    return Array.from(map.values());
  }, [dynamicModels, settings.geminiModel]);

  const handleRefreshModels = async () => {
    if (!settings.geminiApiKey.trim()) return;
    setLoadingModels(true);
    setFeedback(null);
    try {
      const models = await fetchAvailableGeminiModels(settings.geminiApiKey);
      setDynamicModels(models);
      setFeedback({
        ok: true,
        message: `${models.length} modèles chargés depuis votre clé.`,
      });
    } catch (err) {
      setFeedback({
        ok: false,
        message: err instanceof Error ? err.message : 'Erreur de chargement.',
      });
    } finally {
      setLoadingModels(false);
    }
  };

  const handleTest = async () => {
    if (!settings.geminiApiKey.trim()) return;
    setTesting(true);
    setFeedback(null);
    const res = await testGeminiConnection(
      settings.geminiApiKey,
      settings.geminiModel
    );
    setFeedback(res);
    setTesting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Paramètres Gemini</DialogTitle>
          <DialogDescription>
            Ajoutez une clé API pour activer l'analyse IA. Sans clé, l'application
            effectue une recherche directe sur data.gouv.fr.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="gemini-key" className="font-medium">
                Clé API Google Gemini
              </label>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                Obtenir une clé
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex gap-2">
              <Input
                id="gemini-key"
                type="password"
                placeholder="AIzaSy..."
                value={settings.geminiApiKey}
                onChange={(e) => {
                  setFeedback(null);
                  onUpdateSettings({ geminiApiKey: e.target.value });
                }}
              />
              {settings.geminiApiKey && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setFeedback(null);
                    onUpdateSettings({ geminiApiKey: '' });
                  }}
                  title="Effacer la clé"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="gemini-model" className="font-medium">
                Modèle
              </label>
              {settings.geminiApiKey.trim() && (
                <button
                  type="button"
                  onClick={handleRefreshModels}
                  disabled={loadingModels}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${loadingModels ? 'animate-spin' : ''}`}
                  />
                  Actualiser
                </button>
              )}
            </div>
            <Select
              value={settings.geminiModel}
              onValueChange={(val) => {
                setFeedback(null);
                onUpdateSettings({ geminiModel: val });
              }}
            >
              <SelectTrigger id="gemini-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {feedback && (
            <div
              className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${
                feedback.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                  : 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200'
              }`}
            >
              {feedback.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing || !settings.geminiApiKey.trim()}
          >
            {testing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Tester la clé
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


import React from 'react';
import { Database, ExternalLink, ArrowRight } from 'lucide-react';
import { ConversationMessage, DatasetResult } from '@/types/explorer';
import { MarkdownContent } from './MarkdownContent';

interface ChatMessageProps {
  message: ConversationMessage;
  isLast: boolean;
  isLoading: boolean;
  onInspectDataset: (dataset: DatasetResult) => void;
  onFollowUp: (prompt: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isLast,
  isLoading,
  onInspectDataset,
  onFollowUp,
}) => {
  if (message.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  const datasets = message.results?.slice(0, 4) || [];

  return (
    <div className="space-y-3">
      <div className="text-foreground">
        <MarkdownContent content={message.content} />
      </div>

      {/* Sources compactes intégrées directement sous la réponse */}
      {datasets.length > 0 && (
        <div className="pt-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Database className="h-3.5 w-3.5" />
            <span>Sources data.gouv.fr ({datasets.length})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {datasets.map((ds) => (
              <div
                key={ds.id}
                onClick={() => onInspectDataset(ds)}
                className="group flex flex-col justify-between rounded-xl border bg-card hover:border-foreground/25 p-3 cursor-pointer transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-medium leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {ds.title}
                    </h4>
                    <a
                      href={ds.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                      title="Ouvrir sur data.gouv.fr"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  {ds.organization && (
                    <p className="text-[11px] text-muted-foreground truncate mt-1">
                      {ds.organization.name}
                    </p>
                  )}
                </div>

                {ds.formats && ds.formats.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {ds.formats.slice(0, 3).map((fmt) => (
                      <span
                        key={fmt}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                      >
                        {fmt}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions de relance discrètes */}
      {isLast &&
        !isLoading &&
        message.followUpSuggestions &&
        message.followUpSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {message.followUpSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onFollowUp(suggestion)}
                className="text-xs rounded-full border bg-background hover:bg-muted px-3 py-1 text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1"
              >
                <span>{suggestion}</span>
                <ArrowRight className="h-3 w-3 opacity-60" />
              </button>
            ))}
          </div>
        )}
    </div>
  );
};


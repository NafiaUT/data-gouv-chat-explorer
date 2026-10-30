import React from 'react';
import { ExternalLink, Download, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatasetResult } from '@/types/explorer';

interface DatasetModalProps {
  dataset: DatasetResult | null;
  onClose: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(val >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export const DatasetModal: React.FC<DatasetModalProps> = ({
  dataset,
  onClose,
}) => {
  if (!dataset) return null;

  return (
    <Dialog open={Boolean(dataset)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[580px] max-h-[82vh] flex flex-col">
        <DialogHeader className="space-y-1.5 pr-4">
          {dataset.organization && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">{dataset.organization.name}</span>
              {dataset.organization.isPublicService && (
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              )}
            </div>
          )}
          <DialogTitle className="text-base leading-snug">
            {dataset.title}
          </DialogTitle>
          {dataset.lastModified && (
            <DialogDescription className="text-xs">
              Mis à jour le{' '}
              {new Date(dataset.lastModified).toLocaleDateString('fr-FR')}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
            {dataset.description}
          </p>

          {dataset.resources && dataset.resources.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium text-foreground">
                Fichiers disponibles ({dataset.resources.length})
              </h4>
              <div className="divide-y rounded-lg border">
                {dataset.resources.map((res) => (
                  <div
                    key={res.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 font-mono shrink-0"
                      >
                        {res.format}
                      </Badge>
                      <span className="truncate">{res.title}</span>
                      {res.filesize ? (
                        <span className="text-muted-foreground shrink-0">
                          ({formatBytes(res.filesize)})
                        </span>
                      ) : null}
                    </div>
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Ouvrir
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fermer
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <a href={dataset.uri} target="_blank" rel="noopener noreferrer">
              Voir sur data.gouv.fr
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};


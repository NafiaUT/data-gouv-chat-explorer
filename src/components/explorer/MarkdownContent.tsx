import React from 'react';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Rendu Markdown léger et sécurisé (sans injection HTML brute) pour les réponses de l'assistant :
 * supporte les titres, listes à puces/numérotées, citations, gras, italique, code inline et liens externes.
 */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Capture liens [label](url), code `...`, gras **...**, italique *...*
  const tokenRegex =
    /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Lien [label](url)
      nodes.push(
        <a
          key={`link-${key++}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300 transition-colors break-words"
        >
          {match[2]}
        </a>
      );
    } else if (match[4]) {
      // Code inline
      nodes.push(
        <code
          key={`code-${key++}`}
          className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100"
        >
          {match[5]}
        </code>
      );
    } else if (match[6]) {
      // Gras
      nodes.push(
        <strong key={`bold-${key++}`} className="font-semibold text-foreground">
          {match[7]}
        </strong>
      );
    } else if (match[8]) {
      // Italique
      nodes.push(
        <em key={`italic-${key++}`} className="italic">
          {match[9]}
        </em>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  className = '',
}) => {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: { ordered: boolean; content: string }[] = [];
  let blockKey = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const isOrdered = listItems[0].ordered;
    const ListTag = isOrdered ? 'ol' : 'ul';
    blocks.push(
      <ListTag
        key={`list-${blockKey++}`}
        className={`my-2 space-y-1.5 pl-5 ${
          isOrdered ? 'list-decimal' : 'list-disc'
        }`}
      >
        {listItems.map((item, idx) => (
          <li key={idx} className="leading-relaxed">
            {renderInline(item.content)}
          </li>
        ))}
      </ListTag>
    );
    listItems = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    // Titres ### / ## / #
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const headingClasses =
        level === 1
          ? 'text-base font-bold mt-3 mb-1.5'
          : level === 2
          ? 'text-sm font-bold mt-3 mb-1'
          : 'text-sm font-semibold mt-2.5 mb-1';
      blocks.push(
        <div key={`h-${blockKey++}`} className={headingClasses}>
          {renderInline(text)}
        </div>
      );
      continue;
    }

    // Citation >
    if (trimmed.startsWith('>')) {
      flushList();
      const quoteText = trimmed.replace(/^>\s*/, '');
      blocks.push(
        <blockquote
          key={`q-${blockKey++}`}
          className="my-2 border-l-4 border-blue-500/70 bg-blue-50/70 dark:bg-blue-950/30 pl-3 py-1.5 pr-2 rounded-r text-xs leading-relaxed"
        >
          {renderInline(quoteText)}
        </blockquote>
      );
      continue;
    }

    // Liste à puces (- ou *)
    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (listItems.length > 0 && listItems[0].ordered) {
        flushList();
      }
      listItems.push({ ordered: false, content: ulMatch[1] });
      continue;
    }

    // Liste numérotée (1. ...)
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (listItems.length > 0 && !listItems[0].ordered) {
        flushList();
      }
      listItems.push({ ordered: true, content: olMatch[1] });
      continue;
    }

    flushList();
    blocks.push(
      <p key={`p-${blockKey++}`} className="my-1.5 leading-relaxed">
        {renderInline(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className={`text-sm ${className}`}>{blocks}</div>;
};

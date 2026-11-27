import { Fragment, type ReactNode } from 'react';

// Rendu Markdown minimal et sûr pour les réponses de l'assistant : blocs de code, listes, `code` et **gras**.
// Tout passe par des éléments React (jamais de HTML brut), donc rien de ce que renvoie le modèle ne peut injecter de balise.

function inline(text: string, onCite?: (page: number) => void): ReactNode[] {
  const cite = /^\[p\.\s*(\d+)(?:\s*[-–]\s*(\d+))?\]$/;
  return text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*|\[p\.\s*\d+(?:\s*[-–]\s*\d+)?\])/g).map((part, i) => {
    const c = onCite ? cite.exec(part) : null;
    if (c) {
      return (
        <button key={i} type="button" onClick={() => onCite?.(Number(c[1]))} title="Voir cette diapositive du cours" className="mx-0.5 inline-flex items-center rounded-full bg-brand-light px-2 py-0.5 align-baseline text-[11px] font-semibold text-brand hover:bg-brand hover:text-white">
          p. {c[1]}{c[2] ? `–${c[2]}` : ''}
        </button>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="rounded bg-slate-200 px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

type Block = { kind: 'code'; lang: string; code: string } | { kind: 'list'; ordered: boolean; items: string[] } | { kind: 'p'; text: string };

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^```\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++; // fermeture (ou fin du texte si le bloc n'est pas fermé)
      blocks.push({ kind: 'code', lang: fence[1], code: code.join('\n') });
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const items: string[] = [];
      while (i < lines.length) {
        const m = ordered ? /^\s*\d+[.)]\s+(.*)$/.exec(lines[i]) : /^\s*[-*]\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^```/.test(lines[i]) && !/^\s*([-*]|\d+[.)])\s+/.test(lines[i])) para.push(lines[i++]);
    blocks.push({ kind: 'p', text: para.join('\n') });
  }
  return blocks;
}

export default function Markdown({ text, onCite }: { text: string; onCite?: (page: number) => void }) {
  return (
    <div className="space-y-2 text-sm leading-6">
      {parse(text).map((b, i) => {
        if (b.kind === 'code') {
          return (
            <pre key={i} className="overflow-x-auto rounded-md bg-[#1b2238] p-3 font-mono text-xs leading-5 text-slate-100">
              <code>{b.code}</code>
            </pre>
          );
        }
        if (b.kind === 'list') {
          const Tag = b.ordered ? 'ol' : 'ul';
          return (
            <Tag key={i} className={`space-y-1 pl-5 ${b.ordered ? 'list-decimal' : 'list-disc'}`}>
              {b.items.map((it, j) => (
                <li key={j}>{inline(it, onCite)}</li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {inline(b.text, onCite)}
          </p>
        );
      })}
    </div>
  );
}

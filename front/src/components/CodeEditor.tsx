import { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { indentWithTab } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { python } from '@codemirror/lang-python';
import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { indentUnit, StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap, placeholder as placeholderExt } from '@codemirror/view';

export type CodeLanguage = 'sql' | 'python' | 'html' | 'shell' | 'text';

/** Langage de l'éditeur selon la matière du défi. */
export function languageForSubject(subject: string): CodeLanguage {
  switch (subject) {
    case 'Bases de données':
      return 'sql';
    case 'Algorithmique':
      return 'python';
    case 'Développement web':
      return 'html';
    case 'Réseaux & systèmes':
      return 'shell';
    default:
      return 'text';
  }
}

/** Tables du défi, pour proposer leurs noms et colonnes pendant la saisie SQL. */
export type SqlSchema = Record<string, string[]>;

function languageExtension(lang: CodeLanguage, schema?: SqlSchema): Extension {
  switch (lang) {
    case 'sql':
      return sql({ dialect: PostgreSQL, schema, upperCaseKeywords: true });
    case 'python':
      return python();
    case 'html':
      return html(); // HTML avec le CSS et le JavaScript intégrés
    case 'shell':
      return StreamLanguage.define(shell);
    default:
      return [];
  }
}

const theme = EditorView.theme({
  '&': { fontSize: '13px', backgroundColor: '#1b2238', borderRadius: '0.375rem', height: '100%' },
  '&.cm-focused': { outline: '2px solid #f28c1b' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.6' },
  '.cm-gutters': { backgroundColor: '#161c2e', borderRight: '1px solid #2a3350', borderRadius: '0.375rem 0 0 0.375rem' },
  '.cm-content': { padding: '12px 0' },
});

/**
 * Éditeur de code façon IDE : coloration, numéros de ligne, Tab pour indenter,
 * parenthèses appariées, complétion (mots-clés, et tables/colonnes en SQL), annuler/rétablir.
 * Échap puis Tab permet de sortir de l'éditeur au clavier.
 */
export default function CodeEditor({
  value,
  onChange,
  language,
  schema,
  disabled = false,
  minHeight = '12rem',
  placeholder,
  onSubmit,
  id,
  ariaLabel = 'Éditeur de code',
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  language: CodeLanguage;
  schema?: SqlSchema;
  disabled?: boolean;
  minHeight?: string;
  placeholder?: string;
  /** Ctrl+Entrée (ou Cmd+Entrée). */
  onSubmit?: () => void;
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const langSlot = useRef(new Compartment());
  const lockSlot = useRef(new Compartment());
  // Les rappels changent à chaque rendu : on garde toujours la dernière version.
  const latest = useRef({ onChange, onSubmit });
  latest.current = { onChange, onSubmit };

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          // Prioritaires sur les raccourcis par défaut (Ctrl+Entrée y insère une ligne vide).
          Prec.highest(
            keymap.of([
              { key: 'Mod-Enter', run: () => (latest.current.onSubmit ? (latest.current.onSubmit(), true) : false) },
              indentWithTab,
            ]),
          ),
          basicSetup,
          indentUnit.of(language === 'python' ? '    ' : '  '),
          langSlot.current.of(languageExtension(language, schema)),
          lockSlot.current.of([EditorState.readOnly.of(disabled), EditorView.editable.of(!disabled)]),
          theme, // avant oneDark : le premier thème listé l'emporte (fond bleu nuit du site)
          oneDark,
          EditorView.theme({ '.cm-content, .cm-gutter': { minHeight } }),
          EditorView.contentAttributes.of({ 'aria-label': ariaLabel, ...(id ? { id } : {}) }),
          placeholder ? placeholderExt(placeholder) : [],
          EditorView.updateListener.of((u) => {
            if (u.docChanged) latest.current.onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // L'éditeur est créé une seule fois ; les changements suivants passent par les effets ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Texte remplacé de l'extérieur (réinitialisation, autre défi…).
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: langSlot.current.reconfigure(languageExtension(language, schema)) });
  }, [language, schema]);

  useEffect(() => {
    view.current?.dispatch({
      effects: lockSlot.current.reconfigure([EditorState.readOnly.of(disabled), EditorView.editable.of(!disabled)]),
    });
  }, [disabled]);

  return <div ref={host} className={`overflow-hidden rounded-md ${disabled ? 'opacity-60' : ''} ${className}`} />;
}

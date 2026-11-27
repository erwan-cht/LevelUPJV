import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { BookOpen, Bot, RotateCcw, Send } from 'lucide-react';
import { api, useApi } from '../api';
import CoursePanel, { type CourseInfo } from '../components/CoursePanel';
import Markdown from '../components/Markdown';
import { Breadcrumb, PageTitle } from '../components/ui';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'levelupjv-assistant';
const SUGGESTIONS = [
  'Quelle est la différence entre une jointure et un produit cartésien ?',
  'Explique-moi GROUP BY et les fonctions d’agrégat avec un exemple.',
  'C’est quoi une clé primaire et une clé étrangère ?',
  'Comment fonctionne la différence entre UNION, INTERSECT et EXCEPT ?',
];

/** Conversation gardée dans l'onglet (sessionStorage) : elle survit à un changement de page, pas à la fermeture. */
function load(): Message[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string') : [];
  } catch {
    return [];
  }
}

/** Chat direct pour poser ses questions sur les enseignements. */
export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>(load);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const courseList = useApi<{ items: CourseInfo[] }>('/courses');
  const course = courseList.data?.items[0] ?? null;
  const [page, setPage] = useState<number | null>(null); // diapositive affichée à côté du chat

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* stockage indisponible : la conversation reste en mémoire */
    }
    end.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'end' });
  }, [messages, busy]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const next: Message[] = [...messages, { role: 'user', content: question }];
    setMessages(next);
    setInput('');
    setError('');
    setBusy(true);
    try {
      const res = await api<{ text: string }>('/chat', { body: { messages: next.slice(-16), course: course?.id } });
      setMessages([...next, { role: 'assistant', content: res.text }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'L’assistant est indisponible.');
      setInput(question); // on rend la question pour pouvoir réessayer
      setMessages(messages);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Assistant de cours' }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title="Assistant de cours" subtitle="Pose tes questions sur SQL, l’algo, le web, les réseaux… et fais-toi expliquer ce qui coince." />
        {messages.length > 0 && (
          <button
            onClick={() => {
              setMessages([]);
              setError('');
            }}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Nouvelle conversation
          </button>
        )}
      </div>

      {course && (
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1 font-semibold text-brand">
            <BookOpen className="h-3.5 w-3.5" /> Ancré sur le cours
          </span>
          <span className="text-muted">
            {course.title} · {course.author} · {course.pages} pages
          </span>
          <button onClick={() => setPage((p) => p ?? 1)} className="font-semibold text-brand hover:underline">
            Ouvrir le cours
          </button>
        </p>
      )}

      <div className={page !== null && course ? 'grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,42%)]' : ''}>
      <section className="flex h-[65vh] min-h-[420px] flex-col overflow-hidden rounded-lg border border-navy bg-white">
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.length === 0 && (
            <div className="mx-auto max-w-xl space-y-4 pt-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-navy text-white">
                <Bot className="h-6 w-6" />
              </span>
              <p className="text-sm text-muted">Une notion pas claire ? Écris ta question, ou commence par une de celles-ci.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => void send(s)} className="rounded-full border border-slate-300 bg-panel px-3 py-1.5 text-left text-xs hover:border-brand">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-navy px-4 py-2 text-sm text-white">{m.content}</p>
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="min-w-0 max-w-[90%] rounded-2xl rounded-tl-sm bg-panel px-4 py-3">
                  <Markdown text={m.content} onCite={course ? (n) => setPage(n) : undefined} />
                </div>
              </div>
            ),
          )}

          {busy && (
            <div className="flex gap-3" role="status">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                <Bot className="h-4 w-4" />
              </span>
              <p className="rounded-2xl rounded-tl-sm bg-panel px-4 py-3 text-sm text-muted">L’assistant réfléchit…</p>
            </div>
          )}
          <div ref={end} />
        </div>

        {error && (
          <p role="alert" className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3">
          <label htmlFor="question" className="sr-only">
            Ta question
          </label>
          <textarea
            id="question"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={2}
            maxLength={2000}
            placeholder="Pose ta question… (Entrée pour envoyer, Maj + Entrée pour un retour à la ligne)"
            className="min-h-[2.75rem] flex-1 resize-none rounded-md border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button type="submit" disabled={busy || !input.trim()} className="inline-flex h-11 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50">
            <Send className="h-4 w-4" /> Envoyer
          </button>
        </form>
      </section>

      {page !== null && course && (
        <CoursePanel
          course={course}
          page={page}
          onPage={setPage}
          onClose={() => setPage(null)}
          onExplain={(n) => void send(`Explique-moi la diapositive p. ${n} du cours, simplement et avec un exemple.`)}
        />
      )}
      </div>

      <p className="text-xs italic text-muted">
        Réponses générées par une IA : elles peuvent contenir des erreurs, vérifie avec ton cours. L’assistant n’a pas accès aux supports de tes enseignants.
      </p>
    </div>
  );
}

import { useState } from 'react';
import { BookOpen, CheckCircle2, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, useApi } from '../api';
import CourseDrawer from '../components/CourseDrawer';
import type { CourseInfo } from '../components/CoursePanel';
import { useMe } from '../me';
import { Breadcrumb, PageTitle } from '../components/ui';

interface Section {
  id: string;
  label: string;
  from: number;
  to: number;
}

interface Sections {
  course: CourseInfo | null;
  items: Section[];
  dailyCap: number;
  pointsPerAnswer: number;
}

interface Quiz {
  id: string;
  questions: { question: string; choices: string[] }[];
}

interface Verdict {
  correct: boolean;
  choice: number;
  answerIndex: number;
  explanation: string;
  page: number;
  pointsAwarded: number;
}

const COUNTS = [5, 8, 10];
const LETTERS = ['A', 'B', 'C', 'D'];

/** Quiz de révision : des QCM fabriqués à partir du cours, corrigés avec renvoi à la diapositive. */
export default function QuizPage() {
  const sections = useApi<Sections>('/quiz/sections');
  const { refreshMe } = useMe();
  const navigate = useNavigate();

  const [sectionId, setSectionId] = useState('all');
  const [count, setCount] = useState(5);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<number | null>(null); // page du cours ouverte en tiroir

  const course = sections.data?.course ?? null;

  const start = async () => {
    if (!course) return;
    const s = sections.data?.items.find((x) => x.id === sectionId);
    setBusy(true);
    setError('');
    try {
      const q = await api<Quiz>('/quiz', { body: { course: course.id, from: s?.from ?? 1, to: s?.to ?? course.pages, count } });
      setQuiz(q);
      setVerdicts([]);
      setCurrent(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de créer le quiz.');
    } finally {
      setBusy(false);
    }
  };

  const answer = async (choice: number) => {
    if (!quiz || verdicts[current] || busy) return;
    setBusy(true);
    setError('');
    try {
      const v = await api<Verdict>(`/quiz/${quiz.id}/answer`, { body: { question: current, choice } });
      setVerdicts((list) => {
        const next = [...list];
        next[current] = v;
        return next;
      });
      if (v.pointsAwarded > 0) refreshMe();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Réponse non enregistrée.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setQuiz(null);
    setVerdicts([]);
    setCurrent(0);
    setError('');
  };

  const done = quiz !== null && verdicts.length === quiz.questions.length && verdicts.every(Boolean) && current >= quiz.questions.length;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Quiz de révision' }]} />
      <PageTitle title="Quiz de révision" subtitle="Des questions fabriquées à partir de ton cours, avec la diapositive à relire quand tu te trompes." />

      {sections.loading && <p role="status" className="rounded-lg bg-panel p-6 text-center text-sm text-muted">Chargement…</p>}
      {!sections.loading && !course && (
        <p className="rounded-lg bg-panel p-6 text-center text-sm text-muted">Aucun cours n’est disponible pour le moment.</p>
      )}

      {course && !quiz && (
        <section className="space-y-5 rounded-lg border border-navy bg-white p-5">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
              <BookOpen className="h-3.5 w-3.5" /> {course.title}
            </span>
            <span className="text-xs text-muted">{course.author}</span>
          </p>

          <div>
            <label htmlFor="chapitre" className="mb-1 block text-sm font-semibold">
              Chapitre
            </label>
            <select id="chapitre" value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm">
              <option value="all">Tout le cours</option>
              {sections.data?.items.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} (p. {s.from}
                  {s.to > s.from ? `–${s.to}` : ''})
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="mb-1 text-sm font-semibold">Nombre de questions</legend>
            <div className="flex gap-2">
              {COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  aria-pressed={count === n}
                  className={`rounded-md border px-4 py-1.5 text-sm font-semibold ${count === n ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={start} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? 'Fabrication du quiz…' : 'Lancer le quiz'}
            </button>
            <span className="text-xs text-muted">
              +{sections.data?.pointsPerAnswer} pts par bonne réponse (jusqu’à {sections.data?.dailyCap} pts par jour)
            </span>
          </div>
        </section>
      )}

      {course && quiz && !done && (
        <section className="space-y-5 rounded-lg border border-navy bg-white p-5">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold">
              <span>
                Question {current + 1} / {quiz.questions.length}
              </span>
              <span className="text-muted">{verdicts.filter((v) => v?.correct).length} bonne(s) réponse(s)</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={current} aria-valuemax={quiz.questions.length}>
              <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${(current / quiz.questions.length) * 100}%` }} />
            </div>
          </div>

          <div key={current} className="viz-row space-y-4">
            <h2 className="text-lg font-semibold">{quiz.questions[current].question}</h2>
            <ul className="space-y-2">
              {quiz.questions[current].choices.map((c, i) => {
                const v = verdicts[current];
                const isAnswer = v && i === v.answerIndex;
                const isWrong = v && i === v.choice && !v.correct;
                return (
                  <li key={i}>
                    <button
                      onClick={() => answer(i)}
                      disabled={Boolean(v) || busy}
                      className={`flex w-full items-start gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm transition-colors ${
                        isAnswer ? 'border-green-600 bg-green-50' : isWrong ? 'border-red-500 bg-red-50' : v ? 'border-slate-200 opacity-60' : 'border-slate-200 hover:border-brand'
                      }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isAnswer ? 'bg-green-600 text-white' : isWrong ? 'bg-red-500 text-white' : 'bg-slate-200'}`}>
                        {isAnswer ? <CheckCircle2 className="h-4 w-4" /> : isWrong ? <XCircle className="h-4 w-4" /> : LETTERS[i]}
                      </span>
                      <span className="pt-0.5">{c}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {verdicts[current] && (
              <div role="status" className={`viz-row rounded-lg p-4 text-sm ${verdicts[current].correct ? 'bg-green-100 text-green-900' : 'bg-red-50 text-red-900'}`}>
                <p className="font-semibold">
                  {verdicts[current].correct ? 'Bonne réponse !' : 'Pas tout à fait.'}
                  {verdicts[current].pointsAwarded > 0 && <span className="ml-2 rounded-full bg-white/70 px-2 py-0.5 text-xs">+{verdicts[current].pointsAwarded} pts</span>}
                </p>
                {verdicts[current].explanation && <p className="mt-1">{verdicts[current].explanation}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button onClick={() => setView(verdicts[current].page)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-navy shadow-sm hover:bg-brand hover:text-white">
                    <BookOpen className="h-3.5 w-3.5" /> Voir la diapo p. {verdicts[current].page}
                  </button>
                  <button onClick={() => setCurrent((n) => n + 1)} className="rounded-md bg-navy px-4 py-1.5 text-xs font-semibold text-white">
                    {current + 1 < quiz.questions.length ? 'Question suivante' : 'Voir mon résultat'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </section>
      )}

      {course && quiz && done && <Result quiz={quiz} verdicts={verdicts} onOpen={setView} onAgain={reset} />}

      {view !== null && course && (
        <CourseDrawer
          course={course}
          page={view}
          onPage={setView}
          onClose={() => setView(null)}
          onExplain={(n) => navigate('/assistant', { state: { ask: `Explique-moi la diapositive p. ${n} du cours, simplement et avec un exemple.` } })}
        />
      )}
    </div>
  );
}

function Result({ quiz, verdicts, onOpen, onAgain }: { quiz: Quiz; verdicts: Verdict[]; onOpen: (page: number) => void; onAgain: () => void }) {
  const good = verdicts.filter((v) => v.correct).length;
  const total = quiz.questions.length;
  const points = verdicts.reduce((n, v) => n + v.pointsAwarded, 0);
  const wrong = quiz.questions.map((q, i) => ({ q, v: verdicts[i], i })).filter((x) => !x.v.correct);
  const pages = [...new Set(wrong.map((x) => x.v.page))].sort((a, b) => a - b);
  const ratio = good / total;

  return (
    <section className="viz-row space-y-5 rounded-lg border border-navy bg-white p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className={`flex h-16 w-16 items-center justify-center rounded-full text-white ${ratio >= 0.8 ? 'bg-green-600' : ratio >= 0.5 ? 'bg-brand' : 'bg-slate-500'}`}>
          <Trophy className="h-8 w-8" />
        </span>
        <div>
          <p className="text-3xl font-semibold">
            {good} / {total}
          </p>
          <p className="text-sm text-muted">
            {ratio === 1 ? 'Sans faute, bravo !' : ratio >= 0.8 ? 'Très bien, tu maîtrises ce chapitre.' : ratio >= 0.5 ? 'Pas mal, quelques points à revoir.' : 'À retravailler : relis les diapos ci-dessous.'}
            {points > 0 && <span className="ml-2 rounded-full bg-brand-light px-2 py-0.5 text-xs font-semibold text-brand">+{points} pts</span>}
          </p>
        </div>
      </div>

      {wrong.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">À revoir</p>
          <ul className="space-y-2">
            {wrong.map(({ q, v, i }) => (
              <li key={i} className="rounded-md bg-panel p-3 text-sm">
                <p className="font-medium">{q.question}</p>
                <p className="mt-1 text-xs text-muted">
                  Bonne réponse : <span className="font-semibold text-navy">{q.choices[v.answerIndex]}</span>
                </p>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-muted">Diapos à relire :</span>
            {pages.map((n) => (
              <button key={n} onClick={() => onOpen(n)} className="rounded-full bg-brand-light px-2.5 py-0.5 font-semibold text-brand hover:bg-brand hover:text-white">
                p. {n}
              </button>
            ))}
          </p>
        </div>
      )}

      <button onClick={onAgain} className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
        <RotateCcw className="h-4 w-4" /> Faire un autre quiz
      </button>
    </section>
  );
}

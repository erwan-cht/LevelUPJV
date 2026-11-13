import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { api, useApi } from '../../api';
import PageState from '../../components/PageState';
import { subjectStyles, subjects } from '../../subjects';
import type { Difficulty, Subject } from '../../types';
import { Breadcrumb, PageTitle, ProgressBar, Segmented, Toggle, buttonBrand, buttonOutline, inputClass } from '../../components/ui';

type Kind = 'sql' | 'tests';

interface Options {
  promotions: { id: number; name: string; groups: { id: number; name: string }[] }[];
  competences: { id: number; name: string }[];
  suggested: Record<Subject, number | null>;
}

const suggestedPoints: Record<Difficulty, number> = { Facile: 40, Moyen: 70, Difficile: 110 };
const ATTEMPTS = ['3', '5', '10', 'Illimitées'] as const;

/** Modèle de jeu de données proposé à l'enseignant (il le remplace par le sien). */
const EXAMPLE_SETUP = `CREATE TABLE clients (id INTEGER PRIMARY KEY, nom TEXT, ville TEXT);
CREATE TABLE commandes (id INTEGER PRIMARY KEY, client_id INTEGER, montant REAL);
INSERT INTO clients VALUES (1,'Alice','Amiens'),(2,'Bob','Paris'),(3,'Chloé','Amiens');
INSERT INTO commandes VALUES (1,1,45.0),(2,1,20.0),(3,2,99.9);`;

export default function CreerDefi() {
  const { data, loading, error, reload } = useApi<Options>('/teacher/options');
  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      {data && <Form options={data} />}
    </PageState>
  );
}

function Form({ options }: { options: Options }) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<Subject>('Bases de données');
  const [difficulty, setDifficulty] = useState<Difficulty>('Moyen');
  const [minutes, setMinutes] = useState(25);
  const [points, setPoints] = useState(70);
  const [statement, setStatement] = useState('');
  const [constraint, setConstraint] = useState('');
  const [kind, setKind] = useState<Kind>('sql');
  const [setupSql, setSetupSql] = useState('');
  const [reference, setReference] = useState('');
  const [orderMatters, setOrderMatters] = useState(false);
  const [variant, setVariant] = useState(true);
  const [similarity, setSimilarity] = useState(true);
  const [threshold, setThreshold] = useState(85);
  const [maxTime, setMaxTime] = useState('5 s');
  const [maxMemory, setMaxMemory] = useState('128 Mo');
  const [attempts, setAttempts] = useState<(typeof ATTEMPTS)[number]>('5');
  const [hints, setHints] = useState(true);
  const [hintCount, setHintCount] = useState(3);
  const [hintAdvice, setHintAdvice] = useState('');
  const [competenceChoice, setCompetenceChoice] = useState<number | null>(null);
  const [targetChoice, setTargetChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // La compétence suit la matière, tant que l'enseignant n'en a pas choisi une autre.
  const competenceId = competenceChoice ?? options.suggested[subject] ?? null;
  const targets = options.promotions.flatMap((p) => [
    { value: `p:${p.id}`, label: `Toute la promo ${p.name}` },
    ...p.groups.map((g) => ({ value: `g:${g.id}`, label: `${p.name} · ${g.name}` })),
  ]);
  const target = targetChoice ?? targets[0]?.value ?? '';

  const checklist = useMemo(
    () => [
      { label: 'Titre renseigné', ok: title.trim().length > 0 },
      { label: 'Énoncé d’au moins 40 caractères', ok: statement.trim().length >= 40 },
      { label: 'Compétence BUT choisie', ok: competenceId !== null },
      ...(kind === 'sql' ? [{ label: 'Jeu de données SQL', ok: setupSql.trim().length > 0 }] : []),
      { label: kind === 'sql' ? 'Requête de référence' : 'Solution de référence', ok: reference.trim().length > 0 },
      { label: 'Points entre 10 et 200', ok: points >= 10 && points <= 200 },
    ],
    [title, statement, competenceId, kind, setupSql, reference, points],
  );
  const doneCount = checklist.filter((c) => c.ok).length;
  const ready = doneCount === checklist.length;
  const st = subjectStyles[subject];
  const steps = ['Informations', 'Énoncé', 'Correction', 'Anti-triche', 'Indices IA'];

  const save = async (status: 'PUBLISHED' | 'DRAFT') => {
    setBusy(true);
    setResult(null);
    try {
      const res = await api<{ id: number; status: string; target: string | null }>('/teacher/challenges', {
        body: {
          title,
          subject,
          difficulty,
          minutes,
          points,
          statement,
          constraint,
          kind,
          setupSql,
          reference,
          competenceId,
          status,
          ...(target.startsWith('g:') ? { groupId: Number(target.slice(2)) } : target.startsWith('p:') ? { promoId: Number(target.slice(2)) } : {}),
          settings: {
            orderMatters,
            maxAttempts: attempts === 'Illimitées' ? null : Number(attempts),
            variant,
            similarity,
            threshold,
            maxTime,
            maxMemory,
            hints: { enabled: hints, count: hintCount, advice: hintAdvice },
          },
        },
      });
      setResult({
        ok: true,
        text:
          status === 'DRAFT'
            ? `Brouillon « ${title} » enregistré.`
            : res.target
              ? `Défi « ${title} » publié et recommandé à ${res.target}.`
              : `Défi « ${title} » publié dans le catalogue.`,
      });
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : 'Enregistrement impossible.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Mes promos', to: '/enseignant' }, { label: 'Challenges' }, { label: 'Nouveau défi' }]} />
      <PageTitle title="Créer un défi" subtitle="Écris l’énoncé, définis comment la réponse est corrigée, puis publie le défi à tes groupes.">
        <ol className="flex flex-wrap gap-1.5 text-[11px]">
          {steps.map((s, i) => (
            <li key={s} className="rounded-full border border-slate-200 bg-white px-3 py-1"><span className="mr-1 font-bold text-brand">{i + 1}</span>{s}</li>
          ))}
        </ol>
      </PageTitle>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <form className="min-w-0 space-y-5" onSubmit={(e) => e.preventDefault()}>
          <Section title="1. Informations">
            <Field label="Titre du défi" hint={`${title.length} / 80`}>
              <input className={inputClass} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. : Jointures et sous-requêtes" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Matière">
                <select className={inputClass} value={subject} onChange={(e) => { setSubject(e.target.value as Subject); setCompetenceChoice(null); }}>
                  {subjects.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Compétence BUT visée">
                <select className={inputClass} value={competenceId ?? ''} onChange={(e) => setCompetenceChoice(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Choisir…</option>
                  {options.competences.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Difficulté">
                <Segmented<Difficulty> options={['Facile', 'Moyen', 'Difficile']} value={difficulty} onChange={(d) => { setDifficulty(d); setPoints(suggestedPoints[d]); }} />
              </Field>
              <Field label="Durée estimée (min)">
                <input type="number" min={5} max={120} className={inputClass} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
              </Field>
              <Field label="Points" hint={`Suggestion selon la difficulté : ${suggestedPoints[difficulty]} pts`}>
                <input type="number" min={10} max={200} className={inputClass} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
              </Field>
            </div>
          </Section>

          <Section title="2. Énoncé">
            <Field label="Énoncé" hint={`${statement.length} caractères`}>
              <textarea className={inputClass} rows={4} value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Décris le travail à faire, les contraintes et le format attendu." />
            </Field>
            <Field label="Consigne ou contrainte (facultatif)">
              <input className={inputClass} value={constraint} onChange={(e) => setConstraint(e.target.value)} placeholder="Ex. : Une seule requête SELECT, sans sous-requête." />
            </Field>
          </Section>

          <Section title="3. Correction automatique">
            <p className="text-xs font-medium">Type de correction</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {([['sql', 'Requête SQL', 'On compare le résultat obtenu au résultat attendu.'], ['tests', 'Code (tests)', 'Enregistré tel quel : la correction automatique du code n’est pas encore disponible.']] as [Kind, string, string][]).map(([id, name, text]) => (
                <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)} className={`rounded-md border-2 bg-white p-3 text-left ${kind === id ? 'border-navy' : 'border-slate-200 hover:border-slate-300'}`}>
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="text-xs text-muted">{text}</p>
                </button>
              ))}
            </div>
            {kind === 'sql' && (
              <Field label="Jeu de données (CREATE TABLE / INSERT)" hint="Le jeu de données est chargé dans une base jetable à chaque exécution. L’étudiant en voit les tables.">
                <textarea className={`${inputClass} font-mono text-xs`} rows={6} value={setupSql} onChange={(e) => setSetupSql(e.target.value)} placeholder="CREATE TABLE …; INSERT INTO …;" />
                <button type="button" onClick={() => setSetupSql(EXAMPLE_SETUP)} className="mt-1 text-[11px] font-semibold text-brand hover:underline">Utiliser un exemple (clients et commandes)</button>
              </Field>
            )}
            <Field label={kind === 'sql' ? 'Requête de référence' : 'Solution de référence'} hint={kind === 'sql' ? 'Le résultat de cette requête sert de réponse attendue. Elle est testée sur le jeu de données à l’enregistrement.' : undefined}>
              <textarea className={`${inputClass} font-mono text-xs`} rows={4} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={kind === 'sql' ? 'SELECT …' : 'def solution(...):'} />
            </Field>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={orderMatters} onChange={(e) => setOrderMatters(e.target.checked)} /> L’ordre des lignes compte pour la correction</label>
          </Section>

          <Section title="4. Anti-triche et limites">
            <p className="text-[11px] text-muted">Ces réglages sont enregistrés avec le défi. Pour l’instant, seuls « L’ordre des lignes » et « Tentatives max » sont appliqués à la correction.</p>
            <Row title="Générer une variante par étudiant" text="Les jeux de données et valeurs changent d’un étudiant à l’autre." checked={variant} onChange={setVariant} />
            <Row title="Détection de similarité" text="Signale les réponses trop proches entre étudiants." checked={similarity} onChange={setSimilarity} />
            {similarity && (
              <div>
                <div className="flex justify-between text-xs"><span className="font-medium">Seuil de similarité</span><span className="font-bold">{threshold} %</span></div>
                <input type="range" min={50} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full accent-brand" aria-label="Seuil de similarité" />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Temps max par exécution"><select className={inputClass} value={maxTime} onChange={(e) => setMaxTime(e.target.value)}>{['2 s', '5 s', '10 s'].map((v) => <option key={v}>{v}</option>)}</select></Field>
              <Field label="Mémoire max"><select className={inputClass} value={maxMemory} onChange={(e) => setMaxMemory(e.target.value)}>{['64 Mo', '128 Mo', '256 Mo'].map((v) => <option key={v}>{v}</option>)}</select></Field>
              <Field label="Tentatives max"><select className={inputClass} value={attempts} onChange={(e) => setAttempts(e.target.value as typeof attempts)}>{ATTEMPTS.map((v) => <option key={v}>{v}</option>)}</select></Field>
            </div>
          </Section>

          <Section title="5. Indices IA">
            <p className="text-[11px] text-muted">Enregistré avec le défi ; les indices proposés aux étudiants sont pour l’instant des indices généraux.</p>
            <Row title="Autoriser les indices IA" text="Les indices progressifs que l’IA donne sans donner la réponse." checked={hints} onChange={setHints} />
            {hints && (
              <>
                <Field label="Nombre d’indices" hint="Le 1er est gratuit, les suivants coûtent 10 puis 20 pts.">
                  <Segmented<'2' | '3' | '4'> options={['2', '3', '4']} value={String(hintCount) as '2' | '3' | '4'} onChange={(v) => setHintCount(Number(v))} />
                </Field>
                <Field label="Consignes pour l’IA (facultatif)">
                  <textarea className={inputClass} rows={3} value={hintAdvice} onChange={(e) => setHintAdvice(e.target.value)} placeholder="Ex. : Insister sur l’ordre d’exécution WHERE / GROUP BY / HAVING. Ne jamais écrire la requête complète." />
                </Field>
              </>
            )}
          </Section>
        </form>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-lg bg-panel p-4">
            <h2 className="text-sm font-semibold">Aperçu étudiant</h2>
            <article className={`mt-3 rounded-lg border-t-4 bg-white p-4 ${st.border}`}>
              <div className="flex items-center justify-between text-[11px] text-muted"><span>{difficulty}</span><span className={`rounded px-1.5 py-0.5 font-semibold text-white ${st.bar}`}>{subject}</span></div>
              <h3 className="mt-2 text-sm font-semibold">{title || 'Titre du défi'}</h3>
              <p className="mt-1 text-xs text-muted">{statement ? statement.slice(0, 90) + (statement.length > 90 ? '…' : '') : 'L’énoncé apparaîtra ici.'}</p>
              <p className="mt-2 text-[11px] text-muted">{minutes} min · {kind === 'sql' ? 'Requête SQL' : 'Tests'}</p>
              <div className="mt-3 flex items-center justify-between"><span className="text-sm font-bold text-brand">+{points} pts</span><span className="rounded bg-navy px-3 py-1 text-xs font-semibold text-white">Commencer</span></div>
            </article>
          </section>

          <section className="rounded-lg bg-panel p-4">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Avant de publier</h2><span className="text-[11px] text-muted">{doneCount}/{checklist.length} complétés</span></div>
            <div className="mt-2"><ProgressBar value={doneCount} max={checklist.length} color="bg-brand" track="bg-white" /></div>
            <ul className="mt-3 space-y-1.5 text-xs">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-center gap-2 rounded bg-white px-2 py-1.5">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full ${c.ok ? 'bg-green-600 text-white' : 'bg-slate-200'}`}>{c.ok && <Check className="h-3 w-3" />}</span>
                  {c.label}
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium">Recommander à</p>
              <select className={inputClass} value={target} onChange={(e) => setTargetChoice(e.target.value)}>
                {targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                <option value="">Aucun groupe (catalogue seulement)</option>
              </select>
            </div>
            <div className="mt-3 space-y-2">
              <button disabled={!ready || busy} onClick={() => save('PUBLISHED')} className={`${buttonBrand} w-full`}>{busy ? 'Enregistrement…' : 'Publier le défi'}</button>
              <button disabled={busy || !title.trim()} onClick={() => save('DRAFT')} className={`${buttonOutline} w-full`}>Enregistrer le brouillon</button>
            </div>
            {result && (
              <p role={result.ok ? 'status' : 'alert'} className={`mt-3 rounded px-3 py-2 text-xs ${result.ok ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-800'}`}>{result.text}</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg bg-panel p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium">
      <span className="mb-1 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] font-normal text-muted">{hint}</span>}
    </label>
  );
}

function Row({ title, text, checked, onChange }: { title: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2.5">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted">{text}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

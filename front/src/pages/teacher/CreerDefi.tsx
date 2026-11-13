import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { subjectCompetence, subjectStyles, subjects } from '../../data/catalog';
import type { Difficulty, Subject } from '../../types';
import { Breadcrumb, PageTitle, ProgressBar, Segmented, Toggle, buttonBrand, buttonOutline, inputClass } from '../../components/ui';

type Kind = 'sql' | 'tests';

const suggestedPoints: Record<Difficulty, number> = { Facile: 40, Moyen: 70, Difficile: 110 };

export default function CreerDefi() {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<Subject>('Bases de données');
  const [difficulty, setDifficulty] = useState<Difficulty>('Moyen');
  const [minutes, setMinutes] = useState(25);
  const [points, setPoints] = useState(70);
  const [statement, setStatement] = useState('');
  const [constraint, setConstraint] = useState('');
  const [kind, setKind] = useState<Kind>('sql');
  const [reference, setReference] = useState('');
  const [ignoreOrder, setIgnoreOrder] = useState(false);
  const [variant, setVariant] = useState(true);
  const [similarity, setSimilarity] = useState(true);
  const [threshold, setThreshold] = useState(85);
  const [hints, setHints] = useState(true);
  const [hintCount, setHintCount] = useState(3);
  const [hintAdvice, setHintAdvice] = useState('');
  const [group, setGroup] = useState('BUT 2 · Groupe 2');
  const [saved, setSaved] = useState('');

  const checklist = useMemo(
    () => [
      { label: 'Titre renseigné', ok: title.trim().length > 0 },
      { label: 'Énoncé d’au moins 40 caractères', ok: statement.trim().length >= 40 },
      { label: 'Compétence BUT choisie', ok: Boolean(subject) },
      { label: 'Requête de référence', ok: reference.trim().length > 0 },
      { label: 'Points entre 10 et 200', ok: points >= 10 && points <= 200 },
    ],
    [title, statement, subject, reference, points],
  );
  const doneCount = checklist.filter((c) => c.ok).length;
  const ready = doneCount === checklist.length;
  const st = subjectStyles[subject];

  const steps = ['Informations', 'Énoncé', 'Correction', 'Anti-triche', 'Indices IA'];

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
                <select className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value as Subject)}>
                  {subjects.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Compétence BUT visée">
                <input className={`${inputClass} bg-slate-50`} readOnly value={subjectCompetence[subject]} />
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
                <input type="number" min={0} max={300} className={inputClass} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
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
              {([['sql', 'Requête SQL', 'On compare le résultat obtenu au résultat attendu.'], ['tests', 'Code (tests)', 'On lance des tests dans un conteneur isolé.']] as [Kind, string, string][]).map(([id, name, text]) => (
                <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)} className={`rounded-md border-2 bg-white p-3 text-left ${kind === id ? 'border-navy' : 'border-slate-200 hover:border-slate-300'}`}>
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="text-xs text-muted">{text}</p>
                </button>
              ))}
            </div>
            <Field label={kind === 'sql' ? 'Requête de référence' : 'Solution de référence'} hint="Le résultat de cette requête sert de réponse attendue.">
              <textarea className={`${inputClass} font-mono text-xs`} rows={4} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={kind === 'sql' ? 'SELECT …' : 'def solution(...):'} />
            </Field>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={ignoreOrder} onChange={(e) => setIgnoreOrder(e.target.checked)} /> L’ordre des lignes compte pour la correction</label>
          </Section>

          <Section title="4. Anti-triche et limites">
            <Row title="Générer une variante par étudiant" text="Les jeux de données et valeurs changent d’un étudiant à l’autre." checked={variant} onChange={setVariant} />
            <Row title="Détection de similarité" text="Signale les réponses trop proches entre étudiants." checked={similarity} onChange={setSimilarity} />
            {similarity && (
              <div>
                <div className="flex justify-between text-xs"><span className="font-medium">Seuil de similarité</span><span className="font-bold">{threshold} %</span></div>
                <input type="range" min={50} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full accent-brand" aria-label="Seuil de similarité" />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Temps max par exécution"><select className={inputClass} defaultValue="5 s">{['2 s', '5 s', '10 s'].map((v) => <option key={v}>{v}</option>)}</select></Field>
              <Field label="Mémoire max"><select className={inputClass} defaultValue="128 Mo">{['64 Mo', '128 Mo', '256 Mo'].map((v) => <option key={v}>{v}</option>)}</select></Field>
              <Field label="Tentatives max"><select className={inputClass} defaultValue="5">{['3', '5', '10', 'Illimitées'].map((v) => <option key={v}>{v}</option>)}</select></Field>
            </div>
          </Section>

          <Section title="5. Indices IA">
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
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Avant de publier</h2><span className="text-[11px] text-muted">{doneCount}/{checklist.length} à compléter</span></div>
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
              <p className="mb-1 text-xs font-medium">Publier pour</p>
              <select className={inputClass} value={group} onChange={(e) => setGroup(e.target.value)}>
                {['BUT 2 · Groupe 1', 'BUT 2 · Groupe 2', 'BUT 2 · Groupe 3', 'Toute la promo BUT 2'].map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="mt-3 space-y-2">
              <button disabled={!ready} onClick={() => setSaved(`Défi « ${title} » publié pour ${group}.`)} className={`${buttonBrand} w-full`}>Publier le défi</button>
              <button onClick={() => setSaved('Brouillon enregistré.')} className={`${buttonOutline} w-full`}>Enregistrer le brouillon</button>
            </div>
            {saved && <p role="status" className="mt-3 rounded bg-green-100 px-3 py-2 text-xs text-green-800">{saved}</p>}
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

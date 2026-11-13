import { Breadcrumb, Card, PageTitle } from '../../components/ui';

const faq = [
  ['Comment lancer un challenge en TD ?', 'Depuis « Mes promos », choisis une notion, un groupe et une durée, puis clique sur « Lancer le challenge ».'],
  ['Comment créer un défi ?', 'Ouvre « Challenges », remplis les 5 étapes et publie le défi à un groupe ou à toute la promo.'],
  ['Les indices IA donnent-ils la réponse ?', 'Non : ils guident l’étudiant sans révéler la solution. Tu peux ajouter des consignes pour l’IA à chaque défi.'],
  ['Comment sont calculées les compétences ?', 'Chaque défi est rattaché à une compétence du référentiel BUT ; la moyenne des défis réussis alimente la jauge.'],
];

export default function Aide() {
  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Mes promos', to: '/enseignant' }, { label: 'Aide' }]} />
      <PageTitle title="Aide" subtitle="Les réponses aux questions fréquentes." />
      <Card>
        <dl className="space-y-4">
          {faq.map(([q, a]) => (
            <div key={q} className="rounded-md bg-white p-4">
              <dt className="text-sm font-semibold">{q}</dt>
              <dd className="mt-1 text-sm text-muted">{a}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

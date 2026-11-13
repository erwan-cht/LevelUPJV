import { teacherCompetences } from '../../data/teacher';
import { Breadcrumb, Card, PageTitle, ProgressBar } from '../../components/ui';

const detail: Record<string, string[]> = {
  Réaliser: ['Implémenter des algorithmes', 'Développer des interfaces web', 'Tester une application'],
  Optimiser: ['Analyser la complexité', 'Optimiser des requêtes SQL', 'Profiler une application'],
  Administrer: ['Configurer un système Linux', 'Gérer les droits et les services', 'Superviser un réseau'],
  Gérer: ['Modéliser une base de données', 'Écrire des requêtes avancées', 'Sécuriser les données'],
  Conduire: ['Planifier un projet', 'Utiliser Git en équipe', 'Rédiger une documentation'],
  Collaborer: ['Travailler en équipe', 'Communiquer avec un client', 'Présenter un travail'],
};

export default function Competences() {
  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Mes promos', to: '/enseignant' }, { label: 'Compétences' }]} />
      <PageTitle title="Compétences du référentiel BUT" subtitle="Acquisition moyenne de la promo BUT 2 Informatique, alimentée par les défis réussis." />
      <div className="grid gap-4 md:grid-cols-2">
        {teacherCompetences.map((c) => (
          <Card key={c.name}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{c.name}</h2>
              <span className="text-lg font-bold text-brand">{c.value} %</span>
            </div>
            <p className="mb-2 text-xs text-muted">{c.description}</p>
            <ProgressBar value={c.value} max={100} height="h-2" track="bg-white" />
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs marker:text-brand">
              {detail[c.name].map((d) => <li key={d}>{d}</li>)}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

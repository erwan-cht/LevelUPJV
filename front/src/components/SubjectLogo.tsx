import { useState } from 'react';
import { Code2, Database, Globe, Network } from 'lucide-react';
import { subjectStyles } from '../subjects';
import type { Subject } from '../types';

/** Logo de chaque matière (fichiers de front/public/). */
const logos: Record<Subject, string> = {
  'Bases de données': '/Sql_data_base_with_logo.png',
  Algorithmique: '/python.webp',
  'Développement web': '/what-is-website.webp',
  'Réseaux & systèmes': '/box-internet.png',
};

const icons: Record<Subject, typeof Database> = {
  'Bases de données': Database,
  Algorithmique: Code2,
  'Développement web': Globe,
  'Réseaux & systèmes': Network,
};

/**
 * Logo de la matière d'un défi, pour reconnaître son type d'un coup d'œil.
 * Si l'image est absente ou illisible, on affiche l'icône colorée de la matière à la place.
 */
export default function SubjectLogo({ subject, size = 'h-9 w-9' }: { subject: Subject; size?: string }) {
  const [broken, setBroken] = useState(false);

  if (!broken) {
    return (
      <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-1 ring-1 ring-slate-200`} title={subject}>
        <img src={logos[subject]} alt={subject} className="h-full w-full object-contain" onError={() => setBroken(true)} />
      </span>
    );
  }

  const Icon = icons[subject];
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-md text-white ${subjectStyles[subject].bar}`} title={subject} role="img" aria-label={subject}>
      <Icon className="h-1/2 w-1/2" />
    </span>
  );
}

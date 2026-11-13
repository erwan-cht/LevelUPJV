import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Logo({ to = '/', badge }: { to?: string; badge?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 text-xl font-bold">
      <GraduationCap className="h-6 w-6" />
      <span>
        Level<span className="text-brand">UP</span>JV
      </span>
      {badge && (
        <span className="rounded bg-navy px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

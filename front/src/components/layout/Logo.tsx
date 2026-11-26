import { Link } from 'react-router-dom';

export default function Logo({ to = '/', badge }: { to?: string; badge?: string }) {
  return (
    <Link to={to} className="flex items-center gap-1 text-xl font-bold">
      <img src="/logo_levelupjv_sans_fond.png" alt="" className="h-8 w-auto" />
      <span>
        Level<span className="text-brand">UP</span>JV
      </span>
      {badge && (
        <span className="ml-1 rounded bg-navy px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

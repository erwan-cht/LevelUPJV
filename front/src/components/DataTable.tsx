export interface TableData {
  columns: string[];
  rows: string[][];
}

/** Petit tableau de résultats SQL (jeu de données, résultat attendu ou obtenu). */
export default function DataTable({ title, table }: { title?: string; table: TableData }) {
  return (
    <div className="overflow-x-auto rounded-md bg-white">
      {title && <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>}
      <table className="w-full min-w-max text-left font-mono text-[11px]">
        <thead className="text-muted">
          <tr>
            {table.columns.map((c, i) => (
              <th key={i} className="px-3 py-1.5 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100">
              {r.map((v, j) => (
                <td key={j} className="px-3 py-1">
                  {v}
                </td>
              ))}
            </tr>
          ))}
          {table.rows.length === 0 && (
            <tr>
              <td colSpan={Math.max(table.columns.length, 1)} className="px-3 py-2 italic text-muted">
                Aucune ligne.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

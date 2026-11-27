import { useEffect } from 'react';
import CoursePanel, { type CourseInfo } from './CoursePanel';

/** Le cours en tiroir par-dessus la page : un clic à côté ou Échap le referme. */
export default function CourseDrawer({
  course,
  page,
  onPage,
  onClose,
  onExplain,
}: {
  course: CourseInfo;
  page: number;
  onPage: (page: number) => void;
  onClose: () => void;
  onExplain: (page: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-[min(560px,100vw)] p-3" onClick={(e) => e.stopPropagation()}>
        <CoursePanel course={course} page={page} onPage={onPage} onClose={onClose} onExplain={onExplain} className="h-full" />
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';

export default function WeeklyBars({ data, goal = 120 }) {
  const max = Math.max(goal, ...data.map((d) => d.minutes));
  return (
    <div>
      <div className="flex h-44 items-end gap-2 sm:gap-3">
        {data.map((d, i) => {
          const pct = Math.max(3, Math.round((d.minutes / max) * 100));
          const hit = d.minutes >= goal;
          return (
            <div key={d.key || `${d.day}-${i}`} className="group flex flex-1 flex-col items-center gap-2">
              <span className="font-mono text-[10px] text-white/30 opacity-0 transition group-hover:opacity-100">
                {d.minutes}m
              </span>
              <div className="relative flex w-full flex-1 items-end">
                <div
                  className={cn(
                    'animate-rise w-full rounded-t-md transition-all duration-300',
                    hit ? 'bg-[#B6FF3B]' : 'bg-white/15 group-hover:bg-white/25'
                  )}
                  style={{ height: `${pct}%`, animationDelay: `${i * 55}ms` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2 border-t border-white/10 pt-3 sm:gap-3">
        {data.map((d, i) => (
          <span key={d.key || `${d.day}-label-${i}`} className="flex-1 text-center font-mono text-[10px] uppercase tracking-widest text-white/35">
            {d.day}
          </span>
        ))}
      </div>
    </div>
  );
}
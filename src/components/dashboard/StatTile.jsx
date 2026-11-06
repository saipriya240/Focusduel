import { cn } from '@/lib/utils';

export default function StatTile({ label, value, unit, sub, tone = 'default' }) {
  return (
    <div className="panel panel-hover p-4">
      <p className="label-xs">{label}</p>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cn('font-heading text-3xl leading-none', tone === 'acid' ? 'text-[#B6FF3B]' : tone === 'bad' ? 'text-red-400' : 'text-white')}>
          {value}
        </span>
        {unit && <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{unit}</span>}
      </div>
      {sub && <p className="mt-1.5 text-xs text-white/35">{sub}</p>}
    </div>
  );
}
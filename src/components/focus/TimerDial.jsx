import { fmtClock } from '@/lib/format';

export default function TimerDial({ remaining, total, mode, running }) {
  const size = 280;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#B6FF3B"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.4s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/35">{mode}</span>
        <span className="mt-1 font-heading text-6xl leading-none tabular-nums text-white">{fmtClock(remaining)}</span>
        <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#B6FF3B]/70">
          {running ? 'In session' : 'On hold'}
        </span>
      </div>
    </div>
  );
}
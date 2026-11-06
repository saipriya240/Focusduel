import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { AmbienceEngine, SOUND_OPTIONS } from '@/lib/ambience';
import { cn } from '@/lib/utils';

export default function SoundPanel() {
  const engineRef = useRef(null);
  const [playing, setPlaying] = useState(null);
  const [volume, setVolume] = useState(0.5);

  useEffect(() => () => { engineRef.current?.stop(); }, []);

  const toggle = (key) => {
    if (!engineRef.current) engineRef.current = new AmbienceEngine();
    const engine = engineRef.current;
    if (playing === key) {
      engine.stop();
      setPlaying(null);
    } else {
      engine.setVolume(volume);
      engine.play(key);
      setPlaying(key);
    }
  };

  const changeVolume = (v) => {
    setVolume(v);
    engineRef.current?.setVolume(v);
  };

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="label-xs">Ambience</p>
          <h3 className="mt-1 text-lg">Sound engine</h3>
        </div>
        <span className={cn('h-2 w-2 rounded-full', playing ? 'bg-[#B6FF3B] shadow-[0_0_10px_#B6FF3B]' : 'bg-white/20')} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {SOUND_OPTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => toggle(s.key)}
            className={cn(
              'flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition',
              playing === s.key
                ? 'border-[#B6FF3B]/60 bg-[#B6FF3B]/10 text-[#B6FF3B]'
                : 'border-white/10 bg-white/[0.02] text-white/60 hover:border-white/25 hover:text-white'
            )}
          >
            {s.label}
            {playing === s.key ? <Pause size={13} /> : <Play size={13} />}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Volume2 size={14} className="shrink-0 text-white/35" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#B6FF3B]"
          aria-label="Ambience volume"
        />
      </div>
      <p className="mt-3 font-mono text-[9px] uppercase leading-relaxed tracking-widest text-white/25">
        Generated live in your browser · keeps playing in background tabs
      </p>
    </div>
  );
}
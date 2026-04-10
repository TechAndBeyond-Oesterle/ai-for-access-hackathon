import { useState, useEffect } from 'react';
import type { Lang } from '../i18n/translations';
import { useTranslations } from '../i18n/utils';

interface Props {
  lang: Lang;
}

const TARGET = new Date('2026-11-20T18:00:00+01:00').getTime();

function getTimeLeft() {
  const now = Date.now();
  const diff = Math.max(0, TARGET - now);
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export default function Countdown({ lang }: Props) {
  const t = useTranslations(lang);
  const [time, setTime] = useState(getTimeLeft);
  const [tick, setTick] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeLeft());
      setTick(prev => !prev);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const blocks = [
    { value: time.days, label: t('countdown.days') },
    { value: time.hours, label: t('countdown.hours') },
    { value: time.minutes, label: t('countdown.minutes') },
    { value: time.seconds, label: t('countdown.seconds') },
  ];

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4">
      {blocks.map((block, i) => (
        <div key={block.label} className="flex items-center gap-3 sm:gap-4">
          <div className="flex flex-col items-center">
            <span
              className="block text-3xl sm:text-5xl md:text-6xl font-bold tabular-nums transition-transform duration-200"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent)',
                transform: i === 3 && tick ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              {String(block.value).padStart(2, '0')}
            </span>
            <span
              className="mt-1 text-[10px] sm:text-xs uppercase tracking-[0.2em]"
              style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {block.label}
            </span>
          </div>
          {i < blocks.length - 1 && (
            <span
              className="text-2xl sm:text-4xl font-light -mt-4 sm:-mt-5"
              style={{
                color: 'var(--fg-muted)',
                opacity: tick ? 1 : 0.3,
                transition: 'opacity 0.3s',
              }}
            >
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

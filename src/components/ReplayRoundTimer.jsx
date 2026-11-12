import { replayRoundTimer } from '../lib/replayRoundTimer.mjs';
import styles from './ReplayRoundTimer.module.css';

export default function ReplayRoundTimer({ round, sample }) {
  const timer = replayRoundTimer(round, sample);
  if (timer.status === 'round') return <span className={styles.timer} role="timer" aria-label="Round time remaining">{timer.label}</span>;
  const label = { planted: 'Bomb planted', defused: 'Bomb defused', exploded: 'Bomb exploded' }[timer.status];
  return <span className={styles.timer} role="img" aria-label={label} title={label}>
    <span className={styles.bomb} style={{ backgroundColor: timer.status === 'defused' ? '#5cc489' : '#fff' }}>
      {timer.status !== 'defused' && <span className={styles.fill} style={{ clipPath: `inset(0 ${(1 - timer.progress) * 100}% 0 0)` }} />}
    </span>
  </span>;
}

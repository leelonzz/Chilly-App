import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

type Mode = 'focus' | 'short' | 'long';

const MODES: Record<Mode, { label: string; minutes: number; color: string; bg: string }> = {
  focus: { label: 'Focus', minutes: 25, color: '#E8F1FF', bg: '#1E3A8A' },
  short: { label: 'Short break', minutes: 5, color: '#E7FFF4', bg: '#0F766E' },
  long: { label: 'Long break', minutes: 15, color: '#F3E8FF', bg: '#5B21B6' },
};

const LONG_BREAK_EVERY = 4;

function format(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('focus');
  const [remaining, setRemaining] = useState(MODES.focus.minutes * 60);
  // When running, the timer counts toward this wall-clock time, so it stays
  // correct even if the phone locks or the app goes to the background.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [completed, setCompleted] = useState(0);
  const finishing = useRef(false);

  const running = endsAt !== null;
  const theme = MODES[mode];

  const switchMode = (next: Mode) => {
    setEndsAt(null);
    setMode(next);
    setRemaining(MODES[next].minutes * 60);
  };

  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (mode === 'focus') {
      const done = completed + 1;
      setCompleted(done);
      switchMode(done % LONG_BREAK_EVERY === 0 ? 'long' : 'short');
    } else {
      switchMode('focus');
    }
    finishing.current = false;
  };

  const tick = () => {
    if (endsAt === null) return;
    const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    setRemaining(left);
    if (left === 0) finish();
  };

  useEffect(() => {
    if (!running) return;
    tick();
    const id = setInterval(tick, 250);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
    return () => {
      clearInterval(id);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  useEffect(() => {
    if (running) activateKeepAwakeAsync();
    else deactivateKeepAwake();
  }, [running]);

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (running) {
      setEndsAt(null); // pause; `remaining` keeps the time left
    } else {
      setEndsAt(Date.now() + remaining * 1000);
    }
  };

  const reset = () => {
    setEndsAt(null);
    setRemaining(theme.minutes * 60);
  };

  const total = theme.minutes * 60;
  const progress = 1 - remaining / total;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg }]}>
      <StatusBar style="light" />
      <Text style={styles.brand}>Chilly</Text>

      <View style={styles.tabs}>
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => switchMode(m)}
            style={[styles.tab, m === mode && styles.tabActive]}
          >
            <Text style={[styles.tabText, m === mode && { color: theme.bg }]}>
              {MODES[m].label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.center}>
        <Text style={[styles.time, { color: theme.color }]}>{format(remaining)}</Text>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.sub}>
          {mode === 'focus' ? 'Time to focus' : 'Time to chill'} · {completed} done
        </Text>
      </View>

      <View style={styles.controls}>
        <Pressable onPress={toggle} style={styles.primary}>
          <Text style={[styles.primaryText, { color: theme.bg }]}>
            {running ? 'Pause' : remaining < total ? 'Resume' : 'Start'}
          </Text>
        </Pressable>
        <Pressable onPress={reset} style={styles.secondary}>
          <Text style={styles.secondaryText}>Reset</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', paddingHorizontal: 20 },
  brand: { color: 'white', fontSize: 22, fontWeight: '700', marginTop: 24, opacity: 0.9 },
  tabs: {
    flexDirection: 'row',
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    padding: 4,
  },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  tabActive: { backgroundColor: 'white' },
  tabText: { color: 'white', fontWeight: '600', fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  time: { fontSize: 88, fontWeight: '200', fontVariant: ['tabular-nums'] },
  bar: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 16,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: 'white' },
  sub: { color: 'rgba(255,255,255,0.8)', marginTop: 16, fontSize: 16 },
  controls: { width: '100%', gap: 12, marginBottom: 40 },
  primary: { backgroundColor: 'white', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  primaryText: { fontSize: 20, fontWeight: '700' },
  secondary: { borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: 'white', fontSize: 16, fontWeight: '600', opacity: 0.85 },
});

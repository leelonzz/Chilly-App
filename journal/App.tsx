import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';

// ---------- Data ----------

type Entry = {
  id: string;
  createdAt: number;
  mood: string;
  title: string;
  body: string;
  // Saved photos are stored by file name only. The app's folder path on iOS
  // can change after updates, so the full path is rebuilt when shown.
  photos: string[];
};

// While editing, a photo is either already saved (file name) or freshly
// picked (a temporary full uri from the picker).
type DraftPhoto = { saved: string } | { temp: string };

const STORAGE_KEY = 'journal.entries.v1';
const MOODS = ['😄', '🙂', '😐', '😔', '😢', '😡', '😴', '🥰'];

const photosDir = () => {
  const dir = new Directory(Paths.document, 'journal-photos');
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  return dir;
};
const photoUri = (name: string) => new File(photosDir(), name).uri;
const draftUri = (p: DraftPhoto) => ('saved' in p ? photoUri(p.saved) : p.temp);

const deletePhoto = (name: string) => {
  try {
    const f = new File(photosDir(), name);
    if (f.exists) f.delete();
  } catch {
    // Already gone; nothing to do.
  }
};

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function loadEntries(): Promise<Entry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveEntries(entries: Entry[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

// ---------- App ----------

export default function App() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  // null = list screen, 'new' = new entry, otherwise the entry being edited
  const [editing, setEditing] = useState<Entry | 'new' | null>(null);

  useEffect(() => {
    loadEntries()
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  const persist = async (next: Entry[]) => {
    setEntries(next);
    await saveEntries(next);
  };

  const handleSave = async (entry: Entry) => {
    const list = entries ?? [];
    const exists = list.some((e) => e.id === entry.id);
    const next = exists ? list.map((e) => (e.id === entry.id ? entry : e)) : [entry, ...list];
    next.sort((a, b) => b.createdAt - a.createdAt);
    await persist(next);
    setEditing(null);
  };

  const handleDelete = async (entry: Entry) => {
    entry.photos.forEach(deletePhoto);
    await persist((entries ?? []).filter((e) => e.id !== entry.id));
    setEditing(null);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {editing ? (
        <EditorScreen
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      ) : (
        <ListScreen
          entries={entries}
          onNew={() => setEditing('new')}
          onOpen={(e) => setEditing(e)}
        />
      )}
    </SafeAreaProvider>
  );
}

// ---------- List screen ----------

function ListScreen({
  entries,
  onNew,
  onOpen,
}: {
  entries: Entry[] | null;
  onNew: () => void;
  onOpen: (e: Entry) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!entries || !q) return entries ?? [];
    return entries.filter(
      (e) => e.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q),
    );
  }, [entries, query]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Journal</Text>
        <Text style={styles.muted}>
          {entries ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` : ''}
        </Text>
      </View>

      {entries && entries.length > 0 && (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search entries"
          placeholderTextColor="#9A9289"
          style={styles.search}
          clearButtonMode="while-editing"
        />
      )}

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 12 }}
        ListEmptyComponent={
          entries === null ? undefined : (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48 }}>📔</Text>
              <Text style={styles.emptyTitle}>
                {query ? 'No matching entries' : 'Your journal is empty'}
              </Text>
              {!query && (
                <Text style={styles.muted}>Tap “New entry” to write your first one.</Text>
              )}
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpen(item)} style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 22 }}>{item.mood}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardDate}>
                  {formatDate(item.createdAt)} · {formatTime(item.createdAt)}
                </Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title || 'Untitled'}
                </Text>
              </View>
            </View>
            {!!item.body && (
              <Text style={styles.cardBody} numberOfLines={3}>
                {item.body}
              </Text>
            )}
            {item.photos.length > 0 && (
              <View style={styles.thumbRow}>
                {item.photos.slice(0, 4).map((p, i) => (
                  <View key={p}>
                    <Image source={{ uri: photoUri(p) }} style={styles.thumb} />
                    {i === 3 && item.photos.length > 4 && (
                      <View style={styles.moreOverlay}>
                        <Text style={styles.moreText}>+{item.photos.length - 4}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        )}
      />

      <Pressable onPress={onNew} style={styles.fab}>
        <Text style={styles.fabText}>＋ New entry</Text>
      </Pressable>
    </SafeAreaView>
  );
}

// ---------- Editor screen ----------

function EditorScreen({
  initial,
  onCancel,
  onSave,
  onDelete,
}: {
  initial: Entry | null;
  onCancel: () => void;
  onSave: (e: Entry) => Promise<void>;
  onDelete: (e: Entry) => Promise<void>;
}) {
  const [mood, setMood] = useState(initial?.mood ?? '🙂');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [photos, setPhotos] = useState<DraftPhoto[]>(
    initial?.photos.map((saved) => ({ saved })) ?? [],
  );
  const [viewing, setViewing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const createdAt = initial?.createdAt ?? Date.now();

  const addFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('No access to photos', 'Allow photo access in Settings to add pictures.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!res.canceled) setPhotos((p) => [...p, ...res.assets.map((a) => ({ temp: a.uri }))]);
  };

  const addFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('No camera access', 'Allow camera access in Settings to take pictures.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled) setPhotos((p) => [...p, { temp: res.assets[0].uri }]);
  };

  const addPhoto = () =>
    Alert.alert('Add photo', undefined, [
      { text: 'Choose from library', onPress: addFromLibrary },
      { text: 'Take photo', onPress: addFromCamera },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const save = async () => {
    if (!title.trim() && !body.trim() && photos.length === 0) {
      onCancel();
      return;
    }
    setSaving(true);
    try {
      // Copy newly picked photos out of the temporary cache into app storage.
      const dir = photosDir();
      const names = photos.map((p) => {
        if ('saved' in p) return p.saved;
        const ext = p.temp.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
        const name = `${newId()}.${ext}`;
        new File(p.temp).copySync(new File(dir, name));
        return name;
      });
      // Remove files for photos that were taken out of this entry.
      initial?.photos.filter((n) => !names.includes(n)).forEach(deletePhoto);

      await onSave({
        id: initial?.id ?? newId(),
        createdAt,
        mood,
        title: title.trim(),
        body,
        photos: names,
      });
    } catch (err) {
      setSaving(false);
      Alert.alert('Could not save', String(err));
    }
  };

  const confirmDelete = () =>
    initial &&
    Alert.alert('Delete entry?', 'This removes the entry and its photos.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(initial) },
    ]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.toolbar}>
        <Pressable onPress={onCancel} hitSlop={10}>
          <Text style={styles.toolbarBtn}>Cancel</Text>
        </Pressable>
        <Text style={styles.toolbarTitle}>{initial ? 'Edit entry' : 'New entry'}</Text>
        <Pressable onPress={save} disabled={saving} hitSlop={10}>
          <Text style={[styles.toolbarBtn, styles.toolbarSave]}>
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.muted}>
            {formatDate(createdAt)} · {formatTime(createdAt)}
          </Text>

          <View>
            <Text style={styles.label}>How are you feeling?</Text>
            <View style={styles.moodRow}>
              {MOODS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMood(m)}
                  style={[styles.mood, m === mood && styles.moodActive]}
                >
                  <Text style={{ fontSize: 26 }}>{m}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor="#B5ADA3"
            style={styles.titleInput}
          />

          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Write about your day…"
            placeholderTextColor="#B5ADA3"
            style={styles.bodyInput}
            multiline
            textAlignVertical="top"
          />

          <View>
            <Text style={styles.label}>Photos</Text>
            <View style={styles.photoGrid}>
              {photos.map((p, i) => {
                const uri = draftUri(p);
                return (
                  <Pressable key={uri} onPress={() => setViewing(uri)}>
                    <Image source={{ uri }} style={styles.photo} />
                    <Pressable
                      onPress={() => setPhotos((list) => list.filter((_, j) => j !== i))}
                      style={styles.removeBtn}
                      hitSlop={8}
                    >
                      <Text style={styles.removeText}>✕</Text>
                    </Pressable>
                  </Pressable>
                );
              })}
              <Pressable onPress={addPhoto} style={[styles.photo, styles.addPhoto]}>
                <Text style={{ fontSize: 28, color: '#8A7F73' }}>＋</Text>
                <Text style={{ color: '#8A7F73', fontSize: 12 }}>Add photo</Text>
              </Pressable>
            </View>
          </View>

          {initial && (
            <Pressable onPress={confirmDelete} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>Delete entry</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewing(null)}>
          {viewing && (
            <Image source={{ uri: viewing }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />
          )}
          <Text style={{ color: 'white', marginTop: 16 }}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ---------- Styles ----------

const INK = '#2B2520';
const PAPER = '#FAF6F0';
const ACCENT = '#C2603A';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAPER },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  h1: { fontSize: 34, fontWeight: '800', color: INK },
  muted: { color: '#8A7F73', fontSize: 14 },
  search: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#EFE8DE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: INK,
  },
  empty: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: INK },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardDate: { color: '#8A7F73', fontSize: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: INK },
  cardBody: { color: '#4A423B', fontSize: 15, lineHeight: 21 },
  thumbRow: { flexDirection: 'row', gap: 6 },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#EEE' },
  moreOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: { color: 'white', fontWeight: '700' },
  fab: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    backgroundColor: ACCENT,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabText: { color: 'white', fontSize: 17, fontWeight: '700' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD3C7',
  },
  toolbarTitle: { fontSize: 17, fontWeight: '700', color: INK },
  toolbarBtn: { fontSize: 17, color: ACCENT },
  toolbarSave: { fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '700', color: '#8A7F73', marginBottom: 8, textTransform: 'uppercase' },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mood: { padding: 6, borderRadius: 12 },
  moodActive: { backgroundColor: '#F1DDD2' },
  titleInput: { fontSize: 24, fontWeight: '700', color: INK, paddingVertical: 4 },
  bodyInput: { fontSize: 17, lineHeight: 24, color: INK, minHeight: 180 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: 100, height: 100, borderRadius: 12, backgroundColor: '#EEE' },
  addPhoto: {
    backgroundColor: '#EFE8DE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C9BEB1',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: 'white', fontSize: 12, fontWeight: '700' },
  deleteBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 16 },
  deleteText: { color: '#C0392B', fontSize: 16, fontWeight: '600' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
});

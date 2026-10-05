import { Directory, File, Paths } from 'expo-file-system';
import { versionDir, type TileStorage } from './roadTiles';

/**
 * Keeps road tiles in the app's cache directory, one folder per data version.
 * The OS may clear it when storage runs low; tiles are then downloaded again.
 */
export function fileTileStorage(): TileStorage {
  const root = new Directory(Paths.cache, 'road-tiles');

  return {
    async read(path) {
      try {
        const file = new File(root, path);
        return file.exists ? await file.text() : null;
      } catch {
        return null;
      }
    },
    write(path, text) {
      try {
        const file = new File(root, path);
        file.create({ intermediates: true, overwrite: true });
        file.write(text);
      } catch {
        // A full or unavailable disk only costs a re-download later.
      }
    },
    prune(keepVersion) {
      try {
        if (!root.exists) return;
        const keep = versionDir(keepVersion);
        for (const entry of root.list()) {
          if (entry instanceof Directory && entry.name !== keep) entry.delete();
        }
      } catch {
        // Stale tiles are harmless; the next prune will retry.
      }
    },
  };
}

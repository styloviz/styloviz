/**
 * Which free glyph a file or folder is drawn with, decided by its name.
 *
 * ★ Every name here is a glyph in the FREE icon set (`@styloviz/icons`), so a
 *   free install draws them all. `sv-file-tree` registers exactly these, and a
 *   host that wants a different mapping passes `iconFor`.
 */

/** A glyph name `svFileIconName` can return. */
export type SvFileIconName =
  | 'folder'
  | 'file'
  | 'file-text'
  | 'file-archive'
  | 'file-audio'
  | 'file-video'
  | 'file-spreadsheet'
  | 'image'
  | 'database'
  | 'settings'
  | 'lock'
  | 'package'
  | 'npm'
  | 'docker'
  | 'typescript';

const BY_FILE_NAME: Readonly<Record<string, SvFileIconName>> = {
  'package.json': 'npm',
  'package-lock.json': 'lock',
  'yarn.lock': 'lock',
  'pnpm-lock.yaml': 'lock',
  'bun.lockb': 'lock',
  dockerfile: 'docker',
  'docker-compose.yml': 'docker',
  'docker-compose.yaml': 'docker',
  'compose.yaml': 'docker',
  '.gitignore': 'settings',
  '.editorconfig': 'settings',
  '.npmrc': 'settings',
  '.env': 'lock',
};

const BY_EXTENSION: Readonly<Record<string, SvFileIconName>> = {
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  md: 'file-text', mdx: 'file-text', txt: 'file-text', rst: 'file-text', pdf: 'file-text', doc: 'file-text', docx: 'file-text', rtf: 'file-text',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image', webp: 'image', avif: 'image', ico: 'image', bmp: 'image',
  mp4: 'file-video', mov: 'file-video', webm: 'file-video', mkv: 'file-video', avi: 'file-video',
  mp3: 'file-audio', wav: 'file-audio', ogg: 'file-audio', flac: 'file-audio', m4a: 'file-audio',
  zip: 'file-archive', tar: 'file-archive', gz: 'file-archive', tgz: 'file-archive', rar: 'file-archive', '7z': 'file-archive', bz2: 'file-archive',
  csv: 'file-spreadsheet', tsv: 'file-spreadsheet', xls: 'file-spreadsheet', xlsx: 'file-spreadsheet', ods: 'file-spreadsheet',
  sql: 'database', db: 'database', sqlite: 'database', prisma: 'database',
  yml: 'settings', yaml: 'settings', toml: 'settings', ini: 'settings', conf: 'settings', cfg: 'settings',
  pem: 'lock', key: 'lock', crt: 'lock', lock: 'lock',
  whl: 'package', jar: 'package', nupkg: 'package',
};

/**
 * The glyph for a node: `folder` for a folder, otherwise by exact file name
 * (`package.json`, `Dockerfile`, `.env`), then by extension, then `file`.
 * Case-insensitive; `.env.local` reads as `.env`.
 */
export function svFileIconName(name: string, kind: 'file' | 'folder'): SvFileIconName {
  if (kind === 'folder') return 'folder';
  const lower = name.trim().toLowerCase();
  const exact = BY_FILE_NAME[lower] ?? (lower.startsWith('.env.') ? BY_FILE_NAME['.env'] : undefined);
  if (exact) return exact;
  const dot = lower.lastIndexOf('.');
  if (dot <= 0) return 'file';
  return BY_EXTENSION[lower.slice(dot + 1)] ?? 'file';
}

/** Tone per glyph — a quiet tint that keeps 3:1 on both themes' surfaces. */
export function svFileIconClass(icon: SvFileIconName): string {
  switch (icon) {
    case 'folder':
      return 'text-warning-700 dark:text-warning-400';
    case 'typescript':
      return 'text-primary-600 dark:text-primary-400';
    case 'image':
    case 'file-video':
    case 'file-audio':
      return 'text-accent-700 dark:text-accent-400';
    case 'file-spreadsheet':
    case 'database':
      return 'text-info-700 dark:text-info-400';
    case 'npm':
    case 'lock':
      return 'text-danger-600 dark:text-danger-400';
    default:
      return 'text-gray-500 dark:text-gray-400';
  }
}

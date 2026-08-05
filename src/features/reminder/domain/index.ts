// Reminder domain -- pure calendar math + the preferences codec. Depends on
// nothing but `@/types` (CLAUDE.md §3): zero I/O, zero clock reads inside
// `nextFireDate`, zero native dependencies anywhere in this folder.

export * from './nextFireDate';
export * from './preferences';

import { describe, it, expectTypeOf } from 'vitest';
import type { NoteSource, SourceCapabilities, SourceKind, SourceIconKey } from './types';
import type { NoteItem } from '../notes.svelte';

// Type-level smoke test — ensures the module compiles and exports the expected shape.
// Runtime assertions are not needed; these are compile-time checks verified by vitest's
// type checker when run with --typecheck, and at minimum by the project's `npm run check`.
describe('NoteSource types', () => {
	it('NoteSource has the expected shape', () => {
		expectTypeOf<NoteSource['id']>().toEqualTypeOf<string>();
		expectTypeOf<NoteSource['kind']>().toEqualTypeOf<SourceKind>();
		expectTypeOf<NoteSource['title']>().toEqualTypeOf<string>();
		expectTypeOf<NoteSource['iconKey']>().toEqualTypeOf<SourceIconKey>();
		expectTypeOf<NoteSource['capabilities']>().toEqualTypeOf<SourceCapabilities>();
		expectTypeOf<NoteSource['getNotes']>().returns.toEqualTypeOf<NoteItem[]>();
		expectTypeOf<NoteSource['getCount']>().returns.toEqualTypeOf<number>();
		expectTypeOf<NoteSource['getChildren']>().returns.toEqualTypeOf<string[]>();
	});

	it('SourceCapabilities has the expected boolean flags', () => {
		expectTypeOf<SourceCapabilities>().toEqualTypeOf<{
			canRename: boolean;
			canDelete: boolean;
			canCreateSubfolder: boolean;
			canCreateNote: boolean;
			showsDeletedNotes: boolean;
		}>();
	});

	it('SourceKind is a union of folder and view', () => {
		expectTypeOf<SourceKind>().toEqualTypeOf<'folder' | 'view'>();
	});
});

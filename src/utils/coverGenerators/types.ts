import type { ShelfBook } from '@/stores';

export interface BuiltinCoverGeneratorDefinition {
  id: string;
  name: string;
  description: string;
  generate: (book: ShelfBook) => string;
}

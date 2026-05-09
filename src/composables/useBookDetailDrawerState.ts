import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { BookItem } from '@/stores';
import type { BookSourceMeta } from './useBookSource';

interface UseBookDetailDrawerStateOptions {
  sources: Ref<BookSourceMeta[]>;
  onOpenDetail?: (payload: { bookUrl: string; fileName: string; book?: BookItem }) => void;
}

export function useBookDetailDrawerState(options: UseBookDetailDrawerStateOptions) {
  const showDrawer = ref(false);
  const drawerBookUrl = ref('');
  const drawerFileName = ref('');

  function openDetail(book: BookItem, fileName: string) {
    options.onOpenDetail?.({
      bookUrl: book.bookUrl,
      fileName,
      book,
    });
    drawerBookUrl.value = book.bookUrl;
    drawerFileName.value = fileName;
    showDrawer.value = true;
  }

  function openDetailByUrl(bookUrl: string, fileName: string) {
    options.onOpenDetail?.({
      bookUrl,
      fileName,
    });
    drawerBookUrl.value = bookUrl;
    drawerFileName.value = fileName;
    showDrawer.value = true;
  }

  const drawerSourceName: ComputedRef<string> = computed(() => {
    const source = options.sources.value.find((item) => item.fileName === drawerFileName.value);
    return source?.name ?? drawerFileName.value;
  });

  const drawerSourceType: ComputedRef<string> = computed(() => {
    const source = options.sources.value.find((item) => item.fileName === drawerFileName.value);
    return source?.sourceType ?? 'novel';
  });

  return {
    showDrawer,
    drawerBookUrl,
    drawerFileName,
    drawerSourceName,
    drawerSourceType,
    openDetail,
    openDetailByUrl,
  };
}

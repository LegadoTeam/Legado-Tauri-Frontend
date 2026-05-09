<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { eventEmit } from '@/composables/useEventBus';
import {
  installLegadoDeepLinkListener,
  parseLegadoBookSourceUrl,
} from '@/composables/useLegadoDeepLink';
import BookSourceInstallDialog from './BookSourceInstallDialog.vue';

const queue: string[] = [];
const show = ref(false);
const currentDownloadUrl = ref('');
const currentRawLink = ref('');
const currentParseError = ref('');

let unlisten: (() => void) | null = null;

function enqueueLinks(urls: string[]) {
  for (const url of urls) {
    if (url?.trim()) {
      queue.push(url);
    }
  }
  void openNext();
}

function openNext() {
  if (show.value) return;
  const next = queue.shift();
  if (!next) return;

  currentRawLink.value = next;
  currentParseError.value = '';
  currentDownloadUrl.value = '';
  try {
    currentDownloadUrl.value = parseLegadoBookSourceUrl(next);
  } catch (e: unknown) {
    currentParseError.value = e instanceof Error ? e.message : String(e);
  }
  show.value = true;
}

function onUpdateShow(visible: boolean) {
  show.value = visible;
  if (!visible) {
    void openNext();
  }
}

async function onInstalled() {
  await eventEmit('app:view-reload', { view: 'booksource', reason: 'deep-link-install' });
}

onMounted(async () => {
  unlisten = await installLegadoDeepLinkListener(enqueueLinks);
});

onUnmounted(() => {
  unlisten?.();
  unlisten = null;
});
</script>

<template>
  <BookSourceInstallDialog
    :show="show"
    :download-url="currentDownloadUrl"
    :raw-link="currentRawLink"
    :parse-error="currentParseError"
    @update:show="onUpdateShow"
    @installed="onInstalled"
  />
</template>

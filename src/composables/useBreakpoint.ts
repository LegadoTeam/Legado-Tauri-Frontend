import { computed, onMounted, onUnmounted, ref } from 'vue';

export type Breakpoint = 'compact' | 'medium' | 'expanded' | 'wide';

const width = ref(typeof window === 'undefined' ? 0 : window.innerWidth);

function getBreakpoint(value: number): Breakpoint {
  if (value >= 1200) return 'wide';
  if (value >= 840) return 'expanded';
  if (value >= 600) return 'medium';
  return 'compact';
}

export function useBreakpoint() {
  function update() {
    width.value = window.innerWidth;
  }

  onMounted(() => {
    update();
    window.addEventListener('resize', update, { passive: true });
  });

  onUnmounted(() => {
    window.removeEventListener('resize', update);
  });

  const breakpoint = computed(() => getBreakpoint(width.value));
  const isCompact = computed(() => breakpoint.value === 'compact');
  const isMediumUp = computed(() => width.value >= 600);
  const isExpandedUp = computed(() => width.value >= 840);
  const isWide = computed(() => width.value >= 1200);

  return {
    width,
    breakpoint,
    isCompact,
    isMediumUp,
    isExpandedUp,
    isWide,
  };
}

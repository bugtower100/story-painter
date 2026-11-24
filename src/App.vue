<script setup lang="ts">
import Main from "~/Main.vue";
import { darkTheme, lightTheme } from "naive-ui";
import type { GlobalThemeOverrides } from 'naive-ui';
import { computed } from 'vue';

import { useDark } from '@vueuse/core'

const isDark = useDark({ disableTransition: false })
const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    primaryColor: isDark.value ? '#bba0e8' : '#7653ad',
    primaryColorHover: isDark.value ? '#cdb8ed' : '#8864bd',
    primaryColorPressed: isDark.value ? '#a88ad6' : '#63428f',
    primaryColorSuppl: '#7653ad',
    bodyColor: isDark.value ? '#15111e' : '#f5f2f8',
    cardColor: isDark.value ? '#211a2e' : '#fdfcfe',
    modalColor: isDark.value ? '#211a2e' : '#fdfcfe',
    popoverColor: isDark.value ? '#292036' : '#fdfcfe',
    inputColor: isDark.value ? '#1b1526' : '#ffffff',
    borderColor: isDark.value ? '#40324f' : '#e5dbed',
    textColorBase: isDark.value ? '#eee7f8' : '#34283f',
    textColor1: isDark.value ? '#eee7f8' : '#34283f',
    textColor2: isDark.value ? '#d7cbe6' : '#51445f',
    textColor3: isDark.value ? '#b6a6c9' : '#82738f',
    borderRadius: '8px',
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
}))
</script>

<template>
  <n-config-provider :theme="isDark ? darkTheme : lightTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-modal-provider>
        <n-notification-provider>
          <Main/>
        </n-notification-provider>
      </n-modal-provider>
    </n-message-provider>
  </n-config-provider>
</template>

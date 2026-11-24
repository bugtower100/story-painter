<script setup lang="ts">
import Main from "~/Main.vue";
import { darkTheme, lightTheme } from "naive-ui";
import type { GlobalThemeOverrides } from 'naive-ui';
import { computed } from 'vue';

import { useDark } from '@vueuse/core'

const isDark = useDark({ disableTransition: false })
const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    primaryColor: isDark.value ? '#d0afe0' : '#815996',
    primaryColorHover: isDark.value ? '#d8bde1' : '#92749e',
    primaryColorPressed: isDark.value ? '#b28fc0' : '#6e527a',
    primaryColorSuppl: '#815996',
    bodyColor: isDark.value ? '#201925' : '#f2edf6',
    cardColor: isDark.value ? '#2c2234' : '#fcf9fd',
    modalColor: isDark.value ? '#2c2234' : '#fcf9fd',
    popoverColor: isDark.value ? '#30342c' : '#fcf9fd',
    inputColor: isDark.value ? '#251d2d' : '#fcf9fd',
    borderColor: isDark.value ? '#4b3b59' : '#dcd0e5',
    textColorBase: isDark.value ? '#efede3' : '#493e53',
    textColor1: isDark.value ? '#efede3' : '#493e53',
    textColor2: isDark.value ? '#d9dbcd' : '#5b5e50',
    textColor3: isDark.value ? '#c0b0cc' : '#75647f',
    borderRadius: '8px',
    fontSize: '14px',
    fontSizeSmall: '13px',
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  Button: {
    textColorPrimary: isDark.value ? '#28232b' : '#ffffff',
    textColorHoverPrimary: isDark.value ? '#28232b' : '#ffffff',
    textColorPressedPrimary: isDark.value ? '#28232b' : '#ffffff',
  },
  Switch: { railColorActive: isDark.value ? '#a8b783' : '#7c885f' },
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

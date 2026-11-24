<template>
  <span class="sp-wisteria" aria-hidden="true">
    <img :src="imageUrl" alt="" width="1513" height="1919" draggable="false" decoding="async" />
  </span>
</template>

<script setup lang="ts">
// User-supplied transparent original, kept unmodified.
// Karen Arnold / Public Domain Pictures, CC0:
// https://www.publicdomainpictures.net/en/view-image.php?image=451823&picture=wisteria-art-illustration-clipart
const imageUrl = import.meta.env.BASE_URL + 'wisteria-art-illustration-clipart.png'
</script>

<script setup lang="ts">
const clusters = [
  { x: 28, y: 9, length: 7, scale: .8 }, { x: 66, y: 5, length: 10, scale: .9 },
  { x: 109, y: 13, length: 8, scale: 1 }, { x: 154, y: 4, length: 12, scale: 1 },
  { x: 205, y: 17, length: 9, scale: .95 }, { x: 251, y: 3, length: 14, scale: 1.1 },
  { x: 300, y: 12, length: 10, scale: .9 }, { x: 340, y: 0, length: 16, scale: 1 },
]
</script>

<template>
  <svg class="sp-wisteria" viewBox="0 0 380 255" fill="none" aria-hidden="true">
    <defs><linearGradient id="wisteria-petal" x2=".8" y2="1"><stop stop-color="#ad90dc"/><stop offset="1" stop-color="#65438d"/></linearGradient></defs>
    <path d="M4 7Q91-9 165 11T380 1" stroke="#817b9b" stroke-width="2"/>
    <g v-for="(cluster, index) in clusters" :key="index" :transform="`translate(${cluster.x} ${cluster.y}) scale(${cluster.scale})`">
      <path :d="`M0 0Q-10 ${cluster.length * 7} 1 ${cluster.length * 14}`" stroke="#9385a7" stroke-width=".8"/>
      <g v-for="n in cluster.length" :key="n" :transform="`translate(${Math.sin(n) * 3} ${n * 13}) scale(${1 - n / (cluster.length + 3) * .65})`">
        <ellipse cx="-7" cy="0" rx="6" ry="10" transform="rotate(-38 -7 0)" fill="url(#wisteria-petal)" opacity=".8"/>
        <ellipse cx="6" cy="5" rx="5.5" ry="10" transform="rotate(32 6 5)" fill="url(#wisteria-petal)" opacity=".6"/>
        <ellipse cx="0" cy="9" rx="4" ry="8" fill="#c7a8e7" opacity=".8"/>
      </g>
      <path d="M0 3Q-24-12-21 12Q-12 20 0 3M0 3Q21-12 24 0Q21 10 0 3" fill="#8a8f9d" opacity=".45"/>
    </g>
    <ellipse cx="115" cy="190" rx="3" ry="7" fill="#ac8bcd" opacity=".5" transform="rotate(30 115 190)"/>
    <ellipse cx="295" cy="237" rx="3" ry="7" fill="#ac8bcd" opacity=".5" transform="rotate(-30 295 237)"/>
  </svg>
</template>

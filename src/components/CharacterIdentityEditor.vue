<template>
  <div class="sp-identity-editor">
    <label><span>名字</span><n-input v-model:value="name" size="small" :input-props="{ 'aria-label': '角色名称' }" @keydown.enter.prevent="save" @keydown.esc="reset" /></label>
    <label><span>ID</span><n-input v-model:value="account" size="small" :input-props="{ 'aria-label': '角色 ID' }" @keydown.enter.prevent="save" @keydown.esc="reset" /></label>
    <div v-if="changed" class="sp-identity-actions"><button class="sp-text-button" @click="save">保存</button><button class="sp-text-button" @click="reset">取消</button></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CharItem } from '../logManager/types'
const props = defineProps<{ character: CharItem }>()
const emit = defineEmits<{ save: [name: string, account: string] }>()
const name = ref(props.character.name), account = ref(props.character.IMUserId)
const changed = computed(() => name.value !== props.character.name || account.value !== props.character.IMUserId)
const reset = () => { name.value = props.character.name; account.value = props.character.IMUserId }
const save = () => { if (changed.value) emit('save', name.value, account.value) }
watch(() => [props.character.name, props.character.IMUserId], reset)
</script>

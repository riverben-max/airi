<script setup lang="ts">
import { estimateTokens } from '@proj-airi/stage-shared'
import { MarkdownRenderer } from '@proj-airi/stage-ui/components'
import { useMemoryLifetimeStore } from '@proj-airi/stage-ui/stores/memory-lifetime'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'

import LifetimeHistoryModal from './components/LifetimeHistoryModal.vue'
import LifetimeProvisioningModal from './components/LifetimeProvisioningModal.vue'

const airiCardStore = useAiriCardStore()
const { activeCardId, cards } = storeToRefs(airiCardStore)
const lifetimeStore = useMemoryLifetimeStore()
const { artifacts, isProvisioning } = storeToRefs(lifetimeStore)

// --- Local State ---
const showSourceModal = ref(false)
const showHistoryModal = ref(false)
const showLifetimeModal = ref(false)
const autoHandoff = ref(true)

const activeCharacterArtifact = computed(() => {
  if (!activeCardId.value)
    return null
  return artifacts.value.get(activeCardId.value) || null
})

const isProvisioned = computed(() => !!activeCharacterArtifact.value)

const activeCard = computed(() => {
  if (!activeCardId.value)
    return null
  return cards.value.get(activeCardId.value) || null
})

const artifactTokens1k = computed(() => {
  const content = activeCharacterArtifact.value?.distilledContent
  return content ? estimateTokens(content) : 0
})

const artifactTokens7k = computed(() => {
  const content = activeCharacterArtifact.value?.baseContent
  return content ? estimateTokens(content) : 0
})

const threadStatus = computed(() => [
  { label: '记忆核心已激活', icon: 'i-solar:dna-bold-duotone' },
  { label: `档案：${activeCharacterArtifact.value?.metadata?.chunkCount || 0} 个片段`, icon: 'i-solar:layers-bold-duotone' },
  {
    label: activeCharacterArtifact.value?.chunkSummaries?.length ? '基础记忆：正常' : '基础记忆：缺失',
    icon: activeCharacterArtifact.value?.chunkSummaries?.length ? 'i-solar:database-bold-duotone' : 'i-solar:database-minimalistic-bold-duotone',
  },
])

async function loadData() {
  if (activeCardId.value) {
    await lifetimeStore.loadForCharacter(activeCardId.value)
  }
}

watch(activeCardId, () => loadData(), { immediate: true })
onMounted(() => loadData())
</script>

<template>
  <div class="font-urbanist relative flex flex-col gap-8 pb-12">
    <!-- Breadcrumb Nav -->
    <nav class="flex items-center gap-2 text-xs text-neutral-500 font-bold tracking-widest uppercase dark:text-neutral-400">
      <router-link to="/settings/memory" class="transition-colors hover:text-primary-500">
        记忆中心
      </router-link>
      <div class="i-solar:alt-arrow-right-bold h-3 w-3" />
      <span class="text-neutral-400 dark:text-neutral-500">终身记忆</span>
    </nav>

    <!-- Bespoke Header -->
    <header class="relative overflow-hidden border border-neutral-200 rounded-3xl bg-neutral-100/40 p-8 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/40">
      <div class="absolute h-64 w-64 bg-amber-500/10 blur-3xl -right-24 -top-24" />
      <div class="absolute h-64 w-64 bg-orange-500/10 blur-3xl -bottom-24 -left-24" />

      <div class="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="flex flex-col gap-2">
          <div class="h-16 w-16 flex items-center justify-center rounded-2xl bg-amber-500/20 text-4xl text-amber-500 shadow-inner">
            <div class="i-solar:dna-bold-duotone inline-block" />
          </div>
          <h1 class="text-4xl text-neutral-800 font-bold tracking-tight dark:text-neutral-100">
            终身记忆
          </h1>
          <p class="max-w-2xl text-lg text-neutral-500 line-height-relaxed dark:text-neutral-400">
            关系的长期记忆。它会将每日变化沉淀为持久身份，让关系在重置后依然稳定。
          </p>
        </div>

        <div v-if="isProvisioned" class="flex flex-col items-end gap-2">
          <div class="flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs text-emerald-700 font-bold dark:text-emerald-400">
            <div class="i-solar:check-circle-bold-duotone text-base" />
            角色已订阅
          </div>
          <Button label="更换角色" icon="i-solar:users-group-two-rounded-bold-duotone" variant="secondary" />
        </div>
      </div>

      <!-- Thread Status Strip -->
      <div v-if="isProvisioned" class="mt-8 flex flex-wrap gap-3">
        <div
          v-for="chip in threadStatus"
          :key="chip.label"
          class="flex items-center gap-2 border border-neutral-200/50 rounded-full bg-white/50 px-4 py-2 text-xs font-bold tracking-tight uppercase shadow-sm dark:border-neutral-700/50 dark:bg-neutral-800/50 dark:text-neutral-200"
        >
          <div :class="[chip.icon, 'text-amber-500 text-base']" />
          {{ chip.label }}
        </div>
      </div>
    </header>

    <!-- STATE A: Character Unprovisioned -->
    <section v-if="!isProvisioned && !isProvisioning" class="relative overflow-hidden border border-amber-500/20 rounded-[2.5rem] bg-amber-500/5 p-12 text-center dark:border-amber-500/10">
      <div class="mx-auto mb-6 h-20 w-20 flex items-center justify-center rounded-3xl bg-amber-500/10 text-5xl text-amber-500">
        <div class="i-solar:link-break-bold-duotone" />
      </div>
      <h2 class="mb-2 text-3xl text-neutral-800 font-bold dark:text-neutral-100">
        永久身份未启用
      </h2>
      <p class="mx-auto mb-8 max-w-lg text-neutral-500 dark:text-neutral-400">
        <span class="text-neutral-700 font-bold dark:text-neutral-200">{{ activeCard?.name || '当前角色' }}</span> 尚未启用终身记忆。启用后，系统会将每日对话沉淀为长期角色记忆。
      </p>
      <Button label="启用终身记忆" variant="primary" size="lg" icon="i-solar:plug-circle-bold-duotone" @click="showLifetimeModal = true" />
    </section>

    <!-- STATE B: Character Provisioned (The Terminal) -->
    <div v-if="isProvisioned" class="flex flex-col gap-8">
      <!-- The Trinity Cards -->
      <div class="grid gap-6 lg:grid-cols-3">
        <section class="border border-neutral-200 rounded-3xl bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
          <div class="mb-4 h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/10 text-xl text-amber-500">
            <div class="i-solar:shield-user-bold-duotone" />
          </div>
          <h3 class="mb-2 text-xl text-neutral-800 font-bold dark:text-neutral-100">
            核心羁绊
          </h3>
          <p class="mb-6 text-sm text-neutral-500 italic dark:text-neutral-400">
            稳定的人格基线，不会因会话重置而消失。
          </p>
          <ul class="flex flex-col gap-3">
            <li v-for="item in ['稳定身份基准', '跨会话连续性', '持久主题追踪']" :key="item" class="flex items-center gap-3 text-sm text-neutral-700 font-medium dark:text-neutral-300">
              <div class="i-solar:check-circle-bold-duotone text-amber-500" />
              {{ item }}
            </li>
          </ul>
        </section>

        <section class="border border-neutral-200 rounded-3xl bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
          <div class="mb-4 h-10 w-10 flex items-center justify-center rounded-xl bg-orange-500/10 text-xl text-orange-500">
            <div class="i-solar:history-bold-duotone" />
          </div>
          <h3 class="mb-2 text-xl text-neutral-800 font-bold dark:text-neutral-100">
            每日更新
          </h3>
          <p class="mb-6 text-sm text-neutral-500 italic dark:text-neutral-400">
            借助 24 小时 STMM 周期整合有意义的会话变化。
          </p>
          <ul class="flex flex-col gap-3">
            <li v-for="item in ['增量记忆整合', '短期记忆周期衔接', '自动处理记忆冲突']" :key="item" class="flex items-center gap-3 text-sm text-neutral-700 font-medium dark:text-neutral-300">
              <div class="i-solar:add-circle-bold-duotone text-orange-500" />
              {{ item }}
            </li>
          </ul>
        </section>

        <section class="border border-neutral-200 rounded-3xl bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
          <div class="mb-4 h-10 w-10 flex items-center justify-center rounded-xl bg-primary-500/10 text-xl text-primary-500">
            <div class="i-solar:lock-bold-duotone" />
          </div>
          <h3 class="mb-2 text-xl text-neutral-800 font-bold dark:text-neutral-100">
            稳定性守护
          </h3>
          <p class="mb-6 text-sm text-neutral-500 italic dark:text-neutral-400">
            监控异常的身份漂移，确保长期羁绊完整。
          </p>
          <ul class="flex flex-col gap-3">
            <li v-for="item in ['关系完整性监控', '人格特征保护', '持久历史档案']" :key="item" class="flex items-center gap-3 text-sm text-neutral-700 font-medium dark:text-neutral-300">
              <div class="i-solar:security-safe-bold-duotone text-primary-500" />
              {{ item }}
            </li>
          </ul>
        </section>
      </div>

      <!-- HERO: The 1k Soul Blueprint -->
      <section v-if="activeCharacterArtifact" class="relative overflow-hidden border border-amber-500/20 rounded-[2.5rem] bg-amber-500/5 p-1 px-1 shadow-2xl dark:border-amber-500/10">
        <div class="rounded-[2.2rem] bg-white p-10 dark:bg-neutral-900/90">
          <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/10 text-xl text-amber-500">
                <div class="i-solar:dna-bold-duotone" />
              </div>
              <div>
                <h2 class="text-2xl text-neutral-800 font-bold dark:text-neutral-100">
                  核心记忆线索
                </h2>
                <p class="text-sm text-neutral-500 italic dark:text-neutral-400">
                  这是 AIRI 重新加载时使用的 1k 提炼记忆。
                </p>
              </div>
            </div>
          </div>

          <div class="relative overflow-hidden border border-neutral-200 rounded-2xl bg-neutral-50/50 p-6 leading-relaxed dark:border-neutral-800 dark:bg-black/20">
            <div class="absolute right-4 top-4 text-4xl text-amber-500/10">
              <div class="i-solar:quotation-mark-bold-duotone" />
            </div>
            <div class="text-lg text-neutral-700 leading-loose dark:text-neutral-200">
              <MarkdownRenderer :content="activeCharacterArtifact.distilledContent" />
            </div>
          </div>

          <div class="mt-6 flex flex-wrap items-center justify-between gap-6">
            <div class="flex items-center gap-6">
              <div class="flex flex-col">
                <span class="text-[10px] text-neutral-500 tracking-tighter uppercase">提炼后的记忆档案</span>
                <span class="text-sm text-neutral-800 font-bold dark:text-neutral-200">约 {{ artifactTokens1k }} Token</span>
              </div>
              <div class="h-8 w-px bg-neutral-200 dark:bg-neutral-800" />
              <button
                class="group flex flex-col text-left transition-colors hover:text-primary-500"
                @click="showSourceModal = true"
              >
                <span class="text-[10px] text-neutral-500 tracking-tighter uppercase group-hover:text-primary-400">来源档案（{{ Math.round(artifactTokens7k / 1000) }}k）</span>
                <span class="text-sm text-neutral-800 font-bold underline decoration-dotted dark:text-neutral-200 group-hover:text-primary-500">
                  已浓缩 {{ activeCharacterArtifact.sourceManifest.rawTurnCount }} 个对话回合
                </span>
              </button>
            </div>
            <div class="flex gap-3">
              <Button label="查看记忆历史" variant="secondary" icon="i-solar:history-line-duotone" @click="showHistoryModal = true" />
              <Button label="整合终身记忆" variant="primary" icon="i-solar:restart-bold-duotone" @click="showLifetimeModal = true" />
            </div>
          </div>
        </div>
      </section>

      <!-- Lifecycle Console -->
      <section class="border border-neutral-200 rounded-[2.5rem] bg-white p-10 shadow-xl dark:border-neutral-800 dark:bg-neutral-900/80">
        <h2 class="mb-8 text-2xl text-neutral-800 font-bold dark:text-neutral-100">
          终身记忆控制
        </h2>
        <div class="grid gap-12 lg:grid-cols-2">
          <div class="flex flex-col justify-end">
            <div class="flex items-center gap-3 border border-neutral-200 rounded-2xl bg-neutral-50/50 px-8 py-6 dark:border-neutral-700 dark:bg-neutral-800/40">
              <input id="handoff" v-model="autoHandoff" type="checkbox" class="h-6 w-6 border-neutral-300 rounded text-amber-500">
              <label for="handoff" class="flex flex-col cursor-pointer">
                <span class="text-base text-neutral-700 font-bold dark:text-neutral-200">每日更新交接</span>
                <span class="text-xs text-neutral-500 font-bold tracking-tighter uppercase">每日变化会在午夜合并到记忆线索中</span>
              </label>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- STAGING MODAL: Source Data (7k) Explorer -->
    <div v-if="showSourceModal && activeCharacterArtifact" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div class="shadow-3xl max-w-6xl w-full border border-neutral-200 rounded-[2.5rem] bg-white p-10 dark:border-neutral-800 dark:bg-neutral-900">
        <header class="mb-8 flex items-center justify-between">
          <h3 class="text-2xl text-neutral-800 font-bold dark:text-neutral-100">
            核心记忆：来源查看器
          </h3>
          <Button icon="i-solar:close-circle-bold-duotone" variant="secondary-muted" @click="showSourceModal = false" />
        </header>

        <div class="grid gap-8 md:grid-cols-2">
          <!-- 7k Source (Undistilled) -->
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-neutral-500 font-bold tracking-widest uppercase">未提炼来源（{{ artifactTokens7k }} Token）</span>
            </div>
            <div class="max-h-[500px] flex-1 overflow-y-auto border border-neutral-200 rounded-2xl bg-neutral-50 p-6 text-[13px] text-neutral-600 dark:border-neutral-800 dark:bg-black/20 dark:text-neutral-400">
              <MarkdownRenderer :content="activeCharacterArtifact.baseContent" />
            </div>
          </div>

          <!-- 1k Canonical (Distilled) -->
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-amber-600 font-bold tracking-widest uppercase">提炼精华（{{ artifactTokens1k }} Token）</span>
            </div>
            <div class="max-h-[500px] flex-1 overflow-y-auto border border-amber-500/20 rounded-2xl bg-amber-500/5 p-6 text-[13px] text-neutral-800 dark:border-amber-500/10 dark:bg-amber-500/5 dark:text-neutral-200">
              <MarkdownRenderer :content="activeCharacterArtifact.distilledContent" />
            </div>
          </div>
        </div>

        <footer class="mt-8 border-t border-neutral-100 pt-8 text-center dark:border-neutral-800">
          <p class="mx-auto max-w-xl text-xs text-neutral-500 italic dark:text-neutral-400">
            规范记忆线索由来源档案提炼而来：系统会去除重复主题，并将不稳定的会话变化总结为稳定的人格基线。
          </p>
        </footer>
      </div>
    </div>

    <!-- Lifetime Provisioning Modal -->
    <LifetimeProvisioningModal
      v-if="activeCardId"
      v-model:open="showLifetimeModal"
      :character-id="activeCardId"
    />

    <!-- Lifetime History Modal -->
    <LifetimeHistoryModal
      v-if="activeCardId"
      v-model:open="showHistoryModal"
      :character-id="activeCardId"
    />
  </div>
</template>

<style scoped>
.font-urbanist {
  font-family: 'Urbanist', sans-serif;
  -webkit-font-smoothing: antialiased;
}
</style>

<route lang="yaml">
meta:
  layout: settings
  titleKey: 终身记忆
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>

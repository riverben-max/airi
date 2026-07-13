<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { useRouter } from 'vue-router'

const router = useRouter()

const memorySections = [
  {
    id: 'ephemeral',
    title: '活跃脉冲',
    subtitle: '短期记忆（STMM）',
    description: '保留最近几天的高质量感知和丰富记忆，即使会话重置后也不会丢失。',
    icon: 'i-solar:alarm-bold-duotone',
    accent: 'from-cyan-500/20 to-sky-500/10',
    route: '/settings/modules/memory-short-term',
    status: '活跃中 - 16 回合',
    bullets: [
      '保留最近几天的高质量情境感知',
      '清除历史时保留上下文，实现角色无缝重新加载',
      '每天为活跃角色更新，维持当前记忆窗口',
      '随着对话增长，为智能上下文压缩提供支持',
    ],
  },
  {
    id: 'signals',
    title: '回响',
    subtitle: '梦境状态（记忆片段）',
    description: '当你离开时，AIRI 会将长对话整理为可解读的标签和重点。',
    icon: 'i-solar:bolt-bold-duotone',
    accent: 'from-violet-500/20 to-indigo-500/10',
    route: '/settings/modules/memory-signals',
    status: '空闲时启用',
    bullets: [
      '角色空闲时生成氛围标签和情绪重点',
      '通过离开状态门控，避免主动任务打断正在进行的对话',
      '会话空闲超过 1 小时后提炼重点',
      '每天最多处理 4 个核心对话会话',
    ],
  },
  {
    id: 'episodic',
    title: '守望者日志',
    subtitle: '情节记录（LTMM）',
    description: '珍贵记录。让角色使用“text_journal”将重要时刻永久保存。',
    icon: 'i-solar:notebook-bookmark-bold-duotone',
    accent: 'from-emerald-500/20 to-teal-500/10',
    route: '/settings/modules/memory-long-term',
    status: '已存储 9 条记录',
    bullets: [
      '可让角色按需使用的专用工具',
      '记录并搜索持久、高保真的叙事记忆',
      '为深层语义回忆和关系定位提供支持',
      '以便于阅读的格式保存你的珍贵记录',
    ],
  },
  {
    id: 'relational',
    title: '永恒线索',
    subtitle: '关系本质（终身）',
    description: '关系的长期记忆。它让羁绊在重置后依然稳定，并随着新的重要时刻逐步更新。',
    icon: 'i-solar:dna-bold-duotone',
    accent: 'from-amber-500/20 to-orange-500/10',
    route: '/settings/modules/memory-lifetime',
    status: '基础稳定',
    bullets: [
      '为长周期记忆提供稳定基础',
      '根据新的重要事件增量更新',
      '由基础记忆和每日变化共同更新',
      '在重置后保留关系身份',
    ],
  },
]
</script>

<template>
  <div class="font-urbanist flex flex-col gap-6">
    <!-- Neurological Header -->
    <div class="border border-neutral-200 rounded-3xl bg-neutral-100/40 p-6 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/40">
      <div class="mb-5 flex flex-col gap-4 md:flex-row md:items-center">
        <div class="h-16 w-16 flex items-center justify-center rounded-2xl bg-primary-500/10 shadow-inner">
          <div class="i-solar:star-bold-duotone inline-block text-4xl text-primary-500" />
        </div>
        <div>
          <h1 class="text-2xl text-neutral-800 font-bold dark:text-neutral-100">
            记忆中心
          </h1>
          <p class="max-w-2xl text-sm text-neutral-500 line-height-relaxed dark:text-neutral-400">
            AIRI 的记忆系统分为四个不同的时间象限。通过将短暂反应与长期关系线索分开，我们让身份在对话流动中始终保持稳定。
          </p>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-4">
        <div class="border border-neutral-200/50 rounded-2xl bg-white/50 p-4 transition-all dark:border-neutral-700/50 dark:bg-neutral-900/30 hover:bg-white dark:hover:bg-neutral-900/50">
          <div class="mb-1 text-[10px] text-neutral-400 font-bold tracking-widest uppercase dark:text-neutral-500">
            系统完整性
          </div>
          <div class="flex items-center gap-2 text-sm text-neutral-700 font-semibold dark:text-neutral-200">
            <div class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            98.4%
          </div>
        </div>
        <div class="border border-neutral-200/50 rounded-2xl bg-white/50 p-4 transition-all dark:border-neutral-700/50 dark:bg-neutral-900/30 hover:bg-white dark:hover:bg-neutral-900/50">
          <div class="mb-1 text-[10px] text-neutral-400 font-bold tracking-widest uppercase dark:text-neutral-500">
            总深度
          </div>
          <div class="text-sm text-neutral-700 font-semibold dark:text-neutral-200">
            42,109 Token
          </div>
        </div>
        <div class="border border-neutral-200/50 rounded-2xl bg-white/50 p-4 transition-all dark:border-neutral-700/50 dark:bg-neutral-900/30 hover:bg-white dark:hover:bg-neutral-900/50">
          <div class="mb-1 text-[10px] text-neutral-400 font-bold tracking-widest uppercase dark:text-neutral-500">
            更新逻辑
          </div>
          <div class="text-sm text-neutral-700 font-semibold dark:text-neutral-200">
            基础记忆 + 每日差异
          </div>
        </div>
        <div class="border border-neutral-200/50 rounded-2xl bg-white/50 p-4 transition-all dark:border-neutral-700/50 dark:bg-neutral-900/30 hover:bg-white dark:hover:bg-neutral-900/50">
          <div class="mb-1 text-[10px] text-neutral-400 font-bold tracking-widest uppercase dark:text-neutral-500">
            架构
          </div>
          <div class="text-sm text-neutral-700 font-semibold dark:text-neutral-200">
            以角色为中心
          </div>
        </div>
      </div>
    </div>

    <!-- The Four Quads -->
    <div class="grid gap-4 lg:grid-cols-2 md:grid-cols-2">
      <section
        v-for="section in memorySections"
        :key="section.id"
        class="group relative overflow-hidden border border-neutral-200 rounded-3xl bg-white p-6 shadow-sm transition-all dark:border-neutral-800 dark:bg-neutral-900/60 hover:shadow-xl"
      >
        <!-- Background Accent Glow -->
        <div :class="['absolute -right-4 -top-4 h-32 w-32 rounded-full bg-gradient-to-br blur-3xl opacity-20 transition-all group-hover:opacity-40', section.accent]" />

        <div class="relative z-10 h-full flex flex-col">
          <div class="mb-6 flex items-start justify-between">
            <div :class="['h-12 w-12 flex items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm', section.accent]">
              <div :class="[section.icon, 'text-2xl text-primary-500 inline-block']" />
            </div>
            <div :class="['flex items-center gap-1.5 border border-neutral-200/50 rounded-full bg-neutral-50 px-3 py-1 text-[10px] font-bold tracking-tight uppercase dark:border-neutral-700/50 dark:bg-neutral-800/50', section.id === 'ephemeral' ? 'text-cyan-500' : section.id === 'relational' ? 'text-amber-500' : section.id === 'signals' ? 'text-violet-500' : 'text-emerald-500']">
              <div :class="['h-1.5 w-1.5 rounded-full', section.id === 'ephemeral' ? 'animate-ping bg-cyan-500' : section.id === 'relational' ? 'bg-amber-500' : section.id === 'signals' ? 'bg-violet-500' : 'bg-emerald-500']" />
              {{ section.status }}
            </div>
          </div>

          <div class="mb-4">
            <h3 class="text-xs text-neutral-400 font-bold tracking-widest uppercase dark:text-neutral-500">
              {{ section.subtitle }}
            </h3>
            <h2 class="mb-1 text-xl text-neutral-800 font-bold dark:text-neutral-100">
              {{ section.title }}
            </h2>
            <p class="text-sm text-neutral-500 line-height-relaxed dark:text-neutral-400">
              {{ section.description }}
            </p>
          </div>

          <div class="mb-8 flex-grow">
            <ul class="grid gap-2.5">
              <li
                v-for="bullet in section.bullets"
                :key="bullet"
                class="flex items-center gap-2.5 text-sm text-neutral-600 dark:text-neutral-300"
              >
                <div class="i-solar:check-circle-bold-duotone text-lg text-primary-500/60" />
                {{ bullet }}
              </li>
            </ul>
          </div>

          <div class="mt-auto border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <Button
              :label="`查看${section.title}`"
              icon="i-solar:arrow-right-up-bold-duotone"
              variant="secondary"
              block
              class="group/btn"
              @click="router.push(section.route)"
            />
          </div>
        </div>
      </section>
    </div>

    <!-- Handoff Note (Review Goal) -->
    <div class="mt-4 border border-primary-500/20 rounded-3xl border-dashed bg-primary-500/5 p-6 dark:border-primary-400/20 dark:bg-primary-400/5">
      <div class="mb-3 flex items-center gap-3">
        <div class="i-solar:star-bold-duotone text-xl text-primary-500" />
        <h3 class="text-sm text-primary-600 font-bold tracking-wide uppercase dark:text-primary-400">
          核心交接说明
        </h3>
      </div>
      <p class="max-w-3xl text-sm text-neutral-700 line-height-relaxed dark:text-neutral-200">
        这套象限设计验证了记忆引擎的呈现结构。它将流动的会话上下文（脉冲）与跨越关系的长期本质（永恒线索）分开；信号象限明确受空闲主动性规则约束，避免在活跃对话期间出现语义漂移。
      </p>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.memory.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.memory.description
  icon: i-solar:leaf-bold-duotone
  settingsEntry: true
  order: 5
  stageTransition:
    name: slide
</route>

<script setup lang="ts">
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useSettingsUserProfile } from '@proj-airi/stage-ui/stores/settings/user-profile'
import { Button, Select } from '@proj-airi/ui'
import { computed, ref } from 'vue'

import VoiceCreatorModal from '../airi-card/components/VoiceCreatorModal.vue'

const userProfileStore = useSettingsUserProfile()
const speechStore = useSpeechStore()

const showVoiceCreator = ref(false)

const voiceOptions = computed(() => {
  const list = [
    { value: '', label: '无语音配置' },
  ]
  speechStore.savedVoiceProfiles
    .filter(p => p.id !== 'voice_profile_auto_preview')
    .forEach((p) => {
      list.push({ value: p.id, label: p.name })
    })
  return list
})
</script>

<template>
  <div rounded-lg bg-neutral-50 p-6 dark:bg-neutral-800 flex="~ col gap-6">
    <!-- User Name -->
    <div class="flex flex-col gap-2">
      <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">用户显示名称</label>
      <input
        v-model="userProfileStore.name"
        type="text"
        placeholder="例如：管理员"
        class="w-full border border-neutral-200 rounded-xl bg-white px-4 py-2 text-sm text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
      >
      <p class="text-[10px] text-neutral-400 italic">
        导入角色卡和创作者剧情脚本默认使用的昵称，除非另有设置。
      </p>
    </div>

    <!-- Narrative Description -->
    <div class="flex flex-col gap-2">
      <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">叙事描述</label>
      <textarea
        v-model="userProfileStore.description"
        rows="3"
        placeholder="一位负责协调角色的安静管理者……"
        class="w-full border border-neutral-200 rounded-xl bg-white px-4 py-2 text-sm text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
      />
      <p class="text-[10px] text-neutral-400 italic">
        用简短文字帮助认知和剧情模型理解你的外貌描述与性格角色。
      </p>
    </div>

    <!-- Image Prompt Tags -->
    <div class="flex flex-col gap-2">
      <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">视觉提示词标签</label>
      <textarea
        v-model="userProfileStore.prompt"
        rows="3"
        placeholder=", 短黑发，眼镜，正式灰色商务套装"
        class="w-full border border-neutral-200 rounded-xl bg-white px-4 py-2 text-sm text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
      />
      <p class="text-[10px] text-neutral-400 italic">
        生成代表你的场景图片时注入的 Stable Diffusion / ComfyUI 提示词标签。
      </p>
    </div>

    <!-- Speech Vocal Profile Select -->
    <div class="flex flex-col gap-2">
      <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">语音配置</label>
      <div class="flex items-center gap-2">
        <Select v-model="userProfileStore.voiceProfileId" :options="voiceOptions" class="flex-1" />
        <Button
          variant="secondary"
          type="button"
          class="h-[38px] flex items-center gap-1.5 border border-neutral-200 px-3 text-xs font-bold dark:border-neutral-700"
          title="创建自定义语音配置"
          @click.prevent="showVoiceCreator = true"
        >
          <span class="i-solar:music-notes-bold-duotone text-sm" />
          创建自定义语音
        </Button>
      </div>
      <p class="text-[10px] text-neutral-400 italic">
        在悬浮视图中朗读或讲述制作人选项建议时使用的语音配置。
      </p>
    </div>

    <!-- Background Decoration -->
    <div
      v-motion
      text="neutral-200/50 dark:neutral-600/20" pointer-events-none
      fixed top="[65dvh]" right--15 z--1
      :initial="{ scale: 0.9, opacity: 0, rotate: 30 }"
      :enter="{ scale: 1, opacity: 1, rotate: 0 }"
      :duration="250"
      flex items-center justify-center
    >
      <div text="60" i-solar:user-bold-duotone />
    </div>

    <!-- Voice Creator Modal -->
    <VoiceCreatorModal
      v-model="showVoiceCreator"
      character-name="User"
      @save="(payload) => {
        userProfileStore.voiceProfileId = payload.baseVoice
      }"
    />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.system.user-profile.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>

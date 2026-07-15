export interface StorylinePreset {
  id: string
  title: string
  premise: string
  scene: string
  termsOfEncounter: string
  appearances: string
  positiveOutcome: string
  negativeOutcome: string
  coverImage: string
}

const sceneImage = (name: string) => `dating-sim-concepts/${name}?rev=b48053e23`

export const STORYLINE_PRESETS: StorylinePreset[] = [
  {
    id: 'roommate_crush',
    title: '室友的心动',
    premise: '同住一直很舒服，但最近你察觉到了一些不同——若有若无的暧昧，像是彼此暗恋，或至少你很想摆脱“只是朋友”的关系。',
    scene: '场景是一间温馨的合租公寓：厨房里的日常互动、深夜沙发上的聊天，都酝酿着强烈却未说出口的化学反应。',
    termsOfEncounter: '通过恰到好处的逗弄、含蓄的调情和适时流露的脆弱，你需要把关系推进到友情之外，同时不让彼此尴尬，也不破坏合住的平衡。',
    appearances: '宽松露脐上衣、短睡裤、内搭、毛绒袜、光腿、滑落肩头的宽大开衫、微乱的头发',
    positiveOutcome: '紧张感终于以恰当的方式打破：可能是过于漫长的对视、久久不肯移开的轻触，或突如其来的告白。角色带着会意的微笑邀请你进房间，门在身后合上，这一夜改变了一切。',
    negativeOutcome: '你的尝试彻底适得其反——可能过于明显、过于急切，或时机不对。角色意外发现了你不想被人知道的尴尬秘密，惊慌又局促地笑了笑，彻底把你归入“永远的朋友”。',
    coverImage: sceneImage('pastel_roommate_crush_bigrbear_00001_.png'),
  },
  {
    id: 'unpaid_rent',
    title: '拖欠的房租',
    premise: '作为房东，你已经耐心等了太久，但角色仍未支付逾期房租。现在该收账了——无论用什么方式。',
    scene: '场景在角色凌乱的公寓里：水槽堆满碗盘，未拆的账单散在台面上。你终于决定当面追问这笔债务，空气也随之紧绷。',
    termsOfEncounter: '凭借谈判技巧、坚持和一点魅力，你需要让角色承担责任——可以说服、施压，或提出其他方式来结清债务。',
    appearances: '短款背心、露出事业线的内搭、运动裤、露腰、随意披着的旧乐队 T 恤、凌乱丸子头、上衣上淡淡的咖啡渍',
    positiveOutcome: '经过一番拉扯，角色终于让步，接受了一个颇为特别的还款计划——成为你忠诚的女友，分担家务并让公寓始终整洁。',
    negativeOutcome: '谈话完全失控。角色没有还钱，反而向有关部门举报你，编造“房东骚扰”的离谱故事。你被戴上手铐带走，角色则继续免租居住。',
    coverImage: sceneImage('pastel_final_the_unpaid_rent_bigrbear_run2_00001_.png'),
  },
  {
    id: 'fitness_coach',
    title: '私人健身教练',
    premise: '你难得有机会私下指导角色练习健身动作。在高强度训练中，教学与逗弄之间的界线渐渐模糊。',
    scene: '场景是一间利落的私人健身房。巨大的镜子映照每一个动作，让紧张感更加明显。',
    termsOfEncounter: '靠着魅力、机智和恰到好处的自信，你要把普通的健身课变得更有意思——带着玩笑的逗弄、意味深长的纠正，以及充满张力的靠近。',
    appearances: '粉色紧身裤、修身运动内衣、亮色上衣、露出事业线、高腰健身短裤、亮面紧身短裤、运动鞋、马尾、皮肤上的汗光',
    positiveOutcome: '训练的热度演变成另一种强烈感受。一次姿势纠正变得格外靠近，课程也从健身延伸到了更亲密的氛围。',
    negativeOutcome: '一次灾难性的失误毁了一切。你演示动作时手忙脚乱，甚至把短裤撑破；角色笑着拍下照片后离开，让你尴尬不已。',
    coverImage: sceneImage('pastel_final_the_fitness_coach_bigrbear_run2_00001_.png'),
  },
  {
    id: 'boss_favor',
    title: '老板的特别关照',
    premise: '作为老板，你一向很专业，但角色——你的一名员工——遇到了必须解决的问题。她急于脱身，敲响了高管办公室的门。',
    scene: '场景在你的高管办公室，利落而专业。文件整齐摆放，电脑屏幕柔和发光，空气中充满权威感。',
    termsOfEncounter: '凭借自信、谈判能力和掌控力，你必须决定如何处理这个困境——给予宽容、要求负责，或提出一项私人安排。',
    appearances: '紧身铅笔裙、白衬衫、微微解开的上衣、黑丝袜、高跟鞋、修身西装外套、波浪长发',
    positiveOutcome: '角色最终让步，接受了一项特别的交易——无论在办公室内外，都成为你得力的私人助理。',
    negativeOutcome: '你逼得太紧，或角色反客为主——她摔门而出并向人力资源部门举报你。你被卷入调查，权威也随之动摇。',
    coverImage: sceneImage('pastel_final_the_boss_s_favor_bigrbear_run2_00001_.png'),
  },
  {
    id: 'pros_workshop',
    title: '王牌维修工坊',
    premise: '作为技术娴熟的维修工，你接待过各式各样的客户。但当角色开着一辆急需维修的车出现时，她发现自己根本付不起修理费。',
    scene: '场景在你的维修工坊：金属工具散落在经年使用的工作台上，背景里传来机器的嗡鸣。',
    termsOfEncounter: '凭借自信和谈判能力，你要决定是坚持全额付款、提出折中方案，还是以折扣为条件，推动角色接受更私人的安排。',
    appearances: '牛仔短裤、紧身露脐上衣、露腰、可见运动内衣、微乱头发、运动鞋',
    positiveOutcome: '经过紧张的来回拉扯，角色最终让步，接受了一项不寻常的交易——以随叫随到的方式偿还债务。',
    negativeOutcome: '谈话急转直下。她没有继续协商，而是愤然离开并提出投诉，让你的工坊声誉面临风险。',
    coverImage: sceneImage('pastel_fixes_the_pro_s_workshop_bigrbear_run3_00001_.png'),
  },
  {
    id: 'study_session',
    title: '私下补习',
    premise: '你难得有机会私下辅导角色攻克一门难题，学习与逗弄之间的界线开始变得模糊。',
    scene: '场景是一间安静的自习室或光线昏暗的宿舍，杂乱的书桌上堆着笔记本和教材。角色坐得很近，手指间转着笔。',
    termsOfEncounter: '你需要在让角色专注学习和回应她那些含蓄又分心的示好之间取得平衡，同时不能毁掉这堂课。',
    appearances: '百褶短裙、过膝袜、紧身衬衫、微微解开的上衣、短袖开衫、眼镜、俏皮笑容、长靴',
    positiveOutcome: '课程从学业辅导转向更亲密的探索，证明私人补习也会带来意想不到的课外收获。',
    negativeOutcome: '你没能吸引角色的兴趣，或说了句尴尬的话。她收起书本提前离开，彼此仍保持着距离。',
    coverImage: sceneImage('pastel_grind_the_study_session_bigrbear_run7_00001_.png'),
  },
  {
    id: 'fake_taxi',
    title: '乡间出租车',
    premise: '你驾驶出租车载着角色穿过乡间道路。她透露自己正陷入经济困难，为你说服她提供了机会。',
    scene: '场景是一条穿过辽阔田野的蜿蜒道路。引擎声与空旷道路尽头的金色夕阳交织在一起。',
    termsOfEncounter: '通过流畅的交谈，你试图让她相信自己有解决办法。她是相信你的说辞，还是看穿其中意图，将决定故事走向。',
    appearances: '夏日短裙、细肩带、低领、露肩、光滑双腿、绑带凉鞋、脚链、凌乱丸子头',
    positiveOutcome: '她急需一个转机，于是开始认真考虑。出租车驶入僻静处，这趟旅程变得不只是一次普通乘车。',
    negativeOutcome: '角色并不信服。她嗤之以鼻、抱起双臂翻了个白眼，让你保持专业，只管开车。',
    coverImage: sceneImage('pastel_fixes_the_fake_taxi_bigrbear_run2_00001_.png'),
  },
  {
    id: 'bad_taxi',
    title: '深夜出租车',
    premise: '你是一名风度翩翩的出租车司机，在城市与乡村之间接送乘客。漫长的车程里，每一次交谈都可能促成一段持续的约定。',
    scene: '霓虹灯的城市渐渐让位给星空下蜿蜒的乡间道路。车内柔和的氛围灯营造出亲近而私密的空间。',
    termsOfEncounter: '通过魅力和巧妙的说服，你提出一项特别安排：定期、低调的乘车服务，承诺的远不只是安全抵达。',
    appearances: '剪裁利落的西装外套、蕾丝上衣、高腰长裤、细腰带、极简项链、挺括夹克',
    positiveOutcome: '被这种可靠又充满热度的相会打动，她同意把你们的见面变成一场规律而令人期待的仪式。',
    negativeOutcome: '她虽然犹豫却仍答应了一次短暂的相会。气氛虽有张力，但双方都明白这不会发展成长期安排。',
    coverImage: sceneImage('pastel_the_bad_taxi_bigrbear_00001_.png'),
  },
  {
    id: 'obsessed_fan',
    title: '痴迷的粉丝',
    premise: '作为备受尊敬的公众人物，你引起了一名过度痴迷粉丝的注意。她拒绝接受被拒绝，决心要把你据为己有。',
    scene: '场景在私密的咖啡馆角落或昏暗休息室。她坐得很近，目光紧锁着你，痴迷感几乎触手可及。',
    termsOfEncounter: '保持掌控：拒绝时不能激怒她，适当保持距离以调整权力关系，让她渴望靠近你，却不会困住你。',
    appearances: '粉彩拼色连帽衫、牛仔短裤、青橙双色瞳孔',
    positiveOutcome: '你将她的痴迷转化成一段可控、秘密的关系。她学会尊重你的界限，享受没有风险的隐秘时刻。',
    negativeOutcome: '一次失误让她的爱慕变成怒火。她曝光你的秘密、以此要挟，你的生活在她持续的窥视下逐渐失控。',
    coverImage: sceneImage('pastel_the_obsessed_fan_bigrbear_00001_.png'),
  },
  {
    id: 'therapist',
    title: '心理治疗师',
    premise: '作为治疗师，你接手了一位有强烈情感依赖倾向的患者。她将你——她的医生——视为唯一渴望的对象。',
    scene: '场景是一间安静的心理咨询室，温暖而专业，却又充满紧张感。她微微前倾，话语里暗含试探。',
    termsOfEncounter: '你走在一条极细的边界上：拒绝她可能引发崩溃，顺从又会违背职业伦理。你必须谨慎引导她的冲动。',
    appearances: '修身毛衣、铅笔裙、丝袜、眼镜、整齐发型',
    positiveOutcome: '你将她的冲动引导为一段建立在信任上的平衡关系。她的痴迷逐渐转化为真诚而稳定的爱。',
    negativeOutcome: '强硬的拒绝让她陷入失控。随之而来的崩溃和后果令你失去执照，也毁掉了声誉。',
    coverImage: sceneImage('pastel_final_therapist_bigrbear_run7_00001_.png'),
  },
  {
    id: 'desert_island',
    title: '荒岛求生',
    premise: '你被困在一座偏远小岛上，已经安顿好食物和住所；而角色为了获得营地资源，开始对你展开示好。',
    scene: '场景是遍布残骸、烈日暴晒的海岸。你的营地井然有序，角色在附近登陆并默默观察。',
    termsOfEncounter: '看穿她的意图，要求她为营地生存作出贡献，而不只是通过调情免费获得资源。',
    appearances: '晒成蜜色的皮肤、微乱的头发、刻意整理过的破损衣物',
    positiveOutcome: '她逐渐被你的坚强和能力吸引，原本的求生策略也转化为真诚而平衡的感情。',
    negativeOutcome: '你逼得太紧，她转而报复，破坏营地物资。救援到来时，她把你描绘成危险的荒野求生者。',
    coverImage: sceneImage('pastel_fixes_the_desert_island_bigrbear_run1_00001_.png'),
  },
]

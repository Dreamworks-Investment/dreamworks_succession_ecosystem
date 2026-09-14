/**
 * Public-safe case catalogue derived from the supplied cooperation package.
 * Raw internal reports stay outside the public bundle; this file exposes only
 * approved-style summaries, filenames, and selected non-sensitive previews.
 */
window.STRATEGY_CASES = [
  {
    slug: 'skyworth', name: '创维汽车', english: 'SKYWORTH AUTO', ticker: '旗舰案例',
    type: '战略定位咨询', status: '完整案例', tone: 'gold',
    headline: '从战略体检到最终方案，完整呈现一个定位如何诞生',
    summary: '经历资料采集、定位深化、现实检验、红蓝军对决与方案重构，形成可回溯的两章战略推演。',
    question: '当“健康、养生、家庭出行”等方向都具备吸引力时，如何找到既能被用户感知、又能被企业兑现的核心定位？',
    method: ['定位战略体检', '4P→4C 推演', '红蓝军对决', '运营配称与路线图'],
    outcome: '形成“推演之路 + 最终方案”双章节成果，并保留证据、风险与执行节奏。',
    hero: 'assets/strategy/cases/skyworth/founder-team.jpg',
    alt: '梦工场团队与创维汽车创始人及团队代表合影',
    caption: '创维汽车创始人与项目团队交流留影',
    materialsTotal: 33,
    attachments: [
      { title: '第一章 · 创维汽车战略定位的推演之路', type: 'WEB', role: '完整演示', preview: 'assets/strategy/cases/skyworth/workshop-team.jpg', summary: '从五份核心报告、多轮质疑与现实检验中，还原定位如何逐步收敛。', action: 'deep-1' },
      { title: '第二章 · 创维汽车战略定位最终方案', type: 'WEB', role: '完整演示', preview: 'assets/strategy/chapter2-original/page-01.png', summary: '呈现战略命题、用户、场景、运营配称、风险、路线与传播。', action: 'deep-2' },
      { title: '04 创维汽车战略定位重构报告 0730', type: 'PPTX', role: '演示文稿', preview: 'assets/strategy/chapter2-original/page-02.png', summary: '战略定位重构演示稿，网页双章节内容的主要材料之一。' },
      { title: '05 创维汽车战略定位重构报告（最终版）', type: 'MD', role: '最终文本', summary: '最终报告文本，用于核对战略判断与表述。' },
      { title: '创维汽车战略定位与运营配称讨论稿', type: 'MD', role: '运营配称', summary: '将定位推演进一步连接到产品、价格、渠道、传播与组织。' },
      { title: '创维汽车业务板块 · 确定性狠值专项研究', type: 'PDF', role: '价值研究', preview: 'assets/strategy/chapter2-original/page-03.png', summary: '从企业价值研究视角补充经营与资本判断。' },
      { title: '项目照片与路演纪要', type: 'PHOTO', role: '过程凭证', preview: 'assets/strategy/cases/skyworth/workshop-team.jpg', summary: '包含团队研讨、路演与现场交流记录；主页仅展示经筛选照片。' }
    ]
  },
  {
    slug: 'dashi', name: '达实智能', english: 'DAS INTELLITECH', ticker: '002421.SZ',
    type: '战略定位 × 价值研究', status: '方案比较', tone: 'blue',
    headline: '围绕 AI、关键运营场景与建筑低碳价值，比较两条定位路线',
    summary: '资料包包含两份战略定位报告与一份确定性狠值研究。页面并列呈现路线，不替客户代选最终结论。',
    question: '如何摆脱“智慧空间集成商”的同质化认知，把技术能力转化为客户愿意选择的独特价值？',
    method: ['企业价值研究', '二元对立', '4P 配称', '风险与路线评估'],
    outcome: '形成“AI 驱动建筑节能低碳”与“关键运营场景 AI 管控平台”两条可比较路线。',
    hero: 'assets/strategy/cases/das/team.jpg', alt: '梦工场团队与达实智能团队合影', caption: '达实智能项目团队交流留影',
    materialsTotal: 17,
    attachments: [
      { title: '达实智能战略定位报告一', type: 'PPTX', role: '路线 A', preview: 'assets/strategy/cases/previews/das-positioning-1.png', summary: 'AI 驱动的建筑节能低碳服务商，对决智慧空间集成商。' },
      { title: '达实智能战略定位报告二', type: 'PPTX', role: '路线 B', preview: 'assets/strategy/cases/previews/das-positioning-2.png', summary: '关键运营场景 AI 管控平台，对决智慧空间集成商。' },
      { title: '达实智能确定性狠值深度研究报告', type: 'PDF', role: '价值研究', preview: 'assets/strategy/cases/previews/das-report.png', summary: '从经营质量、竞争优势与长期价值角度补充战略判断。' },
      { title: '达实智能调研与参访照片', type: 'PHOTO', role: '过程凭证', preview: 'assets/strategy/cases/das/visit.jpg', summary: '包含企业参访、团队访谈与讨论现场的精选记录。' }
    ]
  },
  {
    slug: 'yaoji', name: '姚记科技', english: 'YAOJI TECHNOLOGY', ticker: '002605.SZ',
    type: '战略定位研究', status: '路线比较', tone: 'red',
    headline: '从传统扑克制造走向棋牌科技或智趣娱乐生态',
    summary: '战略体检、增长建议、研究报告与红蓝军材料共同组成推演链路；不同版本保留为路线比较。',
    question: '面对业务边界扩张，姚记应该强化棋牌科技心智，还是构建更宽的智趣娱乐生态？',
    method: ['战略体检', '增长建议', '定位研究', '红蓝军辩论'],
    outcome: '形成两套定位表述及其取舍依据，最终公开口径仍需项目确认。',
    hero: 'assets/strategy/cases/previews/yaoji-doc.png', alt: '姚记科技战略定位报告预览', caption: '战略定位报告受控预览',
    materialsTotal: 5,
    attachments: [
      { title: '姚记科技战略定位报告', type: 'DOCX', role: '综合报告', preview: 'assets/strategy/cases/previews/yaoji-doc.png', summary: '包含“中国智趣娱乐生态”等定位方向与运营逻辑。' },
      { title: '战略定位研究报告', type: 'MD', role: '路线研究', summary: '围绕“中国棋牌科技平台”等方向形成研究论证。' },
      { title: '定位战略体检', type: 'MD', role: '战略体检', summary: '识别现有认知、业务边界与战略聚焦问题。' },
      { title: '战略增长建议', type: 'MD', role: '增长路径', summary: '将定位方向连接到增长机会与行动建议。' },
      { title: '红蓝军辩论', type: 'MD', role: '反方检验', summary: '用正反论证检验定位可信度与执行风险。' }
    ]
  },
  {
    slug: 'unilumin', name: '洲明科技', english: 'UNILUMIN', ticker: '300232.SZ',
    type: '战略破局 × 价值研究', status: '研究归档', tone: 'cyan',
    headline: '从价格战中跳出来，把部件能力升级为系统价值',
    summary: '战略文章解释价格战成因，企业价值模型报告则补充经营与资本视角。',
    question: '当规模与制造优势被价格竞争消耗，如何重新定义品类、品牌与客户价值？',
    method: ['价格战根因分析', '品类与品牌重构', '企业价值模型'],
    outcome: '形成从部件到系统、从母品牌到子品牌、从规模到新品类的破局思路。',
    hero: 'assets/strategy/cases/previews/unilumin-doc.png', alt: '洲明科技梦工场模型报告预览', caption: '企业价值模型报告受控预览',
    materialsTotal: 2,
    attachments: [
      { title: '洲明科技——为何深陷价格战，如何破局', type: 'MD', role: '战略分析', summary: '分析规模、心智、渠道与品类结构造成的价格战。' },
      { title: '洲明科技梦工场模型', type: 'DOCX', role: '价值研究', preview: 'assets/strategy/cases/previews/unilumin-doc.png', summary: '以梦工场企业价值框架形成结构化研究。' }
    ]
  },
  {
    slug: 'haier', name: '海尔智家', english: 'HAIER SMART HOME', ticker: '600690.SH',
    type: '企业价值研究', status: '研究合作', tone: 'blue',
    headline: '以确定性狠值框架，研究全球化家电龙头的长期价值',
    summary: '资料包包含深度研究报告、Word 版本与合作交流合照，定位为价值研究合作。',
    question: '如何从经营质量、全球品牌、组织与现金流中识别长期价值的确定性来源？',
    method: ['企业基本面', '竞争优势', '价值与风险', '现场交流'],
    outcome: '形成一套企业价值深度研究材料；不将其误写为战略定位项目。',
    hero: 'assets/strategy/cases/haier/team.jpg', alt: '梦工场团队与海尔智家团队代表合影', caption: '海尔智家合作交流留影',
    materialsTotal: 3,
    attachments: [
      { title: '海尔智家确定性狠值深度研究报告', type: 'PDF', role: '价值研究', preview: 'assets/strategy/cases/previews/haier-report.png', summary: '围绕经营质量、竞争壁垒与长期价值展开研究。' },
      { title: '海尔智家深度研究报告', type: 'DOCX', role: '编辑版本', preview: 'assets/strategy/cases/previews/haier-report.png', summary: '与 PDF 对应的研究文档版本。' },
      { title: '合作交流合照', type: 'PHOTO', role: '合作凭证', preview: 'assets/strategy/cases/haier/team.jpg', summary: '项目交流的现场照片。' }
    ]
  },
  {
    slug: 'doctor', name: '博士眼镜', english: 'DOCTOR GLASSES', ticker: '300622.SZ',
    type: '估值 × 投资价值研究', status: '研究合作', tone: 'violet',
    headline: '用 DCF、SOTP 与访谈准备交叉验证企业价值',
    summary: '七份材料覆盖简要分析、两种估值方法、整合报告、估值建议、访谈准备与交流演示。',
    question: '如何在门店网络、专业服务与新业务预期之间建立可核验的价值判断？',
    method: ['DCF 估值', 'SOTP 估值', '访谈验证', '整合分析'],
    outcome: '形成多方法估值与访谈验证材料，定位为企业价值研究合作。',
    hero: 'assets/strategy/cases/previews/doctor-ppt.jpg', alt: '博士眼镜交流演示稿预览', caption: '交流演示稿受控预览',
    materialsTotal: 7,
    attachments: [
      { title: '博士眼镜投资价值分析报告（整合版）', type: 'PDF', role: '整合研究', preview: 'assets/strategy/cases/previews/doctor-report.png', summary: '整合经营分析与多方法估值的核心报告。' },
      { title: '博士眼镜估值分析报告（DCF）', type: 'PDF', role: 'DCF', summary: '以现金流折现方法形成估值区间。' },
      { title: '博士眼镜投资价值分析报告（SOTP）', type: 'PDF', role: 'SOTP', summary: '按业务分部估值并进行交叉验证。' },
      { title: '博士交流', type: 'PPTX', role: '交流演示', preview: 'assets/strategy/cases/previews/doctor-ppt.jpg', summary: '项目交流使用的演示文稿，文件体量较大，网页仅展示封面预览。' },
      { title: '访谈前准备表', type: 'DOCX', role: '调研准备', summary: '将关键假设转化为访谈问题。' },
      { title: '估值建议', type: 'DOCX', role: '建议稿', summary: '汇总估值判断与需进一步验证的事项。' },
      { title: '博士眼镜简要分析报告', type: 'PDF', role: '基础分析', summary: '项目早期的企业与行业概览。' }
    ]
  },
  {
    slug: 'yuhetian', name: '玉禾田', english: 'EIT-SUNSHINE', ticker: '300815.SZ',
    type: '企业价值研究', status: '单项材料', tone: 'orange',
    headline: '以一份确定性狠值深度研究报告建立案例入口',
    summary: '资料包目前仅包含一份八页研究 PDF，因此页面如实显示材料边界，不扩写未经核验的结论。',
    question: '在资料有限时，如何保留研究入口，同时避免把单份材料包装成完整咨询案例？',
    method: ['价值研究', '材料边界标注'],
    outcome: '建立受控预览与补充资料提示，等待后续项目材料完善。',
    hero: 'assets/strategy/cases/previews/yuhetian-report.png', alt: '玉禾田研究报告首页预览', caption: '确定性狠值深度研究报告受控预览',
    materialsTotal: 1,
    attachments: [
      { title: '玉禾田（300815.SZ）确定性狠值深度研究报告', type: 'PDF', role: '价值研究', preview: 'assets/strategy/cases/previews/yuhetian-report.png', summary: '当前唯一材料；网页展示报告封面与材料说明。' }
    ]
  },
  {
    slug: 'dachen', name: '达晨财智', english: 'FORTUNE CAPITAL', ticker: '重要合作机构',
    type: '战略合作框架', status: '合作凭证', tone: 'gold',
    headline: '连接产业资本、金融资本与家族资本传承的战略合作',
    summary: '达晨财智与梦工场形成战略合作框架，探索从企业成长孵化到家族财富传承的全生命周期服务。',
    question: '如何把一级市场的产业培育能力、二级市场的价值发现能力与家族传承系统连接起来？',
    method: ['全产业链资产配置', '跨代际家族传承', '生态伙伴协同'],
    outcome: '形成“产业资本引领 + 金融资本赋能 + 家族资本传承”的合作框架。',
    hero: 'assets/strategy/cases/dachen/strategy-agreement-title.jpg', alt: '达晨财智与梦工场战略合作框架协议标题及双方名称', caption: '协议标题与双方名称脱敏裁切；原件含敏感信息，不在网页公开',
    materialsTotal: 1,
    attachments: [
      { title: '战略合作框架协议', type: 'PDF', role: '合作凭证', preview: 'assets/strategy/cases/dachen/strategy-agreement-title.jpg', summary: '八页扫描协议。网页仅展示已裁除信用代码、地址、签章等信息的凭证区域。', restricted: true }
    ]
  }
];

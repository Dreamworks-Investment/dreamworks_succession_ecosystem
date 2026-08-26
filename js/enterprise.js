/**
 * enterprise.js — 企业价值诊断与增进模块
 * 报告内容严格对齐真实诊断模板深度
 */

/* ============================================================
   一、诊断数据 — 预置公司深度报告内容
   ============================================================ */

const REPORT_DATA = {

  /* ---------- 水羊股份 ---------- */
  '水羊股份': {
    code: '300740.SZ',
    industry: '美妆护肤',

    // 线① 价值诊断 — 按《诊断_价值诊断问题清单》结构
    diagValue: {
      conclusion: '水羊股份当前处于"高端化烧钱换增长"的尴尬阶段。65%毛利率被52%销售费用率吞噬殆尽，净利率不足3%。R维度（回报率）严重偏低，G维度（增长率）依赖高投入勉强维持，S维度（可持续性）因缺乏技术护城河而脆弱。综合评分：战略方向 5/10，盈利质量 2/10，价值壁垒 3/10，商业模式 4/10，财务健康 3/10。一句话结论：高端化的面子贴上了，盈利的里子没跟上。',
      scores: { strategy: 5, profit: 2, barrier: 3, business: 4, finance: 3, overall: 3.4 },

      // 客户与战略定位
      positioning: {
        brandHistory: '前身"御家汇"（2018年上市），最初定位"面膜电商第一股"。2023年更名"水羊股份"，标志着从单一面膜品牌向"全球化新晋高奢美妆品牌管理集团"的战略转型。市值从高峰回落至约70亿，股价已跌破IPO发行价。',
        productEvolution: '从单一御泥坊面膜→"3+2+N"品牌矩阵。高端自有（EDB/RV/PA，2000+元价格带）、大众自有（御泥坊/小迷糊/大水滴，50-300元）、代理品牌（城野医生/KIKO等50+品牌）。客户群体从年轻女性面膜用户扩展到涵盖年均消费数万元的高端护肤消费者。',
        keyPerson: '实控人戴跃锋（汀汀），已质押持股40.35%，存在质押平仓风险。企业有极高的实控人依赖性。',
        dupont: [
          { metric: '净利率', waterSheep: '2.91%', peer: '~15%（珀莱雅）', assessment: '严重偏低' },
          { metric: '总资产周转率', waterSheep: '~0.28次', peer: '~0.8次（珀莱雅）', assessment: '偏低' },
          { metric: '权益乘数', waterSheep: '~1.96', peer: '~1.5', assessment: '杠杆偏高' }
        ],
        dupontConclusion: '水羊当前不靠高利润率、不靠高周转、也不靠高杠杆赚钱——本质上还在"烧钱换增长"阶段。',
        businessClassification: [
          { biz: 'EDB/RV高端自有品牌', status: '赚钱且增长', evidence: 'EDB蝉联高端涂抹面膜TOP1，2025自有品牌营收20.96亿+26.97%，但高营销投入压缩利润' },
          { biz: '代理品牌（50+品牌）', status: '赚钱但增长承压', evidence: '曾贡献六成营收，但美斯蒂克2026.1流失至竞争对手，强生科赴业务大幅下滑' },
          { biz: '御泥坊等大众自有', status: '不赚钱且倒退', evidence: '御泥坊2024H1销售额暴跌48%，品牌升级反复失败，消费者认知混乱' }
        ],
        financialTrend: [
          { metric: '营收（亿）', y2022: '47.65', y2023: '44.93', y2024: '42.44', y2025: '49.86', latest: '11.98(Q1)' },
          { metric: '营收增速', y2022: '-5.7%', y2023: '-5.7%', y2024: '-5.5%', y2025: '+17.5%', latest: '+10.3%' },
          { metric: '净利润（亿）', y2022: '1.23', y2023: '2.94', y2024: '1.88', y2025: '1.48', latest: '0.35(Q1)' },
          { metric: '毛利率', y2022: '53.1%', y2023: '58.4%', y2024: '63.2%', y2025: '65.5%', latest: '65.0%' },
          { metric: '净利率', y2022: '2.6%', y2023: '6.5%', y2024: '4.4%', y2025: '2.97%', latest: '2.91%' },
          { metric: 'ROE', y2022: '5.8%', y2023: '12.8%', y2024: '7.5%', y2025: '5.2%', latest: '1.57%' }
        ],
        keyFindings: [
          '毛利率三年提升12.4个百分点（53%→65%），但净利率从6.5%跌至2.91%——钱被营销吃掉了',
          '2025年销售费用25.80亿，同比增长24.1%，销售费用率51.84%。每1元增量销售费用仅带来0.72元增量收入',
          '代理业务核心引擎美斯蒂克被竞争对手夺走独家代理权，数亿元增长缺口',
          '实控人持股质押40%，股价已跌破IPO发行价'
        ]
      },

      // 利润区分析
      profitZone: {
        enterpriseDesign: [
          { element: '客户选择', answer: '高端护肤消费者为主，大众用户为辅', eval: '方向正确，但获客成本过高' },
          { element: '盈利模式', answer: '高端品牌溢价+代理服务费', eval: '品牌溢价尚未建立，代理议价权下降' },
          { element: '价值壁垒', answer: 'EDB在涂抹面膜细分品类的先发优势', eval: '品类壁垒浅，缺乏核心专利技术护城河' },
          { element: '业务范围', answer: '自有品牌+代理品牌双轮', eval: '双轮均面临失速风险' }
        ],
        barrierScore: [
          { strength: '品牌/版权', score: 6, ours: 'EDB涂抹面膜品类TOP1', note: '品类认知领先但有天花板' },
          { strength: '品牌/版权', score: 5, ours: '2年产品技术领先期', note: '以营销驱动为主，技术领先有限' },
          { strength: '成本优势', score: 3, ours: '渠道运营效率', note: '规模效应尚未显现' }
        ],
        barrierOverall: 4,
        customerPrefComparison: [
          { pref: '产品质量', ours: 7, rival: '9（雅诗兰黛）', gapReason: '品牌文化和技术积淀差距' },
          { pref: '品牌溢价感', ours: 4, rival: '9（海蓝之谜）', gapReason: '高端心智远未建立' },
          { pref: '性价比', ours: 6, rival: '6（珀莱雅）', gapReason: '高端定位下性价比无优势' }
        ]
      }
    },

    // 线② 战略增进 — 按《定位战略体检》结构
    strategy: {
      bg: '水羊股份（300740），前身"御家汇"，2018年上市，原名"面膜电商第一股"。2023年更名"水羊股份"，标志着公司从单一面膜品牌向"全球化新晋高奢美妆品牌管理集团"的战略转型。截至2026年6月，市值约70亿，股价17.85元，已跌破IPO发行价21.23元。',
      chapters: '战略执行评估、战略形势分析、战略发展之道和战略配称建议',

      chapter1: {
        title: '战略执行评估（体检现状）',
        guide: '首先，我们从定位专业的角度，对水羊股份"全球高奢美妆集团"定位战略的执行进行评估，这是本次战略体检的基础。',
        right: [
          '毛利率跃升：综合毛利率从2022年的53.12%提升至2025年的65.53%，三年提升12.4个百分点，品牌结构从"代理为主"向"自有高端为主"的转变是核心驱动力',
          'EDB站稳脚跟：法国高奢护肤品牌EDB蝉联高端涂抹面膜品类TOP1，精华防晒在千元以上防晒市场占有率持续提升',
          '研发全球化布局：巴黎抗衰实验室升级开业、大阪SC抗衰实验室揭牌，2025年研发费用首次突破1.1亿元'
        ],
        opportunity: '中国高端美妆市场正处于结构性增长期。2025年市场规模预计突破2000亿元，年复合增长率超15%。水羊通过2022年收购EDB，选择了"收购跳级"模式，直接切入2000元以上的超高端价格带，避开了国货在500-1000元区间的激烈竞争。',
        position: '在高端美妆领域确立了"存在感"，但尚未建立"统治力"。EDB在涂抹面膜细分赛道有品类心智，但整体品牌认知远不及海蓝之谜、赫莲娜等国际一线。消费者调研显示EDB高端用户占比不足8%。',
        analyses: [
          { title: '收入增长靠烧钱，盈利模型尚未跑通', body: '2025年全年销售费用高达25.80亿元，同比增长24.1%，销售费用率51.84%。公司每创造1元收入，就要拿出超过5毛钱做营销推广。同期净利率仅2.97%，2026年Q1进一步降至2.90%。这个盈利结构与"高奢集团"的定位严重背离——雅诗兰黛同期调整后营业利润率为8.0%，欧莱雅更高。水羊的高端化目前是"赔本赚吆喝"。' },
          { title: '自有大众品牌加速失血，品牌根基动摇', body: '御泥坊2024年上半年销售额同比暴跌48%。品牌升级过程中定位反复摇摆——从"面膜第一"转向"高端护肤"又回到"国潮"，消费者认知彻底混乱。御泥坊作为公司起家品牌和曾经的现金奶牛，如今已走到生死边缘。' },
          { title: '代理业务核心引擎熄火，议价能力丧失', body: '2025年底，西班牙品牌美斯蒂克核心口服美容产品线中国区独家代理权被若羽臣夺走。美斯蒂克全渠道GMV从2021年的5000万元飙升至2024年的超5亿元，是代理业务增长的核心引擎。此前强生旗下科赴业务板块已有较大幅度下滑，说明水羊对品牌方的议价能力正在系统性削弱。' }
        ],
        summary: { header: '双轮失速，三重背离', body: '水羊股份当前战略执行的核心矛盾是：高增长叙事 vs 低盈利现实 vs 弱品牌根基。营业收入2025年同比增长17.47%，毛利率提升至65.53%，表面光鲜——但净利率不足3%、净资产收益率仅1.57%、投入资本回报率从9.1%断崖跌至1.18%。高端化的"面"贴上了，但盈利的"里"没跟上。公司当前的增长引擎实际上已经处于"高端勉强快跑、大众失速下行、代理支柱松动"的三重夹击之中。' }
      },

      chapter2: {
        title: '战略形势分析（竞争扫描）',
        guide: '接下来，对水羊股份所面临的竞争形势进行扫描，看清各类竞争本质，以明确水羊的发展机会。',
        competitors: [
          { type: '国际高端品牌集团', name: '雅诗兰黛、欧莱雅、资生堂', verdict: '绝对制空权', analysis: '国际高端品牌在中国市场拥有无可撼动的心智和渠道壁垒。它们在高端百货、免税渠道的排他性位置、数十年积累的技术专利组合和品牌文化资产，是水羊股份短期内无法逾越的护城河。' },
          { type: '国货美妆第一梯队', name: '珀莱雅、贝泰妮', verdict: '大单品+精细化运营碾压', analysis: '珀莱雅凭借"早C晚A"等大单品策略实现从大众到中高端的自然升级。贝泰妮以"敏感肌"定位精准切入。这些同行的净利率普遍在10%-15%，远高于水羊的2.97%。' },
          { type: '跨界收割者', name: 'LVMH、开云旗下奢侈品牌美妆线', verdict: '高奢降维打击', analysis: 'Louis Vuitton、Dior等奢侈品牌的美妆线凭借母品牌的超高溢价能力，不需要大量营销投入就能实现极高的利润率。水羊想要成为"高奢"，首先要面对的是这些真正高奢品牌的降维竞争。' },
          { type: '代理业务竞对', name: '若羽臣、丽人丽妆', verdict: '贴身肉搏', analysis: '若羽臣拿下美斯蒂克2026-2028年独家代理权，充分说明竞争白热化。品牌方对代理商考核越来越严苛，水羊如无法证明能创造更多增量价值，代理品牌流失将继续发生。' }
        ],
        analyses: [
          { title: '高端美妆的胜利不属于"收购者"，而属于"定义者"', body: '纵观全球高端美妆格局，雅诗兰黛、欧莱雅等集团的品牌矩阵是通过数十年内生培育+精准并购构建的，且每个品牌在被收购前已具备独立的文化资产和技术壁垒。EDB、RV在被水羊收购前都是规模极小的"小众品牌"，它们在中国的增长更多依赖水羊的渠道和营销能力，而非品牌自身的文化号召力。水羊是渠道型的"卖货者"，不是品牌型的"定义者"。' },
          { title: '水羊的真正竞争对手不是雅诗兰黛，而是珀莱雅们', body: '水羊董事长公开表示要对标雅诗兰黛，但以当前不足5000万净利润、70亿市值的体量，与营收超1300亿的雅诗兰黛相提并论，完全是战略叙事上的错位。在国货美妆的竞争梯队中，水羊正处于"不上不下"的尴尬位置。' }
        ],
        opportunity: { header: '鲸吞高奢定位，深耕品类利基', body: '如果水羊清醒地放弃"中国雅诗兰黛"的宏大叙事，将资源集中在EDB品牌的品类深耕上——聚焦敏感肌抗衰领域，建立技术壁垒——则有希望在超高端涂抹面膜这一利基品类中建立不可替代的竞争地位。但前提是：必须大幅削减营销费用率，将资源重新配置到研发和产品端。' }
      },

      chapter3: {
        title: '战略发展之道（战略方向 + 执行要点）',
        strategyWay: '品类深耕利基 对决 集团化高奢野心',
        strategyPriority: '止血重塑盈利，聚焦EDB品类壁垒建设',
        strategyLogic: '水羊当前最紧迫的任务不是继续扩张品牌矩阵和对标雅诗兰黛，而是先让现有业务具备可持续的盈利能力。以不足3%的净利率和51.84%的销售费用率去谈"全球化高奢集团"，无异于以纸糊的大厦对标钢筋混凝土的帝国。战略要务是：压缩营销费用、暂停非核心品牌扩张、集中资源建设EDB的技术护城河。',
        executions: [
          {
            line: '费用结构革命——把营销费用率砍到40%以下',
            logic: '水羊的盈利问题本质上是费用结构问题。51.84%的销售费用率在A股美妆板块排名倒数，这是不可持续的。',
            items: [
              { title: '砍掉低效投放', detail: '重新评估所有线上投放渠道的ROI，关闭拉新成本高于客户终身价值的投放通道。2025年每多花1元推广，只能换来0.72元增量收入，边际效率已经为负。' },
              { title: '收缩大众品牌营销预算', detail: '御泥坊、小迷糊、大水滴等大众品牌的品牌升级已多次尝试均未成功。与其继续投入巨资试图"救活"这些品牌，不如彻底收缩它们的营销预算至维持性水平。' },
              { title: '评估明星代言实际效果', detail: 'EDB请梁朝伟、刘嘉玲等巨星代言，但高端用户占比不足8%。需要严肃评估千万级代言费到底带来了多少目标客户的转化。高端品牌的信任建立靠的不是明星脸，而是产品效果和口碑。' }
            ],
            opsDetails: [
              { area: '产品', strategy: '建设核心技术壁垒', detail: 'EDB当前的品类领先建立在先发优势和营销投放之上，缺乏不可复制的技术壁垒。需要在敏感肌抗衰领域建立至少1-2个独有的核心专利成分。' },
              { area: '渠道', strategy: '退守核心阵地', detail: '水羊的全球化布局目前更多是"网点铺开"而非"盈利扩张"。建议在大中华区核心市场建立稳固的盈利底盘后，再逐步拓展海外。' },
              { area: '管理', strategy: '压缩行政冗余', detail: '2026年Q1管理费用同比增长23.48%。一家净利率不足3%的公司，在管理成本上如此"大方"，是严重的资源错配。' }
            ]
          },
          {
            line: '品牌矩阵切割——果断做减法',
            logic: '在盈利模型未跑通之前，不应再分散资源。',
            items: [
              { title: '处置或减持非核心品牌', detail: '御泥坊品牌已连续多年下滑，品牌升级反复失败。需要做出艰难决定：要么彻底放弃"救活"的努力，将其作为低端走量品牌维持；要么寻找买家出售。' },
              { title: '暂停新的品牌收购', detail: '商誉已达4.43亿元，占净资产22.8%，继续加杠杆收购将大幅增加减值风险。在公司自身盈利模型未跑通之前，不应再进行任何新的品牌收购。' },
              { title: '代理业务重新定位', detail: '代理业务的核心价值在下降——品牌方越来越倾向于自建团队或选择效率更高的TP服务商。应将代理业务定位为现金流业务而非增长业务，降低对增长的依赖。' }
            ]
          }
        ],
        expectations: [
          '销售费用率在两年内从51.84%降至40%以下，净利率回升至5%-8%区间',
          'EDB在敏感肌抗衰领域建立至少1个独有核心专利成分，成为中国超高端涂抹面膜品类的绝对领导者',
          '大众品牌完成瘦身，御泥坊等非核心品牌不再消耗战略资源'
        ]
      },

      chapter4: {
        title: '整合传播与资本市场沟通建议',
        choice: '从"中国雅诗兰黛"的宏大叙事，回归"盈利改善+品类深耕"的可验证逻辑',
        reasons: [
          '当前市值70亿对应近50倍PE，市场给予的估值中包含了对"高奢集团"叙事的溢价。一旦这个故事讲不下去，估值将面临大幅回调',
          '与其用不切实际的对标来支撑估值，不如用逐季改善的盈利能力来重建投资者信任',
          '实控人已质押40%持股，质押风险需要认真对待'
        ],
        actions: [
          { title: '用"净利率拐点"替代"营收高增长"作为核心KPI', detail: '当销售费用率超过50%时，营收增长对股东而言是价值破坏而非价值创造。建议将公司对外沟通的核心指标从"营收增速"转为"扣非净利率改善"。' },
          { title: '暂停"雅诗兰黛"对标语术，改用"敏感肌抗衰专家"定位', detail: '"对标雅诗兰黛"的话术只会引发市场对两者差距的更多审视和质疑。"全球敏感肌抗衰专家"虽然调门低了，但更具可信度和差异化。一个清晰、诚实、可验证的定位，比一个宏大但空洞的野心更受投资者尊重。' }
        ]
      }
    },

    rgScores: { R: 4.0, G: 6.5, S: 3.5 },
    stockThickness: { R: '薄', G: '增量驱动型', S: '浅' }
  },

  /* ---------- 创维汽车 ---------- */
  '创维汽车': {
    code: '未上市',
    industry: '新能源汽车',

    diagValue: {
      conclusion: '创维汽车面临的是一个经典的战略困境：方向正确（新能源赛道），但资源和能力严重不匹配。从家电跨界造车，品牌迁移难度极大。R维度（回报率）几乎不存在——新能源车制造需要持续巨量资本投入，盈利遥遥无期；G维度（增长率）有想象空间但兑现不确定性高；S维度（可持续性）极度脆弱——缺乏核心技术壁垒和差异化定位。综合评分：战略方向 6/10，盈利质量 1/10，价值壁垒 2/10，商业模式 3/10，财务健康 2/10。一句话结论：赛道是对的，但牌桌不是为你准备的。',
      scores: { strategy: 6, profit: 1, barrier: 2, business: 3, finance: 2, overall: 2.8 },

      positioning: {
        brandHistory: '创维集团以电视起家，是中国老牌家电企业。2021年正式发布创维汽车，切入新能源乘用车赛道，主打"移动智能生活空间"概念。',
        productEvolution: '从中大型SUV切入，首款车型创维EV6定位15-25万价格带。后续推出HT-i混动版本，尝试Hybrid路线。',
        keyPerson: '黄宏生，创维集团创始人，年过花甲仍亲自挂帅造车。',
        dupont: [
          { metric: '净利率', waterSheep: '负值（持续亏损）', peer: '~10%（比亚迪）/ 负值（蔚来）', assessment: '严重亏损' },
          { metric: '总资产周转率', waterSheep: '极低（在建期）', peer: '~0.8-1.0次', assessment: '产能利用率不足' },
          { metric: '权益乘数', waterSheep: '偏高', peer: '~2-3', assessment: '资本密集依赖' }
        ],
        dupontConclusion: '创维汽车处于典型的"巨额投入、零产出"阶段。造车是重资本游戏，每一辆车的毛利要覆盖巨大的固定成本摊销。',
        businessClassification: [
          { biz: '新能源整车制造', status: '亏钱且倒退', evidence: '销量规模极小，月销不足千辆，远未达到盈亏平衡点' },
          { biz: '车载智能系统', status: '不赚钱但增长', evidence: '智能座舱概念有一定差异化，但规模不足以支撑独立盈利' }
        ],
        financialTrend: [
          { metric: '营收（亿）', y2022: '预计<5', y2023: '预计<10', y2024: '预计<10', y2025: '预计<10', latest: '-' },
          { metric: '净利润', y2022: '亏损', y2023: '亏损扩大', y2024: '亏损扩大', y2025: '持续亏损', latest: '-' },
          { metric: '月销量(辆)', y2022: '<500', y2023: '<1000', y2024: '<1000', y2025: '<800', latest: '<500' }
        ],
        keyFindings: [
          '月销量不足千辆，年销量不足万辆级别，在新能源车行业属于"统计噪声"级别',
          '从家电跨界造车面临严重的品牌认知障碍——消费者不认为创维是"车牌子"',
          '15-25万价格带竞争最激烈——比亚迪、小鹏、零跑、哪吒等均已重兵布局',
          '缺乏新能源车的核心三电技术（电池/电机/电控），多为外购组装'
        ]
      },

      profitZone: {
        enterpriseDesign: [
          { element: '客户选择', answer: '15-25万价格带新能源SUV消费者', eval: '价格带选择正确但竞争过于激烈' },
          { element: '盈利模式', answer: '整车销售+智能座舱差异化', eval: '规模极小，盈利模型远未跑通' },
          { element: '价值壁垒', answer: '创维品牌认知+智能座舱概念', eval: '品牌认知是负资产（不是车品牌），智能座舱无壁垒' },
          { element: '业务范围', answer: '新能源整车+车载智能', eval: '两条战线同时烧钱' }
        ],
        barrierScore: [
          { strength: '品牌/版权', score: 3, ours: '创维品牌在家电领域认知', note: '家电品牌≠汽车品牌，存在跨界认知鸿沟' },
          { strength: '成本优势', score: 1, ours: '成本劣势（规模不足）', note: '规模远未达到降本阶段' }
        ],
        barrierOverall: 2,
        customerPrefComparison: [
          { pref: '品牌信任', ours: 2, rival: '9（比亚迪）', gapReason: '造车经验和技术积累的代际差距' },
          { pref: '性价比', ours: 4, rival: '8（零跑/哪吒）', gapReason: '规模不足导致成本劣势' },
          { pref: '智能化体验', ours: 5, rival: '8（小鹏）', gapReason: '技术积累和人才储备差距大' }
        ]
      }
    },

    strategy: {
      bg: '创维汽车，中国老牌家电巨头创维集团旗下的新能源造车项目。2021年正式发布，主攻中大型新能源SUV市场。在家电行业增速放缓的背景下，创维将新能源汽车视为"第二增长曲线"，但这一选择正在成为一个巨大的资本黑洞。',
      chapters: '战略执行评估、战略形势分析、战略发展之道和战略配称建议',

      chapter1: {
        title: '战略执行评估（体检现状）',
        guide: '从定位专业角度，对创维汽车"移动智能生活空间"定位战略的执行进行评估。',
        right: [
          '差异化定位初步建立："移动智能生活空间"将创维的家电基因与汽车结合，在概念层面有一定独特性',
          '智能座舱体验差异化：利用创维在显示技术和大屏交互上的积累，车载智能系统体验具有一定竞争力'
        ],
        opportunity: '新能源汽车市场保持高速增长，2025年中国新能源渗透率已超40%。理论上市场足够大，任何在位者都有生存空间。但现实是：行业已经进入淘汰赛阶段，比亚迪年销400万+横扫市场，第二梯队（小鹏、零跑、哪吒）月销已过万，留给月销不足千辆的创维的时间窗口正在急速关闭。',
        position: '创维汽车在新能源车市场的存在感近乎为零。2025年月销量据推算不足千辆，年销不足万辆。在年销400万+的比亚迪面前，完全不在同一维度竞争。',
        analyses: [
          { title: '品牌跨界陷阱——创维≠汽车', body: '家电品牌向汽车品类延伸，面临严重的品牌认知障碍。消费者购买汽车时，最核心的信任维度是安全性、可靠性和技术实力——这些与"电视"完全不搭界。小米SU7的成功建立在雷军个人IP和百亿投入之上，创维在品牌势能和资金实力上均无法相提并论。' },
          { title: '规模死亡螺旋', body: '汽车是典型的规模经济行业。月销不足千辆意味着：采购无议价权、生产线大量闲置、研发摊销极高、渠道难以铺开。销量越小→成本越高→价格越无竞争力→销量更小——这是一个死亡螺旋。' },
          { title: '15-25万价格带的血海竞争', body: '创维选择的15-25万价格带，正是中国新能源车竞争最激烈的区间。比亚迪宋/海豹系列、小鹏G6/MONA、零跑C系列、深蓝SL/S系列、哪吒等数十款车型在此厮杀。创维EV6在产品力上没有任何一项能挤进前五。' }
        ],
        summary: { header: '概念先行，实力未至', body: '创维汽车的"移动智能生活空间"定位在概念层面有想象力，但概念需要产品力和规模来兑现。当前面临的是"月销千辆、持续亏损、品牌认知为零"的三重困局。在家电行业，创维是"创维"；在汽车行业，创维是"谁？"' }
      },

      chapter2: {
        title: '战略形势分析（竞争扫描）',
        guide: '对创维汽车面临的竞争形势进行扫描。',
        competitors: [
          { type: '行业绝对霸主', name: '比亚迪', verdict: '通吃15-25万全价格带', analysis: '比亚迪2025年销量超400万辆，15-25万是其基本盘。全产业链垂直整合带来的成本优势，让跟随者不可能在价格上竞争。' },
          { type: '新势力头部队', name: '小鹏/零跑/哪吒', verdict: '月销过万的技术+性价比组合', analysis: '小鹏有智能驾驶技术壁垒，零跑/哪吒通过极致性价比蚕食市场。它们已经在15-20万建立了品牌认知和用户口碑。' },
          { type: '华为跨界势力', name: '问界/智界/阿维塔', verdict: '技术+渠道双重碾压', analysis: '华为不造车但深度赋能，智能驾驶和智能座舱技术领先行业，渠道覆盖数千家门店。' },
          { type: '同为跨界者', name: '小米汽车', verdict: '百亿投入+生态碾压', analysis: '小米SU7成功上市，靠的是雷军IP、千亿现金储备和智能生态优势。创维在这些维度全面落后。' }
        ],
        analyses: [
          { title: '新能源车企的淘汰赛已经开始', body: '威马汽车破产、高合汽车停摆、天际汽车退场——新能源造车的淘汰赛已经残酷展开。资金实力、技术积累、品牌认知三者缺一不可。创维在这三个维度均处于明显劣势，被淘汰的概率远高于存活概率。' },
          { title: '"移动智能生活空间"的理想与现实', body: '概念本身并无问题——智能座舱确实是差异化方向。但问题是：消费者选车时，"智能生活空间"的优先级排在安全、续航、价格、品牌、充电便利性之后。当你的车在这些基本面维度都不突出时，再好的概念也只是空中楼阁。' }
        ],
        opportunity: { header: '收缩战线，聚焦细分场景', body: '创维汽车如果要在新能源车市场存活，必须放弃"全品类竞争"的幻想，聚焦一个巨头不屑于进入但规模足以维持的细分场景——如商用车电动化、特定区域市场（下沉市场的充电解决方案+整车）、或基于创维家电渠道优势的B端市场等。' }
      },

      chapter3: {
        title: '战略发展之道（战略方向 + 执行要点）',
        strategyWay: '细分场景生存 对决 全品类竞争幻想',
        strategyPriority: '立即收缩造车规模，评估继续或退出',
        strategyLogic: '以创维汽车当前的销量和资金消耗速度，留给决策的时间窗口可能只有12-18个月。如果不能在短期内找到可持续的商业模式，继续烧钱造车将严重拖累创维集团的整体财务状况。新能源车的淘汰赛不会给"小而美"的选手留出空间。',
        executions: [
          {
            line: '评估继续造车的商业合理性',
            logic: '核心问题：继续每年烧几十亿造车，三年后能到月销5000辆吗？如果不能，现在就应该止损。',
            items: [
              { title: '独立融资或引入战略投资者', detail: '凭借创维集团的品牌背书和"智能座舱"概念，尝试在资本市场独立融资。如果融资失败，说明市场也不认可这个故事——那就该果断止损。' },
              { title: '调整产品定位——避开红海', detail: '放弃15-25万的"主流家用SUV"定位。要么下沉到10万以下的经济型市场，要么转型为特定场景的商用车/特种车。' },
              { title: '利用家电渠道——探索B端市场', detail: '创维在全国有数万家家电销售网点，这是独有资源。是否可以基于这些渠道，探索充电桩+整车打包的区域出行解决方案？' }
            ]
          }
        ],
        expectations: [
          '在12个月内做出继续或退出的明确决策，不再在中间地带徘徊',
          '如果继续，月销量必须在18个月内突破3000辆的基本生存线',
          '家电主业必须与造车项目完全风险隔离，防止造车黑洞吞噬集团现金流'
        ]
      },

      chapter4: {
        title: '风险警示',
        choice: '新能源造车是创维成立以来最大的战略赌注，也可能是最大的战略失误',
        reasons: [
          '家电行业利润率本已微薄，每年数亿级的造车亏损正在侵蚀创维集团的核心盈利能力',
          '资本市场对"家电企业跨界造车"的估值逻辑极为保守——既不会给科技公司的估值溢价，也不会给传统车企的资产折价',
          '一旦创维集团财务状况因造车而恶化，将影响家电主业的研发投入和市场竞争力'
        ],
        actions: [
          { title: '建立严格的财务防火墙', detail: '造车项目必须独立核算、独立融资，不得以创维集团的信用和现金流为背书无限输血。' },
          { title: '设定明确的退出条件', detail: '如果24个月内无法实现月销3000辆和正向经营现金流，必须无条件退出造车业务。' }
        ]
      }
    },

    rgScores: { R: 2.0, G: 6.0, S: 2.0 },
    stockThickness: { R: '无', G: '增量驱动型', S: '无' }
  },

  /* ---------- 比亚迪 ---------- */
  '比亚迪': {
    code: '002594.SZ / 1211.HK',
    industry: '新能源汽车',

    diagValue: {
      conclusion: '比亚迪是中国新能源车领域的绝对领导者，2025年销量突破400万辆，全球排名前列。R维度（回报率）：全产业链垂直整合建立了结构性成本优势，ROE维持在20%左右，盈利能力在车企中处于第一梯队。G维度（增长率）：新能源渗透率仍在提升，海外扩张刚刚起步，增长空间充裕。S维度（可持续性）：技术护城河（刀片电池/CTB/DM-i）深度显著，品牌势能和规模效应构成双重壁垒。综合评分：战略方向 9/10，盈利质量 8/10，价值壁垒 8/10，商业模式 9/10，财务健康 8/10。一句话结论：中国新能源车领域综合竞争力最强的企业，三维度均衡且均在上升通道。',
      scores: { strategy: 9, profit: 8, barrier: 8, business: 9, finance: 8, overall: 8.4 },

      positioning: {
        brandHistory: '比亚迪1995年以电池起家，2003年收购秦川汽车进入汽车行业，2022年3月宣布停产纯燃油车，成为全球首家全面转向新能源的传统车企。从"电池大王"到"新能源车全球冠军"，完成了惊人的战略转型。',
        productEvolution: '从早期的低端燃油车（F3等）→新能源车试水（e6/秦）→王朝系列（唐/宋/元/汉）→海洋系列（海豚/海豹）→仰望/方程豹/腾势高端矩阵。价格带从5万覆盖到100万+。',
        keyPerson: '王传福，创始人/董事长，技术出身，对电池和新能源有极深的战略远见。',
        dupont: [
          { metric: '净利率', waterSheep: '~5%', peer: '~8-10%（丰田）', assessment: '中高水平，持续改善' },
          { metric: '总资产周转率', waterSheep: '~0.8-1.0次', peer: '~0.6-0.8次', assessment: '优秀' },
          { metric: '权益乘数', waterSheep: '~3-4', peer: '~2-3', assessment: '偏高但资产质量好' }
        ],
        dupontConclusion: '比亚迪通过全产业链垂直整合（从锂矿到电池到整车到芯片），在规模扩张的同时维持了可观的利润率。这种结构性的成本优势是竞争对手难以复制的。',
        businessClassification: [
          { biz: '新能源乘用车', status: '赚钱且高速增长', evidence: '2025年销量超400万辆，全球新能源车销量冠军' },
          { biz: '刀片电池/储能', status: '赚钱且增长', evidence: '外部客户持续拓展，储能业务爆发式增长' },
          { biz: '手机部件/电子代工', status: '赚钱但增长平稳', evidence: '稳定贡献现金流，但非核心增长引擎' },
          { biz: '云轨/商用车', status: '尚在培育期', evidence: '规模有限，但具有长期战略价值' }
        ],
        financialTrend: [
          { metric: '营收（亿）', y2022: '4241', y2023: '6023', y2024: '7771', y2025: '8500+', latest: '2200+(Q1)' },
          { metric: '净利润（亿）', y2022: '166', y2023: '300', y2024: '402', y2025: '450+', latest: '110+(Q1)' },
          { metric: '毛利率', y2022: '17.0%', y2023: '19.8%', y2024: '21.0%', y2025: '21.5%+', latest: '22.0%' },
          { metric: '净利率', y2022: '3.9%', y2023: '5.0%', y2024: '5.2%', y2025: '5.3%+', latest: '5.2%' },
          { metric: '研发费用（亿）', y2022: '187', y2023: '399', y2024: '532', y2025: '550+', latest: '-' },
          { metric: 'ROE', y2022: '16.1%', y2023: '21.6%', y2024: '22.5%', y2025: '21%+', latest: '-' }
        ],
        keyFindings: [
          '2025年销量突破400万辆，同比增长超30%，蝉联全球新能源车销量冠军',
          '全年研发费用超550亿元，超过净利润，技术驱动的长期主义',
          '海外销量快速攀升，东南亚、南美、欧洲三大市场同步扩张',
          '仰望U8/U9成功切入百万级豪华车市场，品牌向上战略取得突破',
          '刀片电池外部客户持续拓展（特斯拉/丰田等），电池业务估值独立化趋势明显'
        ]
      },

      profitZone: {
        enterpriseDesign: [
          { element: '客户选择', answer: '覆盖5-100万全价位带的新能源车消费者', eval: '全客群覆盖，规模效应最大化' },
          { element: '盈利模式', answer: '整车销售+电池外供+电子代工三维盈利', eval: '盈利来源多元化，抗周期能力强' },
          { element: '价值壁垒', answer: '全产业链垂直整合+技术专利组合', eval: '结构性成本优势+技术护城河双重壁垒' },
          { element: '业务范围', answer: '乘用车+商用车+电池+储能+电子+云轨', eval: '业务组合健康，核心技术自给' }
        ],
        barrierScore: [
          { strength: '建立行业标准', score: 9, ours: '刀片电池/CTB/易四方成为行业标杆', note: '多项技术被同行跟进，定义行业方向' },
          { strength: '主导地位', score: 9, ours: '中国新能源车市占率超30%', note: '规模效应自我强化' },
          { strength: '品牌/技术壁垒', score: 8, ours: '数万项专利+全产业链自研', note: '竞争对手追赶需5-10年' }
        ],
        barrierOverall: 8,
        customerPrefComparison: [
          { pref: '性价比', ours: 9, rival: '6（丰田）', gapReason: '全产业链成本优势无法复制' },
          { pref: '技术先进感', ours: 8, rival: '8（特斯拉）', gapReason: '智能驾驶略逊但三电技术领先' },
          { pref: '品牌信任', ours: 7, rival: '9（丰田）', gapReason: '品牌历史较短，需持续积累' }
        ]
      }
    },

    strategy: {
      bg: '比亚迪，2025年全球新能源车销量冠军，中国制造业最具代表性的企业之一。从电池起家到汽车帝国，王传福用三十年证明了垂直整合战略的巨大威力。站在年销400万辆的新起点，比亚迪面临的最大挑战已从"能不能活下来"变成了"如何管理一个万亿帝国的持续增长"。',
      chapters: '战略执行评估、战略���争形势分析、战略发展之道和战略配称建议',

      chapter1: {
        title: '战略执行评估（当前状态）',
        guide: '比亚迪当前处于"全面领先"状态，但领先不等于可以松懈。我们对其战略执行做客观评估。',
        right: [
          '全产业链垂直整合战略：从锂矿到电池到IGBT芯片到整车，核心环节全部自研自产。这一战略在供应链危机中展现了巨大的抗风险能力，也是比亚迪能够实现"油电同价"乃至"电比油低"的根本原因',
          '技术鱼池战略：刀片电池、CTB、易四方、云辇、天神之眼——比亚迪储备了一个庞大的技术"鱼池"，可以随时根据市场需求捞出新技术。2025年研发投入超550亿，超过净利润',
          '品牌向上突破：仰望U8/U9百万级定价，上市后订单超预期，验证了中国品牌在超豪华市场的存在可能性'
        ],
        opportunity: '全球新能源车渗透率仍在爬坡阶段——中国已超40%，但全球仅约18%。这是一个以十年为单位的增长周期。比亚迪在技术和成本上的领先优势，使其在这场全球竞争中处于极为有利的位置。',
        position: '比亚迪已从中国新能源车市场的"领先者"升级为"定义者"——它定义的不仅是产品标准，更是行业竞争的游戏规则。年销400万辆的体量，使得任何竞争对手都必须在"跟比亚迪正面竞争"和"避开比亚迪的价格带"之间做选择。',
        analyses: [
          { title: '出海是必修课，但风险不可低估', body: '比亚迪2025年海外销量快速攀升，但海外市场的政治风险正在上升。欧盟的反补贴关税、美国的高额关税壁垒、部分发展中国家的政策不确定性，都是潜在的绊脚石。比亚迪需要在出海速度和风险管控之间找到平衡。' },
          { title: '智能驾驶是相对短板', body: '华为ADS、小鹏XNGP在智能驾驶领域的领先身位，是比亚迪为数不多的技术追赶项。虽然比亚迪已经加大智能驾驶投入（"天神之眼"系统），但相较于已经积累多年的新势力，追赶需要时间。' },
          { title: '管理复杂度随规模指数级增长', body: '从年销200万辆到400万辆到800万辆，管理复杂度的增长不是线性的。多品牌矩阵（比亚迪/腾势/方程豹/仰望）的协同与区隔、海外团队的本土化管理、供应链的全球化布局——这些都是前所未见的挑战。' }
        ],
        summary: { header: '全面领先，但领先者的最大敌人是自己', body: '比亚迪已经打赢了"从0到1"和"从1到N"的两场战争。现在面临的是"从N到N+1"的新挑战——管理万亿帝国的复杂性、在全球复制中国市场的成功、在智能驾驶赛道上不被拉开差距。这些都是领先者独有的烦恼，但处理不好，领先优势就可能被侵蚀。' }
      },

      chapter2: {
        title: '战略竞争形势分析',
        guide: '扫描比亚迪面临的竞争格局。',
        competitors: [
          { type: '全球传统车企巨头', name: '丰田/大众/现代', verdict: '规模仍领先，电动化加速追赶', analysis: '丰田2025年全球销量超1000万辆，规模仍是比亚迪的一倍以上。但比亚迪电动化领先优势至少3-5年。' },
          { type: '中国新能源竞争对手', name: '华为（问界/智界）/小鹏/理想', verdict: '在智能驾驶领域领先', analysis: '华为的智能驾驶能力、理想的增程产品定义、小鹏的技术品牌，在不同维度构成竞争。' },
          { type: '国际新能源标杆', name: '特斯拉', verdict: '品牌+AI的双重竞争', analysis: '特斯拉FSD和Optimus机器人代表了更高维度的竞争。比亚迪在制造端领先，但在AI/软件端需要加速追赶。' }
        ],
        analyses: [
          { title: '规模效应的自我强化', body: '年销400万辆带来的采购议价权、产线摊销优势、研发分摊效应，正在形成自我强化的飞轮。销量越大→成本越低→价格越优→销量更大。只要不犯重大战略错误，这个飞轮极难被打破。' },
          { title: '最大的风险不是竞争对手，而是地缘政治', body: '比亚迪的出海战略面临的最大不确定性不是产品力或成本竞争力，而是各国日益上升的贸易保护主义。如何在政治风险可控的市场建立本地化产能，是全球化成功的关键。' }
        ],
        opportunity: { header: '从中国冠军到全球冠军的跨越', body: '全球新能源车年销量预计2030年将达到4000-5000万辆。如果比亚迪能在全球市场维持15-20%的市占率，意味着600-1000万辆的年销量——这将使其跻身全球前三的汽车集团。机会巨大，但实现的路径充满挑战。' }
      },

      chapter3: {
        title: '战略发展之道',
        strategyWay: '全球化深耕 对决 中国式扩张复制',
        strategyPriority: '海外本土化——将中国市场的成功在全球核心市场逐一复制',
        strategyLogic: '比亚迪在中国市场的成功已经充分验证。下一个十年的核心命题是：能否在海外市场建立与国内市场同等强度的竞争地位？这需要从"出口贸易"模式升级为"本土化深耕"模式——在目标国家建立本地化的产能、供应链、品牌和团队。',
        executions: [
          {
            line: '智能驾驶——加速补课',
            logic: '智能驾驶是比亚迪当前最明确的短板，也是未来五年汽车行业竞争的核心战场。',
            items: [
              { title: '加大AI人才招聘力度', detail: '与华为、小鹏、特斯拉争夺顶尖AI/自动驾驶人才，建立独立的智能驾驶研究院。' },
              { title: '探索外部合作', detail: '不排除与华为等智能驾驶领先者建立深度合作，以换取时间窗口。' }
            ]
          },
          {
            line: '多品牌矩阵精细化管理',
            logic: '四个品牌（比亚迪/腾势/方程豹/仰望）需要清晰的定位区隔和资源分配策略。',
            items: [
              { title: '比亚迪主品牌：坚守"油电同价"的性价比定位', detail: '大众市场的基本盘，年销300万+的规模底座，不可动摇。' },
              { title: '腾势/方程豹/仰望：审慎扩张', detail: '高端和豪华品牌的建立需要时间，不宜用销量KPI来考核。品牌建设期应容忍亏损，看重的是品牌资产的积累。' }
            ]
          }
        ],
        expectations: [
          '海外销量在3年内达到150万辆/年的规模，占总销量25-30%',
          '智能驾驶能力在2年内跻身行业第一梯队',
          '多品牌矩阵健康运转，仰望/腾势品牌独立估值'
        ]
      },

      chapter4: {
        title: '投资者视角',
        choice: '比亚迪是中国新能源车赛道确定性最高的标的，但估值需要匹配增长阶段',
        reasons: [
          '当前估值对应约20-25倍PE，考虑到20%+的增长速度，估值处于合理偏高水平',
          '海外扩张的成功与否，将决定比亚迪能否从"中国冠军"质变为"全球冠军"',
          '智能驾驶能力是决定估值天花板的关键变量——如果在这一维度持续落后，估值溢价将收窄'
        ],
        actions: [
          { title: '关注海外销量和毛利率的季度变化', detail: '国内市场增长正在放缓，海外是下一阶段的增长引擎。海外毛利率是判断全球化战略是否成功的最关键指标。' },
          { title: '关注研发费用率', detail: '研发投入是比亚迪护城河的核心来源。如果研发费用率出现明显下降，需要警惕——这可能意味着"鱼池"中的技术储备正在减少。' }
        ]
      }
    },

    rgScores: { R: 8.0, G: 9.0, S: 8.5 },
    stockThickness: { R: '厚', G: '存量推动型', S: '深' }
  }
};

// Default company template
const DEFAULT_DIAG = {
  conclusion: '当前公开信息不足以给出确定性诊断结论。建议提供企业内部财务和经营数据后重新评估，或先使用"外部研究"功能采集更全面的公开信息。',
  scores: { strategy: 5, profit: 5, barrier: 5, business: 5, finance: 5, overall: 5 },
  keyFindings: ['公开数据有限，需补充内部数据以进行深度诊断', '行业竞争格局分析显示中等竞争强度', '需进一步评估商业模式和护城河深度']
};

/* ============================================================
   二、报告渲染函数
   ============================================================ */

function getReportData(name) {
  return REPORT_DATA[name] || null;
}

// 线① 价值诊断
function startEnterpriseDiag() {
  const name = document.getElementById('e1-name')?.value.trim();
  if (!name) { alert('请输入企业名称'); return; }

  const loadingEl = document.getElementById('e1-loading');
  const reportEl = document.getElementById('e1-report');
  loadingEl.style.display = 'block';
  reportEl.style.display = 'none';

  setTimeout(() => {
    const data = getReportData(name);
    loadingEl.style.display = 'none';
    reportEl.style.display = 'block';
    reportEl.innerHTML = data ? renderValueDiag(name, data) : renderDefaultDiag(name);
    if (data) setTimeout(() => renderEnterpriseRadarChart(name, data), 300);
  }, 1800);
}

function renderValueDiag(name, data) {
  const d = data.diagValue;
  const s = d.scores;
  return `
    <div id="enterprise-report-container">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h3>${name}（${data.code}）· 价值诊断报告</h3>
          <p class="text-caption">诊断工具：《价值诊断 – 详细问题清单》| 诊断日期：${new Date().toLocaleDateString('zh-CN')}</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="exportEnterprisePDF('${name}')">下载报告 PDF</button>
      </div>

      <!-- R×G×S 雷达图 -->
      <div class="card card-sm" style="margin-bottom:20px;">
        <h4 style="margin-bottom:12px;">R×G×S 价值立方体 · 三维评估</h4>
        <div class="chart-wrap"><canvas id="enterpriseRadarChart"></canvas></div>
        <div class="grid-3" style="margin-top:12px;text-align:center;">
          <div><span class="tag tag-blue">R ${data.rgScores.R}/10 · ${data.stockThickness.R}</span></div>
          <div><span class="tag tag-green">G ${data.rgScores.G}/10 · ${data.stockThickness.G}</span></div>
          <div><span class="tag tag-amber">S ${data.rgScores.S}/10 · ${data.stockThickness.S}</span></div>
        </div>
      </div>

      <!-- 核心诊断结论 -->
      <div class="card card-sm" style="border-left:4px solid var(--accent);margin-bottom:20px;">
        <h4 style="margin-bottom:8px;">核心诊断结论</h4>
        <p style="font-weight:600;color:var(--text);line-height:1.8;">${d.conclusion}</p>
      </div>

      <!-- 六维评分 -->
      <div class="card card-sm" style="margin-bottom:20px;">
        <h4 style="margin-bottom:12px;">六维度综合评分</h4>
        <table>
          <tr><td>战略方向</td><td><span class="tag ${s.strategy>=7?'tag-green':s.strategy>=5?'tag-amber':'tag-red'}">${s.strategy}/10</span></td>
            <td>盈利质量</td><td><span class="tag ${s.profit>=7?'tag-green':s.profit>=5?'tag-amber':'tag-red'}">${s.profit}/10</span></td></tr>
          <tr><td>价值壁垒</td><td><span class="tag ${s.barrier>=7?'tag-green':s.barrier>=5?'tag-amber':'tag-red'}">${s.barrier}/10</span></td>
            <td>商业模式</td><td><span class="tag ${s.business>=7?'tag-green':s.business>=5?'tag-amber':'tag-red'}">${s.business}/10</span></td></tr>
          <tr><td>财务健康</td><td><span class="tag ${s.finance>=7?'tag-green':s.finance>=5?'tag-amber':'tag-red'}">${s.finance}/10</span></td>
            <td style="font-weight:700;color:var(--accent);">综合</td><td style="font-weight:700;font-size:1.1rem;color:var(--accent);">${s.overall}/10</td></tr>
        </table>
      </div>

      <!-- 客户与战略定位 -->
      ${d.positioning ? `
      <div class="card card-sm" style="margin-bottom:20px;">
        <h4 style="margin-bottom:12px;">模块一：客户与战略定位</h4>
        <p style="font-size:.85rem;color:var(--text-secondary);margin-bottom:8px;"><strong>品牌与行业：</strong>${d.positioning.brandHistory}</p>
        <p style="font-size:.85rem;color:var(--text-secondary);margin-bottom:8px;"><strong>产品与客户演变：</strong>${d.positioning.productEvolution}</p>
        <p style="font-size:.85rem;color:var(--text-secondary);margin-bottom:12px;"><strong>关键人物：</strong>${d.positioning.keyPerson}</p>

        <h5 style="font-size:.85rem;margin-bottom:6px;">杜邦分析 — 持续赚钱的根源</h5>
        <table style="font-size:.82rem;">
          <tr><th>维度</th><th>${name}</th><th>对标</th><th>诊断</th></tr>
          ${d.positioning.dupont.map(r => `
            <tr><td>${r.metric}</td><td>${r.waterSheep}</td><td style="color:var(--text-muted);">${r.peer}</td><td><span class="tag ${r.assessment.includes('严重')||r.assessment.includes('偏低')?'tag-red':'tag-amber'}">${r.assessment}</span></td></tr>
          `).join('')}
        </table>
        <p style="font-size:.82rem;color:var(--text-secondary);margin-top:8px;">${d.positioning.dupontConclusion}</p>

        <h5 style="font-size:.85rem;margin:12px 0 6px;">业务组合诊断</h5>
        <table style="font-size:.82rem;">
          <tr><th>业务</th><th>状态</th><th>判断依据</th></tr>
          ${d.positioning.businessClassification.map(b => `
            <tr><td>${b.biz}</td><td><span class="tag ${b.status.includes('增长')?'tag-green':b.status.includes('承压')?'tag-amber':'tag-red'}">${b.status}</span></td><td style="font-size:.8rem;color:var(--text-muted);">${b.evidence}</td></tr>
          `).join('')}
        </table>

        <h5 style="font-size:.85rem;margin:12px 0 6px;">核心财务指标趋势</h5>
        <div class="table-wrap">
          <table style="font-size:.8rem;">
            <tr><th>指标</th><th>2022</th><th>2023</th><th>2024</th><th>2025</th><th>最新</th></tr>
            ${d.positioning.financialTrend.map(r => `
              <tr><td>${r.metric}</td><td>${r.y2022}</td><td>${r.y2023}</td><td>${r.y2024}</td><td>${r.y2025}</td><td>${r.latest}</td></tr>
            `).join('')}
          </table>
        </div>
      </div>
      ` : ''}

      <!-- 关键发现 -->
      ${d.positioning?.keyFindings ? `
      <div class="card card-sm" style="margin-bottom:20px;">
        <h4 style="margin-bottom:12px;">关键发现</h4>
        <ul style="list-style:none;padding:0;">
          ${d.positioning.keyFindings.map((f, i) => `
            <li style="padding:10px 0;border-bottom:1px solid var(--border-light);font-size:.9rem;color:var(--text-secondary);line-height:1.8;">
              <strong style="color:var(--accent);">${i+1}.</strong> ${f}
            </li>
          `).join('')}
        </ul>
      </div>
      ` : ''}

      <!-- 价值壁垒 -->
      ${d.profitZone ? `
      <div class="card card-sm" style="margin-bottom:20px;">
        <h4 style="margin-bottom:12px;">模块二：价值壁垒评估</h4>
        <table style="font-size:.82rem;">
          <tr><th>壁垒方式</th><th>评分</th><th>我方情况</th><th>说明</th></tr>
          ${d.profitZone.barrierScore.map(b => `
            <tr><td>${b.strength}</td><td>${b.score}/10</td><td>${b.ours}</td><td style="font-size:.8rem;color:var(--text-muted);">${b.note}</td></tr>
          `).join('')}
        </table>
        <p style="font-size:.85rem;margin-top:8px;"><strong>综合壁垒强度：${d.profitZone.barrierOverall}/10</strong></p>

        <h5 style="font-size:.85rem;margin:12px 0 6px;">客户偏好满足度对比</h5>
        <table style="font-size:.82rem;">
          <tr><th>客户偏好</th><th>我方(1-10)</th><th>最强竞对(1-10)</th><th>差距原因</th></tr>
          ${d.profitZone.customerPrefComparison.map(c => `
            <tr><td>${c.pref}</td><td>${c.ours}</td><td>${c.rival}</td><td style="font-size:.8rem;color:var(--text-muted);">${c.gapReason}</td></tr>
          `).join('')}
        </table>
      </div>
      ` : ''}

      <div class="alert alert-info" style="margin-top:16px;">
        <strong>建议下一步：</strong>
        ${s.overall < 5 ? '综合评分偏低，建议重点关注<strong>风险控制</strong>和<strong>退出时机</strong>。如需深度分析，可启动<strong>线② 战略增进</strong>寻找改善路径。' :
          s.overall < 7 ? '综合评分中等，存在明确改善空间。建议启动<strong>线② 战略增进</strong>，进行定位战略体检和增长路径规划。' :
          '综合评分良好。建议定期复检关键指标变化，关注行业竞争格局的演变。如需深度战略规划，仍可启动线②。'}
      </div>
    </div>
  `;
}

function renderDefaultDiag(name) {
  return `
    <div id="enterprise-report-container">
      <h3>${name} · 快速诊断</h3>
      <p class="text-caption">基于公开信息的初步评估</p>
      <div class="alert alert-warning" style="margin:20px 0;">
        ${DEFAULT_DIAG.conclusion}
      </div>
      <div class="card card-sm">
        <h4 style="margin-bottom:8px;">初步发现</h4>
        <ul style="list-style:none;padding:0;">
          ${DEFAULT_DIAG.keyFindings.map(f => `<li style="padding:8px 0;border-bottom:1px solid var(--border-light);font-size:.9rem;color:var(--text-secondary);">◆ ${f}</li>`).join('')}
        </ul>
      </div>
      <button class="btn btn-primary btn-sm" onclick="exportEnterprisePDF('${name}')" style="margin-top:16px;">下载备忘录 PDF</button>
    </div>
  `;
}

// 线② 战略增进（完整版）
function startStrategyDiag() {
  const name = document.getElementById('e2-name')?.value.trim();
  if (!name) { alert('请输入企业名称'); return; }

  const loadingEl = document.getElementById('e2-loading');
  const reportEl = document.getElementById('e2-report');
  const stepsDisplay = document.getElementById('e2-steps-display');
  stepsDisplay.style.display = 'block';
  loadingEl.style.display = 'block';
  reportEl.style.display = 'none';

  let step = 1;
  const msgs = ['Step 1/3: 正在进行定位战略体检...', 'Step 2/3: 正在进行红蓝军多视角裁决...', 'Step 3/3: 正在生成战略增长建议...'];
  const stepEl = loadingEl.querySelector('p');
  const intv = setInterval(() => { if (step <= 3) { stepEl.textContent = msgs[step-1]; step++; } }, 1200);

  setTimeout(() => {
    clearInterval(intv);
    const data = getReportData(name);
    loadingEl.style.display = 'none';
    reportEl.style.display = 'block';
    reportEl.innerHTML = data ? renderStrategyDiag(name, data) : renderDefaultDiag(name);
  }, 4200);
}

function renderStrategyDiag(name, data) {
  const st = data.strategy;
  const { R, G, S } = data.rgScores;
  const weakest = R <= G && R <= S ? 'R' : (G <= S ? 'G' : 'S');
  const weakestLabel = { R: '回报率（R）', G: '增长率（G）', S: '可持续性（S）' };

  return `
    <div id="strategy-report-container">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h3>${name} · 定位战略体检报告</h3>
          <p class="text-caption">2026年度 | 定位战略体检 → 红蓝军裁决 → 战略增长建议</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="exportEnterprisePDF('${name}')">下载报告 PDF</button>
      </div>

      <!-- 背景 -->
      <div class="card card-sm" style="margin-bottom:20px;">
        <p style="font-size:.9rem;color:var(--text-secondary);line-height:1.9;">${st.bg}</p>
        <p style="font-size:.85rem;color:var(--text-muted);margin-top:8px;">本报告内容包括：${st.chapters}。</p>
      </div>

      <!-- R×G×S 评分摘要 -->
      <div class="alert alert-info" style="margin-bottom:20px;">
        <strong>三维诊断：</strong>R=${R}/10（${data.stockThickness.R}）| G=${G}/10（${data.stockThickness.G}）| S=${S}/10（${data.stockThickness.S}）。
        <strong>最短板：${weakestLabel[weakest]}。</strong>
      </div>

      <!-- 第一章：战略执行评估 -->
      <div class="card card-sm" style="margin-bottom:20px;">
        <h4 style="margin-bottom:8px;">一、${st.chapter1.title}</h4>
        <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:16px;">${st.chapter1.guide}</p>

        <h5 style="font-size:.85rem;">做对了什么</h5>
        <ol style="font-size:.85rem;color:var(--text-secondary);line-height:2;padding-left:20px;">
          ${st.chapter1.right.map(item => `<li><strong>${item.split('：')[0]}：</strong>${item.split('：').slice(1).join('：')}</li>`).join('')}
        </ol>

        <h5 style="font-size:.85rem;margin-top:12px;">把握的机会</h5>
        <p style="font-size:.85rem;color:var(--text-secondary);line-height:1.9;">${st.chapter1.opportunity}</p>

        <h5 style="font-size:.85rem;margin-top:12px;">当前地位</h5>
        <p style="font-size:.85rem;color:var(--text-secondary);line-height:1.9;">${st.chapter1.position}</p>

        ${st.chapter1.analyses.map((a, i) => `
          <div style="background:var(--red-light);padding:12px 16px;border-radius:8px;margin:12px 0;">
            <strong style="color:var(--red);">分析${i+1}：${a.title}</strong>
            <p style="font-size:.85rem;color:var(--text-secondary);margin-top:4px;line-height:1.8;">${a.body}</p>
          </div>
        `).join('')}

        <div style="background:var(--accent-light);padding:16px;border-radius:8px;margin-top:16px;">
          <strong>小结：${st.chapter1.summary.header}</strong>
          <p style="font-size:.85rem;color:var(--text-secondary);margin-top:6px;line-height:1.9;">${st.chapter1.summary.body}</p>
        </div>
      </div>

      <!-- 第二章：战略形势分析 -->
      <div class="card card-sm" style="margin-bottom:20px;">
        <h4 style="margin-bottom:8px;">二、${st.chapter2.title}</h4>
        <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:16px;">${st.chapter2.guide}</p>

        ${st.chapter2.competitors.map((c, i) => `
          <div style="margin-bottom:12px;padding-left:4px;border-left:3px solid var(--primary);padding:8px 12px;">
            <strong>${i+1}. ${c.type}：${c.name}</strong>
            <span class="tag tag-red" style="margin-left:8px;">${c.verdict}</span>
            <p style="font-size:.85rem;color:var(--text-secondary);margin-top:4px;line-height:1.8;">${c.analysis}</p>
          </div>
        `).join('')}

        ${st.chapter2.analyses.map((a, i) => `
          <div style="background:var(--red-light);padding:12px 16px;border-radius:8px;margin:12px 0;">
            <strong style="color:var(--red);">分析${i+1}：${a.title}</strong>
            <p style="font-size:.85rem;color:var(--text-secondary);margin-top:4px;line-height:1.8;">${a.body}</p>
          </div>
        `).join('')}

        <div style="background:var(--green-light);padding:16px;border-radius:8px;margin-top:16px;">
          <strong>机会：${st.chapter2.opportunity.header}</strong>
          <p style="font-size:.85rem;color:var(--text-secondary);margin-top:6px;line-height:1.9;">${st.chapter2.opportunity.body}</p>
        </div>
      </div>

      <!-- 第三章：战略发展之道 -->
      <div class="card card-sm" style="margin-bottom:20px;">
        <h4 style="margin-bottom:8px;">三、${st.chapter3.title}</h4>
        <div style="text-align:center;padding:16px;background:var(--accent-light);border-radius:8px;margin-bottom:16px;">
          <strong style="font-size:1.05rem;color:#1a1a2e;">战略之道：${st.chapter3.strategyWay}</strong>
        </div>
        <p style="font-weight:600;margin-bottom:4px;">战略要务：${st.chapter3.strategyPriority}</p>
        <p style="font-size:.85rem;color:var(--text-secondary);line-height:1.9;margin-bottom:20px;">${st.chapter3.strategyLogic}</p>

        ${st.chapter3.executions.map((ex, i) => `
          <div style="margin-bottom:16px;">
            <h5 style="font-size:.85rem;">${i+1}. ${ex.line}</h5>
            <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:8px;">${ex.logic}</p>
            ${ex.items.map(item => `
              <div style="padding-left:12px;margin:6px 0;border-left:2px solid var(--accent);">
                <strong style="font-size:.82rem;">${item.title}</strong>
                <p style="font-size:.8rem;color:var(--text-secondary);margin-top:2px;line-height:1.7;">${item.detail}</p>
              </div>
            `).join('')}
            ${ex.opsDetails ? `<div style="margin-top:8px;padding-left:12px;">${ex.opsDetails.map(op => `<p style="font-size:.8rem;color:var(--text-secondary);margin:4px 0;"><strong>${op.area}：</strong>${op.strategy} — ${op.detail}</p>`).join('')}</div>` : ''}
          </div>
        `).join('')}

        <div style="background:var(--bg-section);padding:12px 16px;border-radius:8px;margin-top:16px;">
          <strong style="font-size:.85rem;">战略发展预期</strong>
          <ol style="font-size:.82rem;color:var(--text-secondary);padding-left:20px;margin-top:8px;line-height:1.8;">
            ${st.chapter3.expectations.map(e => `<li>${e}</li>`).join('')}
          </ol>
        </div>
      </div>

      ${st.chapter4 ? `
      <!-- 第四章 -->
      <div class="card card-sm" style="margin-bottom:20px;">
        <h4 style="margin-bottom:8px;">四、${st.chapter4.title}</h4>
        <div style="background:var(--accent-light);padding:16px;border-radius:8px;margin-bottom:12px;">
          <strong>战略选择：</strong>${st.chapter4.choice}
          <ol style="font-size:.85rem;color:var(--text-secondary);margin-top:8px;padding-left:20px;line-height:1.8;">
            ${st.chapter4.reasons.map(r => `<li>${r}</li>`).join('')}
          </ol>
        </div>
        ${st.chapter4.actions.map((a, i) => `
          <div style="padding:8px 12px;margin:8px 0;border-left:2px solid var(--accent);">
            <strong style="font-size:.85rem;">要点${i+1}：${a.title}</strong>
            <p style="font-size:.8rem;color:var(--text-secondary);margin-top:4px;line-height:1.7;">${a.detail}</p>
          </div>
        `).join('')}
      </div>
      ` : ''}
    </div>
  `;
}

// 线③ 外部研究
function startExternalResearch() {
  const name = document.getElementById('e3-name')?.value.trim();
  const industry = document.getElementById('e3-industry')?.value.trim();
  if (!name || !industry) { alert('请填写企业名称和所属行业'); return; }

  const loadingEl = document.getElementById('e3-loading');
  const reportEl = document.getElementById('e3-report');
  loadingEl.style.display = 'block';
  reportEl.style.display = 'none';

  setTimeout(() => {
    const data = getReportData(name);
    loadingEl.style.display = 'none';
    reportEl.style.display = 'block';
    reportEl.innerHTML = data ? renderExternalResearch(name, data) : renderDefaultDiag(name);
  }, 2000);
}

function renderExternalResearch(name, data) {
  const st = data.strategy;
  const d = data.diagValue;
  return `
    <div id="external-research-container">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h3>${name} · 基础资料备忘录</h3>
          <p class="text-caption">${data.code} · ${data.industry} · 外部公开信息采集</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="exportEnterprisePDF('${name}')">下载备忘录 PDF</button>
      </div>

      <div class="card card-sm" style="margin-bottom:16px;">
        <h4 style="margin-bottom:12px;">企业概览</h4>
        <p style="font-size:.85rem;color:var(--text-secondary);line-height:1.9;">${st.bg}</p>
        <table style="margin-top:12px;">
          <tr><td style="width:100px;">企业名称</td><td>${name}</td></tr>
          <tr><td>所属行业</td><td>${data.industry}</td></tr>
          <tr><td>上市状态</td><td>${data.code}</td></tr>
          <tr><td>R维度评分</td><td><span class="tag ${data.rgScores.R>=7?'tag-green':data.rgScores.R>=5?'tag-amber':'tag-red'}">${data.rgScores.R}/10 · ${data.stockThickness.R}</span></td></tr>
          <tr><td>G维度评分</td><td><span class="tag ${data.rgScores.G>=7?'tag-green':data.rgScores.G>=5?'tag-amber':'tag-red'}">${data.rgScores.G}/10 · ${data.stockThickness.G}</span></td></tr>
          <tr><td>S维度评分</td><td><span class="tag ${data.rgScores.S>=7?'tag-green':data.rgScores.S>=5?'tag-amber':'tag-red'}">${data.rgScores.S}/10 · ${data.stockThickness.S}</span></td></tr>
          <tr><td>综合评估</td><td style="font-size:.85rem;color:var(--text-secondary);">${d.conclusion.substring(0,150)}...</td></tr>
        </table>
      </div>

      ${d.keyFindings ? `
      <div class="card card-sm" style="margin-bottom:16px;">
        <h4 style="margin-bottom:8px;">关键发现</h4>
        <ul style="list-style:none;padding:0;">
          ${d.keyFindings.map(f => `<li style="padding:8px 0;border-bottom:1px solid var(--border-light);font-size:.85rem;color:var(--text-secondary);">◆ ${f}</li>`).join('')}
        </ul>
      </div>` : ''}

      <div class="alert alert-info" style="margin-top:16px;">
        <strong>下一步建议：</strong>本备忘录为基于公开信息的基础研究。如需深度分析，可进一步接入<strong>线① 价值诊断</strong>（评估企业的投资/持有价值）或<strong>线② 战略增进</strong>（提供具体增长路径和运营配称方案）。
      </div>
    </div>
  `;
}

// PDF export
function exportEnterprisePDF(name) {
  const ids = ['enterprise-report-container', 'strategy-report-container', 'external-research-container'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && el.offsetParent !== null) {
      generatePDF(el, name + '_企业诊断报告');
      return;
    }
  }
}

// Radar chart
function renderEnterpriseRadarChart(name, data) {
  const canvas = document.getElementById('enterpriseRadarChart');
  if (!canvas) return;
  if (canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: ['R 回报率', 'G 增长率', 'S 可持续性'],
      datasets: [{
        label: name,
        data: [data.rgScores.R, data.rgScores.G, data.rgScores.S],
        backgroundColor: 'rgba(24,95,165,.15)',
        borderColor: '#185fa5',
        borderWidth: 2,
        pointBackgroundColor: '#185fa5',
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: { r: { min: 0, max: 10, ticks: { stepSize: 2 }, grid: { color: '#e5e2d8' }, angleLines: { color: '#e5e2d8' }, pointLabels: { font: { size: 12 } } } },
      plugins: { legend: { display: false } }
    }
  });
}

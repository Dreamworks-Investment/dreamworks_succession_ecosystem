import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

const html = read('index.html');
const server = read('server.js');
const auth = read('strategy-auth.js');
const client = read('js/market-agent.js');
const css = read('css/value-agent-websdk.css');
const app = read('js/app.js');
const agentService = read('workbuddy-agent.js');

// 认证封面与保护块
assert(html.includes('data-strategy-auth-form="market"'), '市场专员必须有独立的后端认证封面');
assert(html.includes('id="market-agent-auth-view"'), '市场专员认证封面视图必须存在');
assert(html.includes('<!-- MARKET_AGENT_GATE_START -->') && html.includes('<!-- MARKET_AGENT_GATE_END -->'), '认证封面必须受服务端保护块保护');
assert(html.includes('梦工场市场专员'), '封面标题必须适配市场专员');
const marketGateBlock = html.match(/<!-- MARKET_AGENT_GATE_START -->([\s\S]*?)<!-- MARKET_AGENT_GATE_END -->/)?.[1] || '';
assert(!marketGateBlock.includes('再载入飞书官方会话面板'), '市场专员封面不得复用飞书会话面板话术');

// 会话面板与保护块
assert(html.includes('id="market-agent-websdk-view"'), '市场专员必须有 WorkBuddy 会话面板视图');
assert(html.includes('<!-- MARKET_AGENT_PROTECTED_START -->') && html.includes('<!-- MARKET_AGENT_PROTECTED_END -->'), '会话面板必须受服务端保护块保护');
assert(html.includes('id="market-agent-messages"') && html.includes('id="market-agent-input"') && html.includes('id="market-agent-form"'), '会话面板必须包含对话与输入控件');

// 后端 scope 与服务
assert(auth.includes('"market"'), 'strategy-auth 必须包含 market scope');
assert(auth.includes('MARKET_AGENT_USERNAME') && auth.includes('MARKET_AGENT_PASSWORD'), '市场专员凭据必须来自环境变量');
assert(server.includes('authStatus.grants.market'), '市场专员 API 必须受 market grant 保护');
assert(server.includes('"/api/market-agent"'), 'server 必须挂载市场专员 API 路径');
assert(server.includes('MARKET_WORKBUDDY_AGENT_ID'), '市场专员必须支持独立 WorkBuddy 专家身份配置');
assert(server.includes('marketAgent: ["MARKET_AGENT_PROTECTED_START"'), '服务端必须解包市场专员保护块');
assert(server.includes('marketAgentGate: ["MARKET_AGENT_GATE_START"'), '服务端必须处理市场专员认证封面块');
assert((server.match(/"cases", "chat", "agent", "value", "wealth", "trust", "market"/g) || []).length >= 1, '登录/登出白名单必须包含 market');

// 前端客户端
assert(client.includes("const API = '/api/market-agent'"), '客户端必须调用市场专员 API');
assert(client.includes('window.marketOpenAgent') && client.includes('window.marketShowIntro'), '客户端必须暴露视图切换函数');
assert(html.includes('onclick="marketEnterFromEntry('), '入口按钮必须走强制重新登录函数');
assert(client.includes('window.marketEnterFromEntry = marketEnterFromEntry'), '客户端必须暴露入口强制登录函数');
assert(client.includes("body: JSON.stringify({ scope: 'market' })"), '进入市场专员前必须撤销 market 授权');
assert(client.includes('requireFreshLogin'), '客户端必须有本次会话强制登录标志');
assert(client.includes('if (requireFreshLogin) return false;'), '强制登录标志必须覆盖既有授权');
assert(client.includes('/session/${encodeURIComponent(state.sessionId)}/prompt'), '客户端必须实现流式提问');
assert(html.includes('js/market-agent.js'), '页面必须加载市场专员客户端');

// 显示切换与路由
assert(css.includes('#page-value.market-agent-active #market-agent-websdk-view { display: block; }'), '必须有会话面板显示规则');
assert(css.includes('#page-value.market-agent-auth-active #market-agent-auth-view { display: block; }'), '必须有认证封面显示规则');
assert(app.includes("requested === 'market-agent'"), '路由必须支持 #market-agent 直达');
assert(app.includes("event.state.valueView === 'market-agent'"), '前进后退必须恢复市场专员视图');

// 登录后的两个报告润览选项
assert(html.includes('data-market-report="listed"'), '必须有上市公司报告润览选项');
assert(html.includes('data-market-report="unlisted"'), '必须有非上市公司报告润览选项');
assert(html.includes('上市公司模块') && html.includes('非上市公司模块'), '两个模块选项必须有正确文案');
assert(client.includes('REPORT_PRESETS'), '客户端必须定义报告润览预设指令');
assert(client.includes("REPORT_PRESETS[reportKey]"), '点击选项必须按类型载入预设指令');
assert(client.includes('data-market-report'), '客户端必须绑定选项点击事件');
assert(css.includes('.market-report-options'), '必须有选项卡片样式');

// 直达流程：模块 → 详细/简版 → 格式一键生成
assert(html.includes('id="market-agent-version-step"'), '登录后必须有第二级版本选择区');
assert(html.includes('data-market-version="full"') && html.includes('data-market-version="brief"'), '必须提供详细版与简版两个版本');
assert(html.includes('框架完整、过程充分') && html.includes('保留全部章节、数据和推演过程'), '详细版说明必须强调框架完整、过程充分');
assert(html.includes('框架完整、重点突出') && html.includes('压缩推演过程'), '简版说明必须强调框架完整、推演过程压缩');
assert(!html.includes('只看重点') && !html.includes('没有详细版那么多过程'), '简版说明不得暗示框架不完整，也不要写禁用表述');
const versionCopy = html.split('id="market-agent-version-step"')[1]?.split('market-report-note-row')[0] || '';
assert(!versionCopy.includes('内部评审') && !versionCopy.includes('对外发送'), '版本说明不得按内部/外部使用场景区分，两版都可发给客户');
assert(html.includes('data-generate-format="docx"') && html.includes('data-generate-format="pdf"'), '必须提供格式直达按钮');
assert(html.includes('data-generate-format="md"') && html.includes('data-generate-format="html"'), '必须提供 md/html 直达按钮');
assert(client.includes('REPORT_MODES'), '客户端必须定义 A/B/C/D 四种模式路由');
assert(client.includes("'listed-full'") && client.includes("'listed-brief'"), '必须覆盖上市公司详细版与简版');
assert(client.includes("'unlisted-full'") && client.includes("'unlisted-brief'"), '必须覆盖非上市公司详细版与简版');
assert(client.includes('function selectReportType'), '点击模块必须先进入版本选择，而不是直接建会话');
assert(client.includes('async function runGeneration(format)'), '点击格式必须能直接触发生成');
assert(client.includes('await uploadAttachments()') && client.includes('await streamPrompt(prompt'), '一键生成必须先传附件再发模式指令');
assert(client.includes('runExport(format)'), '专家返回正文后必须按所选格式自动交付');
assert(css.includes('.market-version-options') && css.includes('.market-agent-generate-format'), '必须有版本选择与格式直达样式');

// 上传区：报告底稿必传、标的图片可选
assert(html.includes('id="market-agent-upload-report"') && html.includes('id="market-agent-upload-images"'), '必须有底稿与图片两个上传按钮');
assert(html.indexOf('id="market-agent-upload-report"') < html.indexOf('id="market-agent-upload-images"'), '必传的底稿按钮必须排在前面');
assert(/id="market-agent-upload-report"[\s\S]{0,200}必传/.test(html), '底稿按钮必须标注「必传」');
assert(/id="market-agent-upload-images"[\s\S]{0,200}可选/.test(html), '图片按钮必须标注「可选」');
assert(html.includes('id="market-agent-upload-status"'), '上传区必须有实时状态提示行');
assert(html.includes('未上传时报告照常生成'), '必须说明图片未上传时报告照常生成');
assert(client.includes('REQUIRE_REPORT_FILE'), '必须显式声明底稿为必传（便于一处开关）');
assert(client.includes('syncSendState'), '发送按钮的可用状态必须随上传状态同步');
assert(/send\.disabled\s*=\s*state\.busy \|\| !state\.sessionId \|\| needsReport/.test(client), '未上传底稿时必须禁用发送');
assert(client.includes('reportUploadedOnce'), '底稿只需在本会话内上传一次，追问不应重复要求');
assert(client.includes("kind: 'report'") && client.includes("kind: 'image'"), '两个上传入口必须区分底稿与图片用途');
assert(css.includes('.market-agent-upload-status') && css.includes('.market-agent-upload-tag'), '必须有状态行与标签样式');

// 对话气泡与等待期反馈
assert(client.includes('wealth-agent-message is-${role}'), '对话气泡必须使用 wealth-agent-message 类（才有样式）');
assert(!/className\s*=\s*`wealth-agent-msg/.test(client), '不得再给气泡挂没有样式的 wealth-agent-msg 类');
assert(/\.wealth-agent-message \{/.test(read('css/wealth-agent.css')), 'wealth-agent-message 样式必须存在');
assert(client.includes('createRunningIndicator') && client.includes('RUNNING_STEPS'), '等待专家输出时必须有实时进度提示');
assert(client.includes('running.note(') && client.includes('running.stop()'), '进度提示必须随流式状态更新并在首字到达后收尾');
assert(client.includes('已用时'), '进度提示必须显示已用时，证明没有卡住');
assert(client.includes('CONNECT_STEPS') && client.includes('startNoteRotation'), '建立会话期间必须有进度文案轮换');
assert(css.includes('.market-agent-running-dots') && css.includes('@keyframes market-agent-running-bounce'), '必须有进度提示动画样式');

// 本地演示回复必须与市场研究相关，不能混入身家诊断话术
assert(agentService.includes('buildMarketMockReply'), '必须为市场专员提供独立的模拟回复');
const marketMockBody = agentService.split('function buildMarketMockReply')[1]?.split('export function createWealthAgentService')[0] || '';
assert(marketMockBody.length > 0, '必须能解析市场专员模拟回复函数');
assert(!marketMockBody.includes('身家诊断') && !marketMockBody.includes('要求回报率'), '市场专员模拟回复不得出现身家诊断话术');
assert(server.includes('WORKBUDDY_MOCK_PROFILE'), '市场专员必须显式指定演示回复口径');
assert(agentService.includes('config.mockProfile'), '模拟回复必须按 profile 分流');

// 报告导出：详细版 / 简版 → 四种格式
const exporter = read('js/report-export.js');
assert(html.includes('id="market-agent-export"'), '会话面板必须有报告导出区');
assert(html.includes('data-export-version="full"') && html.includes('data-export-version="brief"'), '必须有详细版与简版两个选项');
assert(html.includes('详细版下载') && html.includes('简版下载'), '两个版本选项必须有下载文案');
assert(html.includes('data-export-formats'), '必须有二级格式选项容器');
for (const format of ['md', 'pdf', 'docx', 'html']) {
  assert(html.includes(`data-export-format="${format}"`), `必须有 .${format} 下载按钮`);
}
const exportBlock = html.match(/id="market-agent-export"[\s\S]*?<\/section>/)?.[0] || '';
assert(exportBlock.length > 0, '导出区必须能完整解析');
assert(exportBlock.indexOf('data-export-version="full"') < exportBlock.indexOf('data-export-formats'), '版本选项必须在格式选项之前');
assert(/^<!-- MARKET_AGENT_PROTECTED_START -->[\s\S]*id="market-agent-export"[\s\S]*<!-- MARKET_AGENT_PROTECTED_END -->$/.test(html.match(/<!-- MARKET_AGENT_PROTECTED_START -->[\s\S]*?<!-- MARKET_AGENT_PROTECTED_END -->/)?.[0] || ''), '导出区必须位于服务端保护块内');
assert(html.includes('js/report-export.js'), '页面必须加载导出模块');
assert(html.indexOf('js/report-export.js') < html.indexOf('js/market-agent.js'), '导出模块必须先于市场专员客户端加载');
assert(client.includes('reportRounds') && client.includes('syncExportPanel'), '客户端必须累积正文并同步导出区');
assert(client.includes("data-export-version") && client.includes("data-export-format"), '客户端必须绑定两级选项点击');
assert(client.includes('MGCReportExport'), '客户端必须调用导出模块');
assert(exporter.includes('buildDocxBytes') && exporter.includes('zipStore'), '导出模块必须自行打包 docx');
assert(exporter.includes('printPdf'), '导出模块必须提供 PDF 打印路径');
assert(css.includes('.market-agent-export-versions') && css.includes('.market-agent-export-format'), '必须有导出区样式');

// 安全：明文凭据只能存在于服务端 .env，绝不能进入前端资源
const envFile = read('.env');
const passwordLine = envFile.split(/\r?\n/).find(l => l.startsWith('MARKET_AGENT_PASSWORD'));
const passwordValue = passwordLine ? passwordLine.split('=')[1].trim() : '';
assert(passwordValue.length > 0, '.env 必须配置市场专员密码');
for (const [name, content] of [['index.html', html], ['market-agent.js', client], ['app.js', app], ['value-agent-websdk.css', css], ['report-export.js', exporter]]) {
  assert(!content.includes(passwordValue), `${name} 不得包含明文密码`);
}

console.log('Market agent integration checks passed.');

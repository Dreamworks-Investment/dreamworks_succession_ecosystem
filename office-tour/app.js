import { createNavigation, exitsAt, nextNode } from './navigation.js';
const $ = (selector) => document.querySelector(selector);
const els = Object.fromEntries([...document.querySelectorAll('[id]')].map((el) => [el.id, el]));
const modes = new Set(['photo', 'overview', 'walk']);
const state = { data: null, sections: [], byId: new Map(), graph: null, nodeId: 'c1', index: 0, view: 0, mode: 'photo', direction: 1, zoom: 1, x: 0, y: 0, scene: null, scenePromise: null, imageToken: 0, photoError: false, sceneError: false, roomEntered: false, fitPhoto: matchMedia('(max-width: 760px)').matches };
const pad = (value) => String(value).padStart(2, '0');
const current = () => state.sections[state.index];
const title = (section) => section?.titleZh || section?.title || '空间';
const wrap = (index, count) => (index % count + count) % count;
// Media paths remain source-relative in data; resolve within the mounted tour,
// including when it is installed at /office-tour/ under the main website.
const mediaUrl = (value) => new URL(String(value).replace(/^\/(?=(?:media|thumbs)\/)/, ''), document.baseURI).href;
function textElement(tag, text, className) { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; }
function announce(text) { els.announcer.textContent = text; }
function writeHash() {
  if (!current()) return;
  const hash = new URLSearchParams({ stop: current().id, view: state.view, mode: state.mode, direction: state.direction === 1 ? 'cw' : 'ccw' });
  if (state.mode === 'walk') hash.set('node', state.nodeId);
  history.replaceState(null, '', `#${hash}`);
}
function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const id = Number(params.get('stop'));
  const index = state.sections.findIndex((section) => Number(section.id) === id);
  state.index = index < 0 ? 0 : index;
  state.mode = modes.has(params.get('mode')) ? params.get('mode') : 'photo';
  state.direction = params.get('direction') === 'ccw' ? -1 : 1;
  const requestedView = Number(params.get('view'));
  state.view = Number.isInteger(requestedView) && requestedView >= 0 && requestedView < (current()?.photos?.length || 0) ? requestedView : 0;
  const requestedNode = state.graph?.nodes.find(node => node.id === params.get('node') && node.sectionId === current().id);
  state.nodeId = requestedNode?.id || `c${current().id}`;
}
function showMessage(heading, description, retry = false) {
  els['message-title'].textContent = heading;
  els['message-description'].textContent = description;
  els['retry-image'].classList.toggle('hidden', !retry);
  els['viewer-message'].classList.remove('hidden');
}
function hideMessage() { els['viewer-message'].classList.add('hidden'); }
function buildRoute() {
  els['route-list'].replaceChildren();
  for (const section of state.sections) {
    const button = document.createElement('button'); button.type = 'button'; button.className = `route-stop${section.photos?.length ? '' : ' missing'}`; button.dataset.stop = section.id;
    button.setAttribute('aria-label', `${pad(section.id)} · ${title(section)}${section.photos?.length ? '' : '，影像待补充'}`);
    button.append(textElement('span', pad(section.id), 'route-stop-number'));
    const copy = textElement('span', '', 'route-stop-copy'); copy.append(textElement('strong', title(section)), textElement('small', section.title || 'OFFICE SPACE')); button.append(copy, textElement('span', '↗', 'route-stop-arrow'));
    button.addEventListener('click', () => selectSection(section.id));
    els['route-list'].append(button);
  }
  els['stop-count'].textContent = state.sections.length;
  els['section-total'].textContent = state.sections.length;
}
function updateRoute() {
  for (const button of els['route-list'].querySelectorAll('button')) {
    const active = Number(button.dataset.stop) === Number(current().id);
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
  }
  const active = els['route-list'].querySelector('.active');
  if (active) {
    const container = els['route-list'];
    if (matchMedia('(max-width: 760px)').matches) container.scrollTo({ left: active.offsetLeft - container.offsetLeft - container.clientWidth / 2 + active.clientWidth / 2, behavior: 'smooth' });
    else if (active.offsetTop < container.scrollTop || active.offsetTop + active.clientHeight > container.scrollTop + container.clientHeight) container.scrollTo({ top: Math.max(0, active.offsetTop - container.clientHeight / 2 + active.clientHeight / 2), behavior: 'smooth' });
  }
  els['reverse-direction'].innerHTML = `${state.direction === 1 ? '↻' : '↺'} <span>${state.direction === 1 ? '顺时针' : '逆时针'}</span>`;
  els['reverse-direction'].setAttribute('aria-label', `切换为${state.direction === 1 ? '逆时针' : '顺时针'}行进`);
  els['direction-label'].textContent = state.direction === 1 ? '顺时针探索' : '逆时针探索';
  els['previous-title'].textContent = title(state.sections[wrap(state.index - state.direction, state.sections.length)]);
  els['next-title'].textContent = title(state.sections[wrap(state.index + state.direction, state.sections.length)]);
  els['progress-label'].textContent = `${pad(state.index + 1)} / ${pad(state.sections.length)}`;
  els['progress-bar'].style.width = `${(state.index + 1) / state.sections.length * 100}%`;
  renderNavigation();
}
function renderNavigation() {
  if (!state.graph || !current()) return;
  const walking = state.mode === 'walk';
  const node = state.graph.nodes.find(item => item.id === state.nodeId);
  const inside = walking && node?.kind === 'room';
  els['navigation-dock'].classList.toggle('hidden', !walking);
  els['node-location'].textContent = `${pad(current().id)} · ${inside ? '室内观察点' : '走廊观察点'}`;
  els['node-location'].dataset.node = state.nodeId;
  const exits = exitsAt(state.graph, state.nodeId, state.direction);
  for (const button of els['navigation-dock'].querySelectorAll('[data-move]')) {
    const edge = exits.find(exit => exit.action === button.dataset.move);
    button.classList.toggle('hidden', !edge);
    button.disabled = !edge || state.sceneError || !state.scene;
    if (edge) {
      const destination = state.graph.nodes.find(item => item.id === edge.target);
      const room = state.byId.get(destination.sectionId);
      button.querySelector('small').textContent = ['enter','exit'].includes(edge.action) ?
        (edge.action === 'enter' ? title(current()) : '回到同一入口') : `${pad(room.id)} ${title(room)}`;
      button.dataset.target = edge.target;
    } else delete button.dataset.target;
  }
  els['next-stop'].disabled = inside;
  if (inside) els['previous-title'].textContent = '返回当前房间入口';
  els['walk-room-controls'].classList.toggle('hidden', !walking || !exits.some(edge => ['enter','exit'].includes(edge.action)));
  els['enter-room'].innerHTML = inside ? '回到走廊 <span aria-hidden="true">↙</span>' : '进入空间 <span aria-hidden="true">↗</span>';
  els['enter-room'].disabled = state.sceneError || !state.scene;
}
function moveNavigation(action) {
  if (state.mode !== 'walk' || !state.scene || state.sceneError) return;
  const target = nextNode(state.graph, state.nodeId, action, state.direction);
  if (!target) { announce('此处没有该方向的连接，请先回到当前房间入口。'); return; }
  const node = state.graph.nodes.find(item => item.id === target);
  if (node.sectionId !== current().id) selectSection(node.sectionId);
  else {
    const changed = node.kind === 'room' ? state.scene.enterRoom() : state.scene.leaveRoom();
    if (changed === false) return;
    state.nodeId = target; state.roomEntered = node.kind === 'room';
    updateRoute(); writeHash();
    announce(`${title(current())}，${state.roomEntered ? '室内观察点，可拖动环顾' : '已返回走廊，可选择下一段路线'}。`);
  }
}
function updateCaption() {
  const section = current();
  els['section-title'].textContent = title(section);
  els['section-english'].textContent = (section.title || 'DREAMWORKS OFFICE').toUpperCase();
  els['section-number'].textContent = pad(section.id);
  els['section-description'].textContent = section.description || '沿着参观动线，发现这里的空间与日常。';
}
function buildThumbnails() {
  els.thumbnails.replaceChildren();
  const photos = current().photos || [];
  if (!photos.length) { els.thumbnails.append(textElement('p', '本节点暂无可用影像，仍可继续沿路线参观。', 'strip-empty')); return; }
  photos.forEach((photo, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = `thumbnail${index === state.view ? ' active' : ''}`; button.setAttribute('aria-label', `查看${title(current())}，视角 ${index + 1}`); button.setAttribute('aria-pressed', String(index === state.view)); button.dataset.view = index;
    const img = document.createElement('img'); img.src = mediaUrl(photo.thumb || photo.src); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.addEventListener('error', () => { img.remove(); button.classList.add('is-broken'); button.append(textElement('span', `${index + 1}`)); });
    button.append(img, textElement('span', pad(index + 1)));
    button.addEventListener('click', () => { state.view = index; if (state.mode !== 'photo') setMode('photo'); else renderPhoto(); writeHash(); });
    els.thumbnails.append(button);
  });
}
function updateThumbSelection() {
  for (const button of els.thumbnails.querySelectorAll('button')) {
    const selected = Number(button.dataset.view) === state.view;
    button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
  }
}
function clampPan() {
  const rect = els['photo-stage'].getBoundingClientRect();
  const maxX = rect.width * (state.zoom - 1) / 2; const maxY = rect.height * (state.zoom - 1) / 2;
  state.x = Math.max(-maxX, Math.min(maxX, state.x)); state.y = Math.max(-maxY, Math.min(maxY, state.y));
}
function applyTransform() { clampPan(); els['room-image'].style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.zoom})`; els['zoom-out'].disabled = state.zoom <= 1; els['zoom-in'].disabled = state.zoom >= 4; }
function resetPhoto() { state.zoom = 1; state.x = 0; state.y = 0; applyTransform(); }
function updatePhotoFit() { els.viewer.classList.toggle('fit-photo', state.fitPhoto); els['fit-photo'].setAttribute('aria-pressed', String(state.fitPhoto)); els['fit-photo'].setAttribute('aria-label', state.fitPhoto ? '切换为沉浸填充' : '显示完整照片'); resetPhoto(); }
function zoomPhoto(delta) { if (state.mode !== 'photo' || !current()?.photos?.length || state.photoError) return; state.zoom = Math.min(4, Math.max(1, state.zoom + delta)); applyTransform(); }
function renderPhoto() {
  const section = current(); const photos = section.photos || []; const token = ++state.imageToken;
  resetPhoto(); state.photoError = false; updateThumbSelection();
  els['photo-index'].textContent = photos.length ? `${pad(state.view + 1)} / ${pad(photos.length)}` : '影像待补充';
  if (!photos.length) {
    els['room-image'].removeAttribute('src'); els['room-image'].alt = ''; els['photo-backdrop'].style.backgroundImage = 'none';
    showMessage('这一站，留待相见', '第 ' + pad(section.id) + ' 站的原始素材尚未提供。这里保留路线节点，继续前往下一处空间。');
    els['zoom-in'].disabled = true; els['zoom-out'].disabled = true;
    return;
  }
  const photo = photos[state.view];
  const img = els['room-image']; img.classList.add('loading');
  showMessage('正在抵达', `${title(section)} · 视角 ${state.view + 1}`);
  img.onload = () => { if (token !== state.imageToken || state.mode !== 'photo') return; img.classList.remove('loading'); hideMessage(); state.photoError = false; };
  img.onerror = () => { if (token !== state.imageToken || state.mode !== 'photo') return; state.photoError = true; img.classList.remove('loading'); showMessage('这张影像暂时无法载入', '可以重试，或切换其他视角继续参观。', true); };
  img.alt = photo.caption || `${title(section)} — 实景照片，视角 ${state.view + 1}`;
  img.src = mediaUrl(photo.src);
  els['photo-backdrop'].style.backgroundImage = `url(${JSON.stringify(mediaUrl(photo.thumb || photo.src))})`;
  if (img.complete && img.naturalWidth > 0) { img.classList.remove('loading'); hideMessage(); }
}
async function ensureScene() {
  if (state.scene) return state.scene;
  if (!state.scenePromise) {
    state.scenePromise = import('./scene.js').then(async ({ createOfficeScene }) => {
      state.sceneError = false;
      const scene = await createOfficeScene({ container: els['scene-stage'], sections: state.sections, connections: state.data.connections || [], onSelect: (id) => selectSection(id), onMove: moveNavigation, onError: (error) => { state.sceneError = true; renderNavigation(); if (state.mode !== 'photo') showMessage('3D 画面暂不可用', '浏览器未能启动 3D 渲染。请切换到实景漫游，所有空间影像仍可查看。'); console.warn('Office scene:', error?.message || error); } });
      state.scene = scene; return scene;
    }).catch((error) => { state.scenePromise = null; throw error; });
  }
  return state.scenePromise;
}
async function setMode(mode) {
  if (!modes.has(mode)) return;
  state.mode = mode; writeHash();
  for (const button of document.querySelectorAll('[data-mode]')) { const active = button.dataset.mode === mode; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); }
  const isPhoto = mode === 'photo';
  state.roomEntered = false;
  if (mode !== 'walk') state.nodeId = `c${current().id}`;
  els['enter-room'].innerHTML = '进入空间 <span aria-hidden="true">↗</span>';
  els['walk-room-controls'].classList.toggle('hidden', mode !== 'walk');
  state.scene?.setActive?.(!isPhoto);
  els['viewer'].classList.toggle('is-3d', !isPhoto); els['viewer'].classList.toggle('is-walk', mode === 'walk'); els['photo-stage'].classList.toggle('hidden', !isPhoto); els['scene-stage'].classList.toggle('hidden', isPhoto);
  els['layout-pending'].classList.toggle('hidden', isPhoto);
  for (const id of ['fit-photo', 'zoom-in', 'zoom-out']) els[id].classList.toggle('hidden', !isPhoto);
  els['image-type'].textContent = isPhoto ? '▣  实景照片' : mode === 'overview' ? '◇  3D 路线空间示意' : '↗  3D 路线体验 · 示意';
  els['interaction-hint'].textContent = isPhoto ? '切换视角 · 放大后可拖动查看 · 左右键切换空间' : mode === 'overview' ? '拖动旋转 · 滚轮缩放 · 点击节点选择空间 · 视频校准待完成' : '箭头选择连接 · 房间需原路返回 · 拖动或 ← → 环顾';
  els['views-title'].textContent = isPhoto ? '空间视角' : '本站实景';
  els['views-note'].textContent = isPhoto ? 'PHOTO PERSPECTIVES' : 'CLICK TO VIEW PHOTO';
  renderNavigation(); writeHash();
  if (isPhoto) { renderPhoto(); return; }
  els['photo-index'].textContent = `${pad(current().id)} / ${pad(state.sections.length)}`;
  showMessage('正在构建空间', '沿着原始素材的顺序，串联我们的参观动线。');
  try {
    const scene = await ensureScene();
    if (state.mode === 'photo') return;
    if (state.sceneError) { showMessage('3D 画面暂不可用', '请切换到实景漫游继续参观。3D 模式需要支持 WebGL 的浏览器。'); return; }
    scene.setActive?.(true); scene.setDirection?.(state.direction); scene.setMode(state.mode); scene.selectSection(current().id, false);
    if (state.mode === 'walk' && state.nodeId.startsWith('r')) state.roomEntered = scene.enterRoom() !== false;
    scene.resize?.(); hideMessage(); renderNavigation();
  } catch (error) {
    console.warn('Unable to initialize 3D scene:', error?.message || error);
    if (state.mode !== 'photo') showMessage('3D 画面暂不可用', '请切换到实景漫游继续参观。3D 模式需要支持 WebGL 的浏览器。');
  }
}
function selectSection(id, { keepView = false, keepNode = false } = {}) {
  const index = state.sections.findIndex((section) => Number(section.id) === Number(id)); if (index < 0) return;
  state.index = index; if (!keepView) state.view = 0;
  if (!keepNode) state.nodeId = `c${current().id}`;
  state.roomEntered = false; els['enter-room'].innerHTML = '进入空间 <span aria-hidden="true">↗</span>';
  updateRoute(); updateCaption(); buildThumbnails();
  if (state.mode === 'photo') renderPhoto(); else { state.scene?.selectSection(current().id); els['photo-index'].textContent = `${pad(current().id)} / ${pad(state.sections.length)}`; }
  writeHash(); announce(`第 ${current().id} 站，${title(current())}。${current().photos?.length || 0} 个实景视角。`);
}
function stepSection(delta) { if (!state.sections.length) return; if (state.mode === 'walk') { moveNavigation(delta > 0 ? 'forward' : 'back'); return; } selectSection(state.sections[wrap(state.index + delta * state.direction, state.sections.length)].id); }
function stepPhoto(delta) { const count = current()?.photos?.length || 0; if (!count || state.mode !== 'photo') return; state.view = wrap(state.view + delta, count); renderPhoto(); writeHash(); announce(`视角 ${state.view + 1}，共 ${count} 个实景视角。`); }
function appendParagraph(container, text, className) { container.append(textElement('p', text, className)); }
function showInfo(roomOnly = false) {
  if (!current()) return;
  const section = current(); const content = els['dialog-content']; content.replaceChildren();
  els['dialog-title'].textContent = roomOnly ? title(section) : '让真实空间，慢慢展开';
  if (roomOnly) {
    appendParagraph(content, `${pad(section.id)} / ${pad(state.sections.length)} · ${(section.photos || []).length} 个实景视角`, 'detail-meta');
    appendParagraph(content, section.description || '沿着顺时针动线，探索当前空间。');
    if (section.features?.length) { const features = textElement('div', '', 'features'); for (const feature of section.features) features.append(textElement('span', feature, 'feature-tag')); content.append(features); }
    const connection = (state.data.connections || []).find((link) => Number(link.from) === Number(section.id));
    if (connection) { content.append(textElement('h3', '与下一站的连接')); appendParagraph(content, connection.evidence || '连接依照提供的文件夹顺序整理，具体门口位置待现场核对。'); appendParagraph(content, `连接确认程度：${({ high: '较高', medium: '部分确认', low: '推定，待现场核对', inferred: '推定，待现场核对', 'visual-match': '有画面线索支持', 'sequence-only': '依据素材序号串联，待现场核对', unverified: '尚未验证，待现场核对' })[connection.confidence] || '待核对'}`, 'detail-meta'); }
    if (section.sourceNote) appendParagraph(content, section.sourceNote);
  } else {
    appendParagraph(content, '通过 14 个依次串联的空间节点，从接待前厅出发，看看办公、会客与连接走廊。你可以顺时针前行，也可以随时反向，或直接选一处感兴趣的空间。');
    content.append(textElement('h3', '三种方式，认识同一个地方'));
    appendParagraph(content, '实景漫游：逐张浏览现场照片，放大后拖动查看细节。3D 空间图：查看当前的路线示意。3D 路线体验：沿节点之间的连接前进、后退，选择分支进入房间，再从同一入口返回走廊。');
  }
  const note = textElement('div', '', 'accuracy-note'); note.append(textElement('h3', '关于准确性'));
  appendParagraph(note, '实景影像来自提供的原始素材，为普通照片，并非 360° 全景。切换视角可看见已拍摄的方向；未拍摄的区域不会被补绘为真实影像。');
  appendParagraph(note, '3D 模型仍是路线示意，不是测绘平面图。新增步行视频约 4.96 GB，超过本次连接器读取上限，尚未完成视频解析。环形排布、房间尺寸、相对角度和门洞位置仍待视频与现场校准，不能用作施工、测量或疏散指引。第 11 站现已接入 5 张原始实景。');
  content.append(note);
  if (state.data.source?.notice) appendParagraph(content, state.data.source.notice, 'detail-meta');
  if (Array.isArray(state.data.source?.limitations) && state.data.source.limitations.length) { content.append(textElement('h3', '素材说明')); const list = document.createElement('ul'); for (const limitation of state.data.source.limitations) list.append(textElement('li', limitation)); content.append(list); }
  content.append(textElement('h3', '小提示'));
  appendParagraph(content, '实景模式：← → 切换空间；A / D 切换照片；+ / − 放大缩小；R 重置画面。手机可滑动照片切换视角；放大后拖动查看。3D 路线模式：点击画面后，用 ↑ ↓ 前进后退，← → 环顾，也可使用下方空间箭头。');
  if (state.scene?.exportGLB && !state.sceneError) {
    const download = textElement('button', '↓ 下载 3D 示意模型 · GLB', 'export-model'); download.type = 'button';
    download.addEventListener('click', async () => { download.disabled = true; download.textContent = '正在导出…'; try { const blob = await state.scene.exportGLB(); if (blob instanceof Blob) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'dreamworks-office-route-schematic.glb'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); } download.textContent = '↓ 再次下载 3D 示意模型'; } catch { download.textContent = '导出失败，请重试'; } finally { download.disabled = false; } }); content.append(download);
  }
  els['info-dialog'].showModal();
}
function closeInfo() { els['info-dialog'].close(); }
for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => { if (current()) setMode(button.dataset.mode); });
els['previous-stop'].addEventListener('click', () => stepSection(-1)); els['next-stop'].addEventListener('click', () => stepSection(1));
els['reverse-direction'].addEventListener('click', () => { if (!current()) return; state.direction *= -1; updateRoute(); writeHash(); state.scene?.setDirection?.(state.direction); announce(state.direction === 1 ? '已切换为顺时针方向' : '已切换为逆时针方向'); });
els.restart.addEventListener('click', () => { if (!current()) return; state.direction = 1; state.scene?.setDirection?.(1); selectSection(state.sections[0].id); });
els['zoom-in'].addEventListener('click', () => zoomPhoto(.4)); els['zoom-out'].addEventListener('click', () => zoomPhoto(-.4));
els['fit-photo'].addEventListener('click', () => { state.fitPhoto = !state.fitPhoto; updatePhotoFit(); announce(state.fitPhoto ? '已显示完整照片。' : '已切换为沉浸填充。'); });
els['enter-room'].addEventListener('click', () => moveNavigation(state.nodeId.startsWith('r') ? 'exit' : 'enter'));
for (const button of els['navigation-dock'].querySelectorAll('[data-move]')) button.addEventListener('click', () => moveNavigation(button.dataset.move));
for (const button of els['navigation-dock'].querySelectorAll('[data-look]')) button.addEventListener('click', () => state.scene?.look?.(Number(button.dataset.look)));
els['reset-view'].addEventListener('click', () => { if (state.mode === 'photo') resetPhoto(); else if (state.scene) { state.scene.setMode(state.mode); state.scene.selectSection(current().id, false); if (state.mode === 'walk' && state.nodeId.startsWith('r')) state.scene.enterRoom(); } });
els['retry-image'].addEventListener('click', renderPhoto);
els['fullscreen'].addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (els.viewer.requestFullscreen) await els.viewer.requestFullscreen(); else announce('当前浏览器暂不支持全屏，可横屏查看。'); } catch { announce('当前浏览器未能进入全屏。'); } });
document.addEventListener('fullscreenchange', () => { els.fullscreen.setAttribute('aria-label', document.fullscreenElement ? '退出全屏' : '全屏参观'); state.scene?.resize?.(); });
els['open-info'].addEventListener('click', () => showInfo()); els['open-room-info'].addEventListener('click', () => showInfo(true)); els['open-accuracy'].addEventListener('click', () => showInfo()); els['close-info'].addEventListener('click', closeInfo); els['dialog-done'].addEventListener('click', closeInfo);
els['info-dialog'].addEventListener('click', (event) => { if (event.target === els['info-dialog']) { const rect = els['info-dialog'].getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeInfo(); } });
document.addEventListener('keydown', (event) => {
  if (!current() || event.defaultPrevented || els['info-dialog'].open || /INPUT|TEXTAREA|SELECT|CANVAS/.test(event.target.tagName) || event.metaKey || event.ctrlKey) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); event.altKey ? stepPhoto(1) : stepSection(1); }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); event.altKey ? stepPhoto(-1) : stepSection(-1); }
  else if (event.key.toLowerCase() === 'a') stepPhoto(-1);
  else if (event.key.toLowerCase() === 'd') stepPhoto(1);
  else if (event.key === '+' || event.key === '=') zoomPhoto(.4);
  else if (event.key === '-') zoomPhoto(-.4);
  else if (event.key.toLowerCase() === 'r') els['reset-view'].click();
});
let pointerStart = null;
els['photo-stage'].addEventListener('pointerdown', (event) => { if (state.mode !== 'photo' || event.button > 0) return; pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: state.x, panY: state.y, started: performance.now() }; els['photo-stage'].setPointerCapture(event.pointerId); els['photo-stage'].classList.add('is-dragging'); });
els['photo-stage'].addEventListener('pointermove', (event) => { if (!pointerStart || event.pointerId !== pointerStart.id || state.zoom === 1) return; state.x = pointerStart.panX + event.clientX - pointerStart.x; state.y = pointerStart.panY + event.clientY - pointerStart.y; applyTransform(); });
function endPointer(event) { if (!pointerStart || pointerStart.id !== event.pointerId) return; const dx = event.clientX - pointerStart.x; const dy = event.clientY - pointerStart.y; if (event.type === 'pointerup' && state.zoom === 1 && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - pointerStart.started < 900) stepPhoto(dx < 0 ? 1 : -1); pointerStart = null; els['photo-stage'].classList.remove('is-dragging'); }
els['photo-stage'].addEventListener('pointerup', endPointer); els['photo-stage'].addEventListener('pointercancel', endPointer);
els['photo-stage'].addEventListener('dblclick', () => zoomPhoto(state.zoom > 1 ? 1 - state.zoom : 1));
els['photo-stage'].addEventListener('wheel', (event) => { if (!event.ctrlKey && !event.metaKey) return; event.preventDefault(); zoomPhoto(event.deltaY < 0 ? .15 : -.15); }, { passive: false });
window.addEventListener('resize', () => { applyTransform(); state.scene?.resize?.(); });
window.addEventListener('hashchange', () => { if (!state.sections.length) return; readHash(); selectSection(current().id, { keepView: true, keepNode: true }); setMode(state.mode); });
async function configureTourSession() {
  try {
    const response = await fetch('/api/office-tour-auth/status', { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const status = await response.json();
    if (status.authenticated && !status.public) els['tour-logout']?.classList.remove('hidden');
  } catch {
    // The standalone beta can still run under a plain local static server.
  }
}
els['tour-logout']?.addEventListener('click', async () => {
  els['tour-logout'].disabled = true;
  try {
    await fetch('/api/office-tour-auth/logout', { method: 'POST', headers: { Accept: 'application/json' } });
  } finally {
    location.replace('/office-tour/');
  }
});
async function init() {
  void configureTourSession();
  try {
    const response = await fetch('./data/tour.json'); if (!response.ok) throw new Error(`Tour data ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.sections) || !data.sections.length) throw new Error('Tour has no sections');
    state.data = data; state.sections = [...data.sections].sort((a, b) => Number(a.id) - Number(b.id)); state.byId = new Map(state.sections.map((section) => [Number(section.id), section]));
    state.graph = createNavigation(state.sections, data.connections || []);
    readHash(); buildRoute(); updatePhotoFit(); selectSection(current().id, { keepView: true, keepNode: true }); await setMode(state.mode);
  } catch (error) {
    console.error('Office tour data failed:', error?.message || error);
    showMessage('参观资料暂未载入', '请确认本地预览服务已启动，并刷新页面重试。'); els['route-list'].replaceChildren(textElement('p', '暂时无法读取空间索引。', 'route-loading')); els['section-description'].textContent = '原始影像与路线数据载入后，即可开始参观。';
  }
}
init();

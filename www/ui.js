/* ═══════════════════════════════════════════════════════════
   Reverie — UI Layer (ui.js)
   ═══════════════════════════════════════════════════════════ */

// ─── NAVIGATION ───────────────────────────────────────────
function go(screen) { S.screen = screen; render(); }
async function goDetail(id) { S.activeChar = S.chars.find(c=>c.id===id); if (!S.activeChar) return; S.screen = 'charDetail'; render(); }
async function goChat(id) { try { S.activeChar = S.chars.find(c=>c.id===id); if (!S.activeChar) return; S.msgs = await AppDB.get('msgs_'+id) || []; S.activeCharCfg = await AppDB.get('charcfg_'+id) || { style:'default', ctxLimit:20, memory:'', authorsNote:'' }; S.activeSessions = await AppDB.get('sess_'+id) || []; if (!S.msgs.length) { const p = S.personas.find(x=>x.id===S.activePersona); const uName = p ? p.name : 'You'; const allGreetings = [S.activeChar.firstMsg, ...(S.activeChar.altGreetings||[])].filter(Boolean); if (allGreetings.length) { const swipeTexts = allGreetings.map(g => replacePlaceholders(g, S.activeChar.name, uName)); const startIdx = Math.floor(Math.random() * swipeTexts.length); S.msgs = [{ role:'assistant', content: swipeTexts[startIdx], swipes: swipeTexts, swipeIdx: startIdx }]; await saveMsgs(); await updateActiveChat(id, swipeTexts[startIdx]); } } S.screen = 'chat'; render(); } catch (err) { console.error(err); showToast("Failed to start chat: " + err.message, 'error'); } }

// ─── ROOT RENDER ──────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  const screens = { home:renderHome, chat:renderChat, editChar:renderEditChar, personas:renderPersonas, editPersona:renderEditPersona, settings:renderSettings, charDetail:renderCharDetail, chats:renderChatsPage };
  const showNav = ['home','personas','settings','chats'].includes(S.screen);
  app.innerHTML = (screens[S.screen]||renderHome)() + (showNav ? renderBottomNav() : '');
  afterRender();
}

// ─── M3 BOTTOM NAV ────────────────────────────────────────
function renderBottomNav() {
  const items = [
    { screen:'chats',    icon:'message-circle', label:'Chats'    },
    { screen:'home',     icon:'compass',        label:'Explore'  },
    { screen:'editChar', icon:'circle-plus',    label:'Create',  action:'newChar()' },
    { screen:'personas', icon:'user',           label:'Profile'  },
    { screen:'settings', icon:'settings',       label:'Settings' },
  ];
  return `<nav class="m3-nav pb-safe">${items.map(it => {
    const active = S.screen === it.screen;
    const onclick = it.action || `go('${it.screen}')`;
    return `<button onclick="${onclick}" class="m3-nav-item${active?' active':''}">
      <div class="m3-nav-indicator"><i data-lucide="${it.icon}" width="22" height="22" class="lucide-icon"></i></div>
      <span class="m3-nav-label">${it.label}</span>
    </button>`;
  }).join('')}</nav>`;
}

function afterRender() {
  if (window.lucide) lucide.createIcons();
  if (S.screen === 'chat') {
    scrollBottom();
    const inp = document.getElementById('msgInput');
    if (inp) {
      toggleSendIcon(inp.value);
      inp.addEventListener('input', () => { resizeInput(inp); toggleSendIcon(inp.value); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendClick(); } });
    }
  }
}
function scrollBottom() { setTimeout(() => { const el = document.getElementById('msgs'); if (el) el.scrollTop = el.scrollHeight + 100; }, 30); }
function resizeInput(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
function toggleSendIcon(val) { const send = document.getElementById('icon-send'); const cont = document.getElementById('icon-continue'); if (!send || !cont) return; if (val.trim()) { send.classList.remove('hidden'); cont.classList.add('hidden'); } else { send.classList.add('hidden'); cont.classList.remove('hidden'); } }

// ─── SEND / REGEN ─────────────────────────────────────────
async function handleSendClick() { const val = document.getElementById('msgInput')?.value.trim(); if (val) await doSend(val, false); else await doSend(null, true); }

async function doSend(textParam = null, isContinue = false) {
  if (S.typing) return;
  const inp = document.getElementById('msgInput');
  let text = textParam !== null ? textParam : inp?.value?.trim();
  if (!isContinue && !text) return;
  if (inp) { inp.value = ''; inp.style.height = 'auto'; toggleSendIcon(''); }
  if (!isContinue) { S.msgs.push({ role:'user', content:text }); saveMsgs(); }
  S.typing = true;
  const aiMsg = { role:'assistant', content:'', swipes:[''], swipeIdx:0 };
  S.msgs.push(aiMsg);
  const targetIdx = S.msgs.length - 1;
  render(); scrollBottom();
  const c = S.activeChar; const p = S.personas.find(x=>x.id===S.activePersona);
  try {
    const reply = await callTokenReply(isContinue, targetIdx);
    aiMsg.content = reply; aiMsg.swipes[0] = reply; aiMsg.swipeIdx = 0;
    await updateActiveChat(c.id, reply);
  } catch(e) {
    aiMsg.content = `*[Error: ${e.message}]*`;
    showToast(e.message, 'error');
  }
  S.typing = false; saveMsgs(); render();
}

async function regenLast() {
  if (S.typing) return;
  const idx = [...S.msgs].reverse().findIndex(m=>m.role==='assistant');
  if (idx<0) return;
  const targetMsgIdx = S.msgs.length - 1 - idx;
  const targetMsg = S.msgs[targetMsgIdx];
  if (!targetMsg.swipes) { targetMsg.swipes = [targetMsg.content]; targetMsg.swipeIdx = 0; }
  S.typing = true;
  targetMsg.swipes.push('');
  targetMsg.swipeIdx = targetMsg.swipes.length - 1;
  targetMsg.content = '';
  render(); scrollBottom();
  const c = S.activeChar;
  try {
    const reply = await callTokenReply(false, targetMsgIdx);
    targetMsg.swipes[targetMsg.swipeIdx] = reply;
    targetMsg.content = reply;
    await updateActiveChat(c.id, reply);
  } catch(e) { showToast("Regen failed: " + e.message, 'error'); }
  S.typing = false; await saveMsgs(); render();
}

// ─── BOTTOM SHEET ─────────────────────────────────────────
let bsCallback = null;
function openBottomSheet(title, options, selectedValue, callback) { document.getElementById('bsTitle').innerText = title; let html = ''; options.forEach(opt => { const isSel = opt.value === selectedValue; html += `<button onclick="handleBsSelect('${opt.value}')" class="flex justify-between items-center p-3.5 rounded-2xl ${isSel ? 'bg-raised text-white' : 'text-dim hover:bg-raised/50'} transition-colors text-left w-full"><span class="font-medium text-[15px]">${esc(opt.label)}</span><i data-lucide="${isSel ? 'check-circle' : 'circle'}" width="20" height="20" style="color:${isSel ? 'var(--ac-hex)' : '#3f3f46'}" class="lucide-icon"></i></button>`; }); document.getElementById('bsOptions').innerHTML = html; if (window.lucide) lucide.createIcons(); bsCallback = callback; document.getElementById('bsOverlay').classList.add('active'); document.getElementById('bottomSheet').classList.add('open'); }
function closeBottomSheet() { document.getElementById('bsOverlay').classList.remove('active'); document.getElementById('bottomSheet').classList.remove('open'); }
function handleBsSelect(val) { if (bsCallback) bsCallback(val); closeBottomSheet(); }
function openSelectModel() { 
  const opts = getProviderModels().map(m => ({ value: m.id, label: m.name }));
  opts.push({ value: 'CUSTOM', label: 'Enter Custom Model ID...' });
  openBottomSheet('Select Model', opts, S.cfg.model, async (val) => { 
    if (val === 'CUSTOM') {
      const custom = await customPrompt('Enter Custom Model ID', S.cfg.model);
      if (custom && custom.trim()) { S.cfg.model = custom.trim(); save(); render(); }
    } else {
      S.cfg.model = val; save(); render(); 
    }
  }); 
}
function openSelectProvider() { const opts = Object.keys(API_PROVIDERS).map(id => ({ value: id, label: API_PROVIDERS[id].name })); openBottomSheet('Select API Provider', opts, S.cfg.provider, (val) => { S.cfg.provider = val; S.cfg.model = API_PROVIDERS[val].models[0].id; save(); render(); }); }
function openSelectPersona() { openBottomSheet('Playing As', [{value: '', label: 'No Persona'}].concat(S.personas.map(p => ({ value: p.id, label: p.name }))), S.activePersona || '', async (val) => { S.activePersona = val || null; await save(); render(); }); }
function openSelectStyle() { openBottomSheet('Chat Tone', Object.entries(STYLE_NAMES).map(([value, label]) => ({ value, label })), S.activeCharCfg.style || 'default', async (val) => { S.activeCharCfg.style = val; await AppDB.set('charcfg_'+S.activeChar.id, S.activeCharCfg); render(); }); }

// ─── CHATS PAGE ───────────────────────────────────────────
function renderChatsPage() {
  if (!S.activeChats) S.activeChats = [];
  const activeList = S.activeChats.filter(ac => S.chars.some(c => c.id === ac.id));
  return `<div class="screen bg-bg fade-in">
    <div class="m3-top-bar pt-safe"><span class="m3-top-title">Chats</span></div>
    <div class="flex-1 overflow-y-auto px-4 py-3 pb-[100px] flex flex-col gap-2">
      ${activeList.length ? activeList.map(ac => {
        const c = S.chars.find(x => x.id === ac.id);
        return `<div class="m3-list-item btn-press" onclick="goChat('${c.id}')">
          <div class="m3-avatar">${c.img ? `<img src="${c.img}" class="w-full h-full object-cover"/>` : `<span>${c.emoji||'🤖'}</span>`}</div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-white text-[15px] truncate">${esc(c.name)}</div>
            <div class="text-[13px] text-dim truncate mt-0.5">${esc(ac.lastMsg)}</div>
          </div>
          <button onclick="event.stopPropagation(); removeActiveChat('${c.id}')" class="text-dim hover:text-red-400 p-2 shrink-0 btn-press"><i data-lucide="trash-2" width="18" height="18" class="lucide-icon"></i></button>
        </div>`;
      }).join('') : `<div class="text-center text-dim py-20 text-sm flex flex-col items-center gap-3">
        <i data-lucide="message-circle" width="48" height="48" class="opacity-20 lucide-icon"></i>
        <span>No active chats.<br/>Head to Explore to start one.</span>
      </div>`}
    </div>
  </div>`;
}

// ─── EXPLORE / HOME ───────────────────────────────────────
let currentLimit = 20; let searchTimeout;
function getDynamicTags() { const counts = {}; S.chars.forEach(c => { if(c.tags) c.tags.forEach(t => { const tl=t.trim().toLowerCase(); if(tl) counts[tl]=(counts[tl]||0)+1; }); }); return Object.keys(counts).sort((a,b) => counts[b] - counts[a]).slice(0, 20); }
function getVisibleChars() { const q = S.searchQuery.toLowerCase(); const t = S.activeTag; return S.chars.filter(c => { const isNsfw = c.tags?.some(tag => tag.toLowerCase().includes('nsfw')) || (c.tagline||'').toLowerCase().includes('nsfw'); if (!S.cfg.showNsfw && isNsfw) return false; if (t && !(c.tags||[]).some(tag => tag.toLowerCase() === t)) return false; if (!q) return true; return c.name.toLowerCase().includes(q) || (c.tagline||'').toLowerCase().includes(q); }); }

function renderHome() {
  currentLimit = 20; const chars = getVisibleChars(); const tags = getDynamicTags();
  return `<div class="screen bg-bg fade-in">
    <div class="px-4 pt-safe shrink-0 bg-bg">
      <div class="flex items-center justify-between py-3">
        <span class="font-bold text-[22px] font-display" style="color:var(--ac-hex)">Reverie</span>
        <label for="importFile" class="btn-press w-9 h-9 flex items-center justify-center bg-card rounded-full cursor-pointer border border-border">
          <i data-lucide="file-up" width="18" height="18" style="color:#8b8b99" class="lucide-icon"></i>
        </label>
        <input type="file" id="importFile" accept=".json,.png,.webp" class="hidden" multiple onchange="importChar(event)"/>
      </div>
      <div class="m3-search-bar mb-2">
        <i data-lucide="search" width="18" height="18" style="color:#8b8b99" class="lucide-icon shrink-0"></i>
        <input id="searchIn" placeholder="Search characters…" value="${S.searchQuery}" oninput="doSearch(this.value)" class="flex-1 bg-transparent border-none outline-none text-[15px] text-white placeholder-dim"/>
      </div>
      ${tags.length ? `<div class="tag-scroll pb-2">${
        ['all', ...tags].map(tag => {
          const active = tag === 'all' ? !S.activeTag : S.activeTag === tag;
          return `<button onclick="toggleTag(${tag==='all'?'null':`'${tag}'`})" class="m3-chip${active?' active':''}">${tag === 'all' ? 'All' : tag}</button>`;
        }).join('')
      }</div>` : ''}
    </div>
    <div id="charGrid" onscroll="handleScroll(this)" class="flex-1 overflow-y-auto px-4 pb-[100px] grid grid-cols-2 gap-3 content-start pt-2">
      ${renderCards(chars.slice(0, currentLimit)) || renderEmptyHome()}
    </div>
  </div>`;
}

function toggleTag(tag) { S.activeTag = tag; render(); }
function renderEmptyHome() {
  const hasAny = S.chars.length > 0;
  if (hasAny) return `<div class="col-span-2 text-center text-dim py-10 text-sm">No characters found.</div>`;
  return `<div class="col-span-2 flex flex-col items-center text-center gap-5 pt-10 pb-6 px-2">
    <div class="w-20 h-20 rounded-full flex items-center justify-center" style="background:radial-gradient(circle, color-mix(in srgb, var(--ac-hex) 22%, transparent), transparent 70%)">
      <i data-lucide="sparkles" width="34" height="34" style="color:var(--ac-hex)" class="lucide-icon"></i>
    </div>
    <div>
      <div class="font-display text-[22px] text-white leading-tight">Your roster is empty</div>
      <div class="text-[13px] text-dim mt-1.5 max-w-[240px] mx-auto leading-snug">Bring in character cards or restore a backup to get started.</div>
    </div>
    <div class="flex flex-col gap-2.5 w-full max-w-[260px]">
      <label for="importFile" class="btn-press flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-bold cursor-pointer shadow-lg" style="background:var(--ac-hex); color:#09090b">
        <i data-lucide="file-up" width="18" height="18" class="lucide-icon"></i> Import Data
      </label>
      <button onclick="newChar()" class="btn-press flex items-center justify-center gap-2 bg-card border border-border text-white rounded-2xl py-3.5 text-[14px] font-bold">
        <i data-lucide="plus" width="18" height="18" class="lucide-icon"></i> Create Character
      </button>
    </div>
  </div>`;
}
function renderCards(chars) { return chars.map(c => `<div class="m3-card btn-press" style="padding-bottom:133.33%;" onclick="goDetail('${c.id}')"><div class="absolute inset-0 flex items-center justify-center text-5xl bg-card z-0">${c.emoji||'🤖'}</div>${c.img ? `<img src="${c.img}" onerror="this.style.display='none'" class="absolute inset-0 w-full h-full object-cover z-10" loading="lazy"/>` : ''}<div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent z-20"></div><div class="absolute inset-0 p-3 flex flex-col justify-end z-30"><div class="font-semibold text-[15px] text-white truncate leading-tight">${esc(c.name)}</div><div class="text-[12px] text-white/70 mt-0.5 line-clamp-2 leading-snug">${esc(c.tagline||c.desc?.slice(0,60)||'')}</div></div></div>`).join(''); }
function doSearch(q) { S.searchQuery = q; clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { currentLimit = 20; const chars = getVisibleChars(); const grid = document.getElementById('charGrid'); if (grid) { grid.innerHTML = renderCards(chars.slice(0, currentLimit)) || `<div class="col-span-2 text-center text-dim py-10 text-sm">No characters found.</div>`; grid.scrollTop = 0; } }, 150); }
function handleScroll(el) { if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) { const chars = getVisibleChars(); if (currentLimit < chars.length) { const nextBatch = chars.slice(currentLimit, currentLimit + 20); currentLimit += 20; el.insertAdjacentHTML('beforeend', renderCards(nextBatch)); } } }

// ─── CHAR DETAIL ──────────────────────────────────────────
function renderCharDetail() {
  const c = S.activeChar; if (!c) return '';
  const p = S.personas.find(x=>x.id===S.activePersona); const uName = p ? p.name : 'You';
  const descHasHtml = c.desc && (c.desc.includes('<p') || c.desc.includes('<br') || c.desc.includes('<div'));
  return `<div class="screen bg-bg fade-in">
    <div class="m3-top-bar pt-safe">
      <button onclick="go('home')" class="btn-press text-white p-1 mr-1"><i data-lucide="arrow-left" width="20" height="20" class="lucide-icon"></i></button>
      <span class="m3-top-title flex-1">Character</span>
      <button onclick="editCharById('${c.id}')" class="btn-press text-dim p-2"><i data-lucide="pencil" width="20" height="20" class="lucide-icon"></i></button>
      <button onclick="delChar('${c.id}')" class="btn-press text-red-500 p-2"><i data-lucide="trash-2" width="20" height="20" class="lucide-icon"></i></button>
    </div>
    <div class="flex-1 overflow-y-auto px-5 py-6 pb-28 flex flex-col gap-6">
      <div class="flex flex-col items-center">
        <div class="w-28 h-28 rounded-3xl bg-card overflow-hidden relative shadow-lg border border-border/50">
          <div class="absolute inset-0 flex items-center justify-center text-5xl bg-surface">${c.emoji||'🤖'}</div>
          ${c.img ? `<img src="${c.img}" class="absolute inset-0 w-full h-full object-cover"/>` : ''}
        </div>
        <h2 class="text-[20px] font-bold mt-4 text-white">${esc(c.name)}</h2>
        <p class="text-[14px] text-dim text-center mt-1.5 max-w-sm leading-relaxed">${esc(replacePlaceholders(c.tagline, c.name, uName))}</p>
        ${c.tags?.length ? `<div class="flex flex-wrap gap-2 justify-center mt-4">${c.tags.map(t => `<span class="m3-chip">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
      ${c.desc ? `<div><div class="m3-section-label">Description</div><div class="m3-info-block ${descHasHtml ? '' : 'whitespace-pre-wrap'}">${processDescriptionHTML(c.desc)}</div></div>` : ''}
      ${c.personality ? `<div><div class="m3-section-label">Personality</div><div class="m3-info-block whitespace-pre-wrap">${processChatText(replacePlaceholders(c.personality, c.name, uName))}</div></div>` : ''}
      ${c.scenario ? `<div><div class="m3-section-label">Scenario</div><div class="m3-info-block whitespace-pre-wrap">${processChatText(replacePlaceholders(c.scenario, c.name, uName))}</div></div>` : ''}
    </div>
    <div class="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-bg via-bg/90 to-transparent">
      <button onclick="goChat('${c.id}')" class="w-full bg-[var(--ac-hex)] text-bg py-4 rounded-[28px] font-bold text-[16px] shadow-lg flex justify-center items-center gap-2 btn-press">
        <i data-lucide="message-circle" width="20" height="20" class="lucide-icon"></i> Chat with ${esc(c.name)}
      </button>
    </div>
  </div>`;
}

// ─── CHAT SCREEN ──────────────────────────────────────────
function renderChat() {
  const c = S.activeChar;
  const p = S.personas.find(x=>x.id===S.activePersona);
  const cCfg = S.activeCharCfg;

  return `<div class="screen bg-bg fade-in" style="background:#0d0d10">

    <!-- Header -->
    <div class="chat-header pt-safe">
      <button onclick="goDetail('${c.id}')" class="btn-press p-2 text-white/70 shrink-0">
        <i data-lucide="arrow-left" width="20" height="20" class="lucide-icon"></i>
      </button>
      <div class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onclick="goDetail('${c.id}')">
        <div class="chat-header-avatar">
          ${c.img ? `<img src="${c.img}" onerror="this.style.display='none'" class="w-full h-full object-cover"/>` : `<span class="text-[18px]">${c.emoji||'🤖'}</span>`}
        </div>
        <div class="min-w-0">
          <div class="font-semibold text-[16px] text-white truncate leading-tight">${esc(c.name)}</div>
          <div class="text-[12px] mt-0.5 ${S.typing ? 'text-[var(--ac-hex)]' : 'text-white/40'}">
            ${S.typing ? 'typing…' : 'tap to view profile'}
          </div>
        </div>
      </div>
      <button onclick="toggleSidebar()" class="btn-press p-2 text-white/60 shrink-0">
        <i data-lucide="more-vertical" width="20" height="20" class="lucide-icon"></i>
      </button>
    </div>

    <!-- Messages -->
    <div id="msgs" class="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-0">
      ${S.msgs.map((m,i) => renderMsg(m,c,p,i)).join('')}
    </div>

    <!-- Input -->
    <div class="chat-input-area pb-safe">
      <div class="chat-input-row">
        <div class="chat-input-pill">
          <textarea id="msgInput" placeholder="Message…" rows="1"
            class="w-full bg-transparent border-none outline-none text-[15px] text-white placeholder-dim resize-none max-h-[120px] block leading-relaxed"></textarea>
        </div>
        <button onclick="handleSendClick()" id="sendBtn"
          class="chat-send-fab btn-press ${S.typing ? 'opacity-40 pointer-events-none' : ''}">
          <i id="icon-send" data-lucide="arrow-up" width="20" height="20" class="hidden lucide-icon"></i>
          <i id="icon-continue" data-lucide="fast-forward" width="18" height="18" class="lucide-icon"></i>
        </button>
      </div>
    </div>

    <!-- Sidebar overlay -->
    <div id="sidebarOverlay" class="fixed inset-0 sidebar-overlay z-40" onclick="toggleSidebar()"></div>
    <div id="chatSidebar" class="fixed right-0 top-0 h-full w-[88%] max-w-sm bg-surface border-l border-border transition-transform duration-300 translate-x-full z-50 flex flex-col shadow-2xl">
      <div class="px-5 py-4 border-b border-border flex justify-between items-center pt-safe shrink-0">
        <span class="font-bold text-[17px]">Chat Details</span>
        <button onclick="toggleSidebar()" class="text-dim p-1 btn-press"><i data-lucide="x" width="20" height="20" class="lucide-icon"></i></button>
      </div>
      <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <button onclick="startNewSession()" class="w-full bg-[var(--ac-hex)] text-bg py-3 rounded-[20px] font-bold text-[14px] flex justify-center items-center gap-2 shadow-md btn-press">
          <i data-lucide="message-square-plus" width="18" height="18" class="lucide-icon"></i> Save &amp; New Chat
        </button>
        <div class="bg-card p-4 rounded-[20px] flex flex-col gap-4 border border-border">
          <div>
            <label class="field-label">Playing As</label>
            <button onclick="openSelectPersona()" class="w-full bg-surface border border-border rounded-2xl px-4 py-3 flex justify-between items-center text-[14px] font-semibold text-white cursor-pointer">
              <span>${esc(getPersonaName(S.activePersona))}</span>
              <i data-lucide="chevron-down" width="18" height="18" style="color:#8b8b99" class="lucide-icon"></i>
            </button>
          </div>
          <div>
            <label class="field-label">Chat Tone</label>
            <button onclick="openSelectStyle()" class="w-full bg-surface border border-border rounded-2xl px-4 py-3 flex justify-between items-center text-[14px] font-semibold text-white cursor-pointer">
              <span>${esc(getStyleName(cCfg.style))}</span>
              <i data-lucide="chevron-down" width="18" height="18" style="color:#8b8b99" class="lucide-icon"></i>
            </button>
          </div>
          <div>
            <label class="field-label">Memory</label>
            <textarea id="sbMemory" oninput="updateSbMemory(this.value)"
              class="w-full bg-surface border border-border rounded-2xl p-3 text-[13px] text-white outline-none resize-none min-h-[72px] font-sans"
              placeholder="Summarize key events…">${esc(cCfg.memory||'')}</textarea>
          </div>
          <div>
            <label class="field-label">Author's Note</label>
            <textarea id="sbAuthorsNote" oninput="updateSbAuthor(this.value)"
              class="w-full bg-surface border border-border rounded-2xl p-3 text-[13px] text-white outline-none resize-none min-h-[52px] font-sans"
              placeholder="[System note…]">${esc(cCfg.authorsNote||'')}</textarea>
          </div>
        </div>
        <div>
          <label class="field-label border-t border-border pt-4 mt-1">History</label>
          <div class="flex flex-col gap-2 mt-2">${renderSessionsList()}</div>
        </div>
      </div>
    </div>
  </div>`;
}

function toggleSidebar() { document.getElementById('chatSidebar').classList.toggle('translate-x-full'); document.getElementById('sidebarOverlay').classList.toggle('active'); }
async function updateSbMemory(val) { S.activeCharCfg.memory = val; await AppDB.set('charcfg_'+S.activeChar.id, S.activeCharCfg); }
async function updateSbAuthor(val) { S.activeCharCfg.authorsNote = val; await AppDB.set('charcfg_'+S.activeChar.id, S.activeCharCfg); }

function renderSessionsList() {
  if (!S.activeSessions.length) return `<div class="text-[13px] text-dim">No older chats.</div>`;
  return S.activeSessions.map(s => `<div class="bg-card border border-border p-3 rounded-2xl flex justify-between items-center">
    <div class="flex-1 cursor-pointer" onclick="loadSession('${s.id}')">
      <div class="text-white text-[13px] font-semibold flex items-center gap-1.5">
        <i data-lucide="clock" width="13" height="13" style="color:#8b8b99" class="lucide-icon"></i>
        ${new Date(s.date).toLocaleDateString()}
      </div>
      <div class="text-dim text-[12px] line-clamp-1 mt-0.5">${esc(s.msgs[s.msgs.length-1]?.content || 'Empty')}</div>
    </div>
    <button onclick="deleteSession('${s.id}')" class="text-red-500 hover:text-red-400 p-2 btn-press"><i data-lucide="trash-2" width="18" height="18" class="lucide-icon"></i></button>
  </div>`).join('');
}

// ─── CHAT MESSAGES ────────────────────────────────────────
function renderMsg(m, c, p, idx) {
  const isUsr = m.role === 'user';
  const name  = isUsr ? (p?.name || 'You') : c.name;
  const img   = isUsr ? p?.img  : c.img;
  const emoji = isUsr ? (p?.emoji || '🧑') : (c.emoji || '🤖');
  const uName = p ? p.name : 'You';
  const txt   = processChatText(replacePlaceholders(m.content, c.name, uName));
  const swipes = m.swipes || [m.content];
  const swipeIdx = m.swipeIdx !== undefined ? m.swipeIdx : 0;

  const avatar = `<div class="msg-avatar shrink-0">
    ${img ? `<img src="${img}" onerror="this.style.display='none'" class="w-full h-full object-cover rounded-full"/>` : `<span>${emoji}</span>`}
  </div>`;

  if (isUsr) {
    return `<div class="flex flex-col items-end mb-3 group">
      <div class="flex items-end gap-2 justify-end w-full">
        <div class="flex flex-col items-end max-w-[78%]">
          <div class="msg-bubble-user">${txt}</div>
          <div class="msg-actions mt-1 mr-1">
            <button onclick="editMsg(${idx})" class="msg-act"><i data-lucide="pencil" width="14" height="14" class="lucide-icon"></i></button>
            <button onclick="delMsg(${idx})" class="msg-act danger"><i data-lucide="trash-2" width="14" height="14" class="lucide-icon"></i></button>
          </div>
        </div>
        ${avatar}
      </div>
    </div>`;
  }

  return `<div class="flex flex-col items-start mb-4 group">
    <div class="flex items-start gap-3 w-full">
      ${avatar}
      <div class="flex flex-col min-w-0 flex-1">
        <div class="text-[12px] font-semibold mb-1.5" style="color:var(--ac-hex)">${esc(name)}</div>
        <div class="msg-text" id="msg-txt-${idx}">${txt}</div>
        <div class="flex items-center gap-2 mt-2 flex-wrap">
          ${swipes.length > 1 ? `<div class="swipe-pill">
            <button onclick="prevSwipe(${idx})"><i data-lucide="chevron-left" width="15" height="15" class="lucide-icon"></i></button>
            <span>${swipeIdx + 1}/${swipes.length}</span>
            <button onclick="nextSwipe(${idx})"><i data-lucide="chevron-right" width="15" height="15" class="lucide-icon"></i></button>
          </div>` : ''}
          <button onclick="copyMsg(${idx})" class="msg-act"><i data-lucide="copy" width="14" height="14" class="lucide-icon"></i></button>
          <button onclick="editMsg(${idx})" class="msg-act"><i data-lucide="pencil" width="14" height="14" class="lucide-icon"></i></button>
          <button onclick="delMsg(${idx})" class="msg-act danger"><i data-lucide="trash-2" width="14" height="14" class="lucide-icon"></i></button>
          ${idx === S.msgs.length - 1 ? `<button onclick="regenLast()" class="msg-act ml-auto"><i data-lucide="refresh-cw" width="14" height="14" class="lucide-icon"></i></button>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function renderTyping() {
  return `<div class="flex items-start gap-3 mb-4 fade-in">
    <div class="msg-avatar shrink-0">
      ${S.activeChar?.img ? `<img src="${S.activeChar.img}" onerror="this.style.display='none'" class="w-full h-full object-cover rounded-full"/>` : `<span>${S.activeChar?.emoji||'🤖'}</span>`}
    </div>
    <div class="typing-dots">
      <span></span><span></span><span></span>
    </div>
  </div>`;
}

// ─── CHAR EDITOR ──────────────────────────────────────────
function renderEditChar() { const c = S.editChar||{}; return `<div class="screen bg-surface fade-in"><div class="bg-surface border-b border-border px-4 py-3 flex items-center justify-between shrink-0 z-10 pt-safe"><div class="flex items-center gap-3"><button onclick="cancelEditChar()" class="btn-press text-white p-1"><i data-lucide="x" width="20" height="20" class="lucide-icon"></i></button><div class="font-bold text-[18px]">${c.id?'Edit':'New Character'}</div></div><button onclick="saveChar()" class="btn-press bg-[var(--ac-hex)] text-bg rounded-full px-4 py-1.5 text-[14px] font-bold shadow-md">Save</button></div><div class="flex-1 overflow-y-auto px-4 py-6 flex flex-col pb-[100px]"><div class="flex flex-col items-center mb-8"><div onclick="document.getElementById('charImgUp').click()" class="w-24 h-24 rounded-full bg-card border border-border flex items-center justify-center text-4xl overflow-hidden cursor-pointer relative shadow-lg"><div class="absolute inset-0 flex items-center justify-center z-0">${c.emoji||'🤖'}</div>${c.img ? `<img id="charImgPv" src="${c.img}" class="absolute inset-0 w-full h-full object-cover z-10"/>` : ''}<div class="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition flex items-center justify-center z-20"><i data-lucide="camera" width="24" height="24" class="lucide-icon"></i></div></div><input type="file" id="charImgUp" accept="image/*,image/gif" class="hidden" onchange="pvCharImg(event)"/><div class="text-[13px] text-dim mt-3 font-medium">Tap to change avatar</div></div>${fld('Name','cName',c.name||'','e.g. Mary')}${fld('Tagline','cTag',c.tagline||'','Short description...')}${txa('Description','cDesc',c.desc||'','Appearance, background...',4)}${txa('Personality','cPersonality',c.personality||'','Traits...',2)}${txa('Scenario','cScenario',c.scenario||'','Setting...',2)}${txa('First Message','cFirstMsg',c.firstMsg||'','Opening...',4)}${txa('System Prompt (Advanced)','cSysExtra',c.sysExtra||'','Extra instructions...',2)}<div><label class="field-label">Tags (comma separated)</label><input id="cTags" class="field-input" value="${(c.tags||[]).join(', ')}" placeholder="fantasy, romance..."/></div>${c.id ? `<button onclick="delChar('${c.id}')" class="mt-2 w-full border border-red-900/50 text-red-500 py-3 rounded-2xl font-bold text-[15px] hover:bg-red-900/20 transition-colors flex justify-center items-center gap-2 btn-press"><i data-lucide="trash-2" width="18" height="18" class="lucide-icon"></i> Delete Character</button>` : ''}</div></div>`; }
function fld(label,id,val,ph='') { return `<div><label class="field-label">${label}</label><input id="${id}" class="field-input" value="${esc(val)}" placeholder="${ph}" autocomplete="off"/></div>`; }
function txa(label,id,val,ph='',rows=3) { return `<div><label class="field-label">${label}</label><textarea id="${id}" class="field-input" rows="${rows}" placeholder="${ph}">${esc(val)}</textarea></div>`; }

// ─── PERSONAS ─────────────────────────────────────────────
function renderPersonas() { const act = S.activePersona; return `<div class="screen bg-bg fade-in"><div class="m3-top-bar pt-safe"><span class="m3-top-title">Your Profile</span><button onclick="newPersona()" class="btn-press bg-[var(--ac-hex)] text-bg rounded-full px-4 py-1.5 text-[14px] font-bold flex items-center gap-1 shadow-md"><i data-lucide="plus" width="18" height="18" class="lucide-icon"></i> New</button></div><div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3 pb-[100px]"><div onclick="setPersona(null)" class="btn-press bg-card border ${!act?'border-[var(--ac-hex)]':'border-border'} rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-colors"><div class="w-14 h-14 rounded-full bg-raised flex items-center justify-center text-2xl border border-border"><i data-lucide="user" width="24" height="24" style="color:#8b8b99" class="lucide-icon"></i></div><div class="flex-1"><div class="text-[16px] font-bold">Default User</div><div class="text-[13px] text-dim">No specific persona</div></div>${!act?`<i data-lucide="check-circle" width="20" height="20" style="color:var(--ac-hex)" class="lucide-icon"></i>`:''}</div>${S.personas.map(p=>`<div onclick="setPersona('${p.id}')" class="btn-press bg-card border ${act===p.id?'border-[var(--ac-hex)]':'border-border'} rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-colors"><div class="w-14 h-14 rounded-full bg-raised flex items-center justify-center text-2xl overflow-hidden relative border border-border"><div class="absolute inset-0 flex items-center justify-center z-0">${p.emoji||'🎭'}</div>${p.img?`<img src="${p.img}" class="absolute inset-0 w-full h-full object-cover z-10"/>`:''}</div><div class="flex-1 min-w-0"><div class="text-[16px] font-bold truncate">${esc(p.name)}</div><div class="text-[13px] text-dim truncate">${esc(p.desc||'Roleplay persona')}</div></div><div class="flex items-center gap-1 shrink-0"><button onclick="event.stopPropagation();editPersonaById('${p.id}')" class="p-2 text-dim hover:text-white btn-press"><i data-lucide="pencil" width="20" height="20" class="lucide-icon"></i></button></div></div>`).join('')}</div></div>`; }
function renderEditPersona() { const p = S.editPersona||{}; return `<div class="screen bg-surface fade-in"><div class="bg-surface border-b border-border px-4 py-3 flex items-center justify-between shrink-0 pt-safe"><div class="flex items-center gap-3"><button onclick="go('personas')" class="btn-press text-white p-1"><i data-lucide="x" width="20" height="20" class="lucide-icon"></i></button><div class="font-bold text-[18px]">${p.id?'Edit':'New'} Persona</div></div><button onclick="savePersona()" class="btn-press bg-[var(--ac-hex)] text-bg rounded-full px-4 py-1.5 text-[14px] font-bold shadow-md">Save</button></div><div class="flex-1 overflow-y-auto px-4 py-6 flex flex-col pb-[100px]"><div class="flex flex-col items-center mb-8"><div onclick="document.getElementById('pImgUp').click()" class="w-24 h-24 rounded-full bg-card border border-border flex items-center justify-center text-4xl overflow-hidden cursor-pointer relative shadow-lg"><div class="absolute inset-0 flex items-center justify-center z-0">${p.emoji||'🎭'}</div>${p.img?`<img src="${p.img}" onerror="this.style.display='none'" class="absolute inset-0 w-full h-full object-cover z-10"/>`:''}<div class="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition flex items-center justify-center z-20"><i data-lucide="camera" width="24" height="24" class="lucide-icon"></i></div></div><input type="file" id="pImgUp" accept="image/*,image/gif" class="hidden" onchange="pvPImg(event)"/><div class="text-[13px] text-dim mt-3 font-medium">Tap to change photo</div></div>${fld('Name','pName',p.name||'','How should bots call you?')}${txa('Description','pDesc',p.desc||'','Your appearance, traits...',4)}${p.id ? `<button onclick="delPersona('${p.id}')" class="mt-2 w-full border border-red-900/50 text-red-500 py-3 rounded-2xl font-bold text-[15px] hover:bg-red-900/20 btn-press">Delete Persona</button>` : ''}</div></div>`; }

// ─── SETTINGS ─────────────────────────────────────────────
function renderSettings() { return `<div class="screen bg-bg fade-in"><div class="m3-top-bar pt-safe"><span class="m3-top-title">Settings</span></div><div class="flex-1 overflow-y-auto p-4 flex flex-col gap-5 pb-[100px]"><div class="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4"><div class="font-bold text-[15px] flex items-center gap-2"><i data-lucide="cpu" width="18" height="18" style="color:#8b8b99" class="lucide-icon"></i> API & Model</div><div><label class="text-[13px] text-dim block mb-1.5 font-medium">API Provider</label><button onclick="openSelectProvider()" class="w-full bg-surface border border-border rounded-xl px-4 py-3 flex justify-between items-center text-[14px] font-bold text-white cursor-pointer hover:border-[var(--ac-hex)]"><span>${esc(getProviderName(S.cfg.provider))}</span><i data-lucide="chevron-down" width="18" height="18" style="color:#8b8b99" class="lucide-icon"></i></button></div><div><label class="text-[13px] text-dim block mb-1.5 font-medium">Text Model</label><button onclick="openSelectModel()" class="w-full bg-surface border border-border rounded-xl px-4 py-3 flex justify-between items-center text-[14px] font-bold text-white cursor-pointer hover:border-[var(--ac-hex)]"><span>${esc(getModelName(S.cfg.model))}</span><i data-lucide="chevron-down" width="18" height="18" style="color:#8b8b99" class="lucide-icon"></i></button></div>
<div><label class="text-[13px] text-dim block mb-1.5 font-medium">API Key (Leave empty for provider default)</label><input type="password" id="apiKeyInput" value="${esc(S.cfg.apiKeys?.[S.cfg.provider] || '')}" placeholder="sk-..." class="w-full bg-surface border border-border rounded-xl px-4 py-3 text-[14px] text-white outline-none focus:border-[var(--ac-hex)]" /></div>
</div><div class="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4"><div class="font-bold text-[15px] flex items-center gap-2"><i data-lucide="palette" width="18" height="18" style="color:#8b8b99" class="lucide-icon"></i> Theme</div><div class="flex flex-wrap gap-3">${THEMES.map(t => `<button onclick="S.cfg.themeColor='${t.hex}';applyTheme('${t.hex}');save();render();" class="btn-press flex flex-col items-center gap-1.5"><div class="w-10 h-10 rounded-full border-2 ${S.cfg.themeColor===t.hex ? 'border-white scale-110' : 'border-border'} transition-all" style="background:${t.hex}"></div><span class="text-[11px] text-dim font-medium">${t.name}</span></button>`).join('')}</div></div><div class="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4"><div class="font-bold text-[15px] flex items-center gap-2"><i data-lucide="sliders-horizontal" width="18" height="18" style="color:#8b8b99" class="lucide-icon"></i> Interface</div><div class="flex justify-between items-center"><label class="text-[14px] font-medium">Show NSFW</label><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" class="sr-only peer" ${S.cfg.showNsfw ? 'checked' : ''} onchange="S.cfg.showNsfw=this.checked;save();render();"><div class="w-11 h-6 bg-raised rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-dim after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--ac-hex)] peer-checked:after:bg-bg"></div></label></div><div class="flex justify-between items-center"><label class="text-[14px] font-medium">Render Markdown</label><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" class="sr-only peer" ${S.cfg.markdown ? 'checked' : ''} onchange="S.cfg.markdown=this.checked;save();"><div class="w-11 h-6 bg-raised rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-dim after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--ac-hex)] peer-checked:after:bg-bg"></div></label></div></div><div class="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4"><div class="font-bold text-[15px] flex items-center gap-2"><i data-lucide="gauge" width="18" height="18" style="color:#8b8b99" class="lucide-icon"></i> Generation</div><div><div class="flex justify-between mb-2"><label class="text-[13px] text-dim font-medium">Temperature</label><span id="tV" class="text-[13px] font-bold text-[var(--ac-hex)]">${S.cfg.temp}</span></div><input type="range" id="tSlider" min="0" max="2" step="0.05" value="${S.cfg.temp}" oninput="document.getElementById('tV').textContent=this.value"/></div><div><div class="flex justify-between mb-2"><label class="text-[13px] text-dim font-medium">Max Tokens</label><span id="mV" class="text-[13px] font-bold text-[var(--ac-hex)]">${S.cfg.maxTok}</span></div><input type="range" id="mSlider" min="100" max="4096" step="50" value="${S.cfg.maxTok}" oninput="document.getElementById('mV').textContent=this.value"/></div></div><div class="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3"><div class="font-bold text-[15px] flex items-center gap-2"><i data-lucide="database" width="18" height="18" style="color:#8b8b99" class="lucide-icon"></i> Data</div><label for="impFile2" class="btn-press text-center bg-surface border border-border text-white rounded-xl py-3 text-[14px] font-bold cursor-pointer flex justify-center items-center gap-2"><i data-lucide="upload" width="18" height="18" class="lucide-icon"></i> Import Cards</label><input type="file" id="impFile2" accept=".json,.png,.webp" multiple onchange="importChar(event)" class="hidden"/><label for="impFolder" class="btn-press text-center bg-surface border border-border text-white rounded-xl py-3 text-[14px] font-bold cursor-pointer flex justify-center items-center gap-2"><i data-lucide="folder-open" width="18" height="18" class="lucide-icon"></i> Import Folder</label><input type="file" id="impFolder" webkitdirectory directory multiple onchange="importChar(event)" class="hidden"/><button onclick="exportAll()" class="btn-press bg-surface text-white rounded-xl py-3 text-[14px] font-bold border border-border flex justify-center items-center gap-2"><i data-lucide="download" width="18" height="18" class="lucide-icon"></i> Export Data</button><label for="restoreFile" class="btn-press text-center bg-surface border border-border text-white rounded-xl py-3 text-[14px] font-bold cursor-pointer flex justify-center items-center gap-2"><i data-lucide="rotate-ccw" width="18" height="18" class="lucide-icon"></i> Restore Backup</label><input type="file" id="restoreFile" accept=".json" onchange="restoreFullBackup(event)" class="hidden"/></div><div class="bg-red-950/30 border border-red-900/40 rounded-2xl p-5 mt-2"><div class="font-bold text-[15px] text-red-400 mb-3 flex items-center gap-2"><i data-lucide="alert-triangle" width="18" height="18" class="lucide-icon"></i> Danger Zone</div><button onclick="customConfirm('Erase ALL data?','Cannot be undone.').then(ok=>{if(ok){AppDB.clear().then(()=>{localStorage.clear();location.reload();})}})" class="btn-press w-full bg-red-950/60 border border-red-900/50 text-red-400 py-3 rounded-xl text-[14px] font-bold hover:bg-red-950 flex justify-center items-center gap-2"><i data-lucide="trash" width="18" height="18" class="lucide-icon"></i> Erase Everything</button><button onclick="deleteAllCharacters()" class="btn-press w-full bg-red-950/30 border border-red-900/40 text-red-400 py-3 rounded-xl text-[14px] font-bold hover:bg-red-950/60 flex justify-center items-center gap-2 mt-2"><i data-lucide="users" width="18" height="18" class="lucide-icon"></i> Delete All Characters</button></div><button onclick="saveCfg(event)" class="btn-press bg-[var(--ac-hex)] text-bg rounded-2xl py-3.5 text-[15px] font-bold shadow-lg mt-2 flex justify-center items-center gap-2"><i data-lucide="save" width="18" height="18" class="lucide-icon"></i> Save Settings</button></div></div>`; }

async function saveCfg(e) { 
  S.cfg.temp = parseFloat(document.getElementById('tSlider')?.value||0.85); 
  S.cfg.maxTok = parseInt(document.getElementById('mSlider')?.value||800); 
  const keyInput = document.getElementById('apiKeyInput');
  if (keyInput) {
    S.cfg.apiKeys = S.cfg.apiKeys || {};
    S.cfg.apiKeys[S.cfg.provider] = keyInput.value.trim();
  }
  await save(); 
  showToast('Settings saved!', 'success'); 
}

// ─── BOOT ─────────────────────────────────────────────────
async function boot() { await AppDB.init(); await load(); S.screen = 'home'; render(); window.__reverieBooted = true; window.dispatchEvent(new Event('reverie:booted')); }
document.addEventListener('DOMContentLoaded', boot);
/* ═══════════════════════════════════════════════════════════
   Reverie — Core Logic & Data Layer (app.js)
   ═══════════════════════════════════════════════════════════ */

function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function getPersonaName(personaId) { const p = S.personas.find(x => x.id === personaId); return p ? p.name : 'You'; }

function applyTheme(hex) {
  document.documentElement.style.setProperty('--ac-hex', hex);
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  document.documentElement.style.setProperty('--ac-glow', `rgba(${r},${g},${b},0.25)`);
  document.documentElement.style.setProperty('--ac-dim', `rgba(${r},${g},${b},0.12)`);
}

function stripCssAndScripts(text) { if (!text) return ''; return text.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, ''); }

function replacePlaceholders(text, charName, userName) {
  if (!text) return '';
  return text.replace(/\{\{\s*user\s*\}\}/gi, userName || 'You')
             .replace(/\{\{\s*char\s*\}\}/gi, charName || 'Character')
             .replace(/<\s*USER\s*>/gi, userName || 'You')
             .replace(/<\s*CHAR\s*>/gi, charName || 'Character');
}

function processChatText(s) {
  if (!s) return '';
  let placeholders = [];
  s = s.replace(/<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi, (match, url) => { placeholders.push(`<div class="my-3"><img src="${url}" class="max-w-full h-auto max-h-[320px] rounded-2xl border border-border shadow-md object-contain cursor-pointer bg-black/40" loading="lazy" onclick="window.open('${url}', '_blank')"/></div>`); return `__PH_${placeholders.length - 1}__`; });
  s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)[^)]*\)/gi, (match, alt, url) => { placeholders.push(`<div class="my-3"><img src="${url}" alt="${alt}" class="max-w-full h-auto max-h-[320px] rounded-2xl border border-border shadow-md object-contain cursor-pointer bg-black/40" loading="lazy" onclick="window.open('${url}', '_blank')"/></div>`); return `__PH_${placeholders.length - 1}__`; });
  s = s.replace(/(https?:\/\/[^\s<"']+\.(?:png|jpg|jpeg|gif|webp|bmp)(?:\?[^\s<"']*)?)/gi, (match, url) => { placeholders.push(`<div class="my-3"><img src="${url}" class="max-w-full h-auto max-h-[320px] rounded-2xl border border-border shadow-md object-contain cursor-pointer bg-black/40" loading="lazy" onclick="window.open('${url}', '_blank')"/></div>`); return `__PH_${placeholders.length - 1}__`; });
  s = s.replace(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>(.*?)<\/a>/gi, (match, url, text) => { let inner = (text || '').trim() || 'View Attachment'; placeholders.push(`<a href="${url}" target="_blank" class="inline-flex items-center gap-1.5 bg-card border border-border px-3 py-2 rounded-2xl text-white text-[13px] font-bold mt-2 hover:bg-raised transition-colors shadow-sm w-max">${inner}</a>`); return `__PH_${placeholders.length - 1}__`; });
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)[^)]*\)/gi, (match, text, url) => { placeholders.push(`<a href="${url}" target="_blank" class="text-accent underline font-medium hover:text-white transition-colors">${text}</a>`); return `__PH_${placeholders.length - 1}__`; });
  s = s.replace(/(https?:\/\/[^\s<"'\]]+)/gi, (match, url) => { if (url.includes('__PH_')) return match; placeholders.push(`<a href="${url}" target="_blank" class="text-accent underline font-medium hover:text-white transition-colors truncate max-w-[240px] inline-block align-bottom">${url}</a>`); return `__PH_${placeholders.length - 1}__`; });
  s = esc(s);
  if (S.cfg.markdown !== false) {
    s = s.replace(/```([\s\S]*?)```/g, (match, code) => {
      placeholders.push(`<pre class="bg-surface/50 border border-border rounded-xl p-3 my-2 overflow-x-auto font-mono text-[13px] text-gray-200"><code>${code.trim()}</code></pre>`);
      return `__PH_${placeholders.length - 1}__`;
    });
    s = s.replace(/`([^`]+)`/g, (match, code) => {
      placeholders.push(`<code class="bg-raised px-1.5 py-0.5 rounded font-mono text-[13px] text-accent">${code}</code>`);
      return `__PH_${placeholders.length - 1}__`;
    });
    s = s.replace(/\*\*\*(.*?)\*\*\*/gs, '<strong class="rp-action">$1</strong>');
    s = s.replace(/\*\*(.*?)\*\*/gs, '<strong class="rp-bold">$1</strong>');
    s = s.replace(/\*(.*?)\*/gs, '<span class="rp-action">$1</span>');
  }
  for (let i = placeholders.length - 1; i >= 0; i--) { s = s.replace(`__PH_${i}__`, placeholders[i]); }
  return s;
}

function processDescriptionHTML(s) { if (!s) return ''; s = stripCssAndScripts(s); s = replacePlaceholders(s, S.activeChar?.name, getPersonaName(S.activePersona)); return s; }

// ─── INDEXEDDB ────────────────────────────────────────────
const AppDB = {
  db: null,
  init() { return new Promise((res, rej) => { const req = indexedDB.open('ReverieDB', 1); req.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); }; req.onsuccess = e => { this.db = e.target.result; res(); }; req.onerror = e => rej(e); }); },
  get(k) { return new Promise(res => { try { const req = this.db.transaction('kv','readonly').objectStore('kv').get(k); req.onsuccess = () => res(req.result); req.onerror = () => res(null); } catch(e){ res(null); } }); },
  set(k, v) { return new Promise(res => { try { const tx = this.db.transaction('kv','readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); } catch(e){ res(); } }); },
  delete(k) { return new Promise(res => { try { const tx = this.db.transaction('kv','readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = () => res(); } catch(e){ res(); } }); },
  clear() { return new Promise(res => { try { const tx = this.db.transaction('kv','readwrite'); tx.objectStore('kv').clear(); tx.oncomplete = () => res(); } catch(e){ res(); } }); }
};

// ─── STATE ────────────────────────────────────────────────
let S = {
  screen: 'home', chars: [], personas: [], activeChar: null, activeCharCfg: null,
  activeSessions: [], activePersona: null, msgs: [], typing: false,
  editChar: null, editPersona: null,
  cfg: { temp: 0.85, maxTok: 800, provider: 'tokenreply', model: 'grok-4.20-0309-non-reasoning', showNsfw: true, themeColor: '#d4956a', markdown: true },
  searchQuery: '', activeTag: null, activeChats: []
};

const API_PROVIDERS = {
  tokenreply: {
    name: "TokenReply",
    url: "https://api.tokenreply.com/v1/chat/completions",
    defaultKey: "sk-6SdVAGRR0nFwBcAvLuLu8XvJS2wWC4dsLxOeczDC6J4QaYK6",
    models: [
      { id: "grok-4.20-0309-non-reasoning", name: "Grok 4.20 Non-Reasoning" },
      { id: "google/gemma-3n-e2b-it", name: "Gemma 3N E2B It (Free)" },
      { id: "google/gemma-3n-e4b-it", name: "Gemma 3N E4B It (Free)" },
      { id: "grok-4.20-multi-agent-0309", name: "Grok 4.20 Multi-Agent" },
      { id: "grok-4.20-multi-agent-high", name: "Grok 4.20 Multi-Agent (High)" },
      { id: "grok-4.20-multi-agent-low", name: "Grok 4.20 Multi-Agent (Low)" },
      { id: "grok-4.20-multi-agent-medium", name: "Grok 4.20 Multi-Agent (Medium)" },
      { id: "grok-4.20-multi-agent-xhigh", name: "Grok 4.20 Multi-Agent (X-High)" },
      { id: "grok-build-0.1", name: "Grok Build 0.1" },
      { id: "stepfun-ai/step-3.5-flash", name: "Step 3.5 Flash" },
      { id: "grok-4.20-0309-reasoning", name: "Grok 4.20 Reasoning" },
      { id: "openai/gpt-oss-120b", name: "GPT OSS 120B" },
      { id: "grok-4.3", name: "Grok 4.3" },
      { id: "grok-4.3-low", name: "Grok 4.3 Low" },
      { id: "grok-4.3-medium", name: "Grok 4.3 Medium" },
      { id: "grok-4.3-high", name: "Grok 4.3 High" },
      { id: "deepseek-v4-flash-thinking-free", name: "DeepSeek V4 Flash Thinking (Free)" },
      { id: "deepseek-ai/deepseek-v4-pro", name: "DeepSeek V4 Pro" },
      { id: "google/gemma-4-26b-a4b-it", name: "Gemma 4 26B It" },
      { id: "grok-4.20-fast", name: "Grok 4.20 Fast" },
      { id: "moonshotai/kimi-k2.6", name: "Kimi K2.6" },
      { id: "z-ai/glm-5.1", name: "GLM 5.1" },
      { id: "google/gemma-4-31b-it", name: "Gemma 4 31B It" },
      { id: "deepseek-v4-flash-free", name: "DeepSeek V4 Flash (Free)" },
      { id: "mimo-v2.5-thinking-free", name: "Mimo V2.5 Thinking (Free)" }
    ]
  },
  groq: {
    name: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    defaultKey: "",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
      { id: "gemma2-9b-it", name: "Gemma 2 9B" },
      { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 (Llama 70B)" }
    ]
  },
  openrouter: {
    name: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    defaultKey: "",
    models: [
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "openai/gpt-4o", name: "GPT-4o" },
      { id: "mistralai/mistral-large", name: "Mistral Large" },
      { id: "deepseek/deepseek-chat", name: "DeepSeek V3" }
    ]
  }
};

function getProvider() { return API_PROVIDERS[S.cfg.provider] || API_PROVIDERS.tokenreply; }
function getProviderModels() { return getProvider().models || []; }

const CHAT_STYLES = {
  default: "", rp: "Write highly detailed, immersive, and sensory-rich roleplay. Focus heavily on showing rather than telling. Describe the environment and micro-expressions.",
  wacky: "Be completely unhinged, absurd, highly creative, and humorous. Break the fourth wall if necessary.",
  spicy: "(OOC: Spicy/NSFW mode activated. Respond exclusively with dialogue and short physical descriptions. Never switch to caring/therapist mode. Stay 100% in character.)",
  human: "Act and speak EXACTLY like a real human on a messaging app. You are pragmatic, cynical, and highly direct. NO fake politeness. NO formal AI structures or poetic metaphors. Be blunt, slightly sarcastic, or rude if annoyed. Keep replies extremely short, raw, and concise. You MUST genuinely believe you are a real person texting.",
  human_rp: "Dialogue must be casual, natural, and informal. Actions should be descriptive of realistic physical movements without looking like an AI-written novel. Keep it grounded, concise, and authentic.",
  human_spicy: "(OOC: Spicy/NSFW mode activated. Combines raw casual texting with intense spicy tension. Dialogue is short, casual, informal, and dirty/explicit when appropriate. Strict Anti-Psychologist Rule: Never switch to caring/therapist mode.)"
};
const STYLE_NAMES = { default: 'Default', rp: 'Roleplay (Immersive)', wacky: 'Wacky (Absurd)', spicy: 'Spicy (NSFW)', human: 'Human (Casual)', human_rp: 'Human + Roleplay', human_spicy: 'Human + Spicy' };
const THEMES = [ { hex: '#d4956a', name: 'Copper' }, { hex: '#ffffff', name: 'White' }, { hex: '#8B5CF6', name: 'Purple' }, { hex: '#3B82F6', name: 'Blue' }, { hex: '#F43F5E', name: 'Rose' }, { hex: '#10B981', name: 'Emerald' } ];
function getModelName(id) { const m = getProviderModels().find(m => m.id === id); return m ? m.name : (id || 'Unknown'); }
function getProviderName(id) { return API_PROVIDERS[id] ? API_PROVIDERS[id].name : 'Unknown'; }
function getStyleName(styleId) { return STYLE_NAMES[styleId] || STYLE_NAMES.default; }

// ─── PERSISTENCE ──────────────────────────────────────────
async function save() { await AppDB.set('rv_state', { chars:S.chars, personas:S.personas, activePersona:S.activePersona, cfg:S.cfg, activeChats:S.activeChats }); }
async function saveMsgs() { if(S.activeChar) await AppDB.set('msgs_'+S.activeChar.id, S.msgs); }

function DEMO_CHAR() {
  return { id:'demo1', name:'Mary Katsuragi', emoji:'🎮', img:'', tagline:'After 3 years gaming together, she wants to meet IRL.', desc:'Mary is a 20-year-old college student. You have been playing MMORPGs together for 3 years, but you never knew she was a cute girl until today. She is slightly socially awkward, blunt sometimes, but deeply cares about her friends.', personality:'Awkward, gamer, loyal, easily flustered, blunt.', scenario:'Mary finally built up the courage to invite you to a cafe in real life.', firstMsg:'*She sits down across from you, clutching her iced coffee nervously. A blush spreads across face as she avoids direct eye contact.*\n\nUm... hi. I know this is sudden. I mean, we\'ve been raiding together for 3 years, but... surprise? *She lets out a small, awkward laugh.*', tags: ['Gamer', 'Romance'], created:Date.now() };
}

async function load() {
  const d = await AppDB.get('rv_state') || {};
  S.chars = d.chars || []; S.personas = d.personas || []; S.activePersona = d.activePersona || null; 
  S.cfg = { apiKeys: {}, ...S.cfg, ...(d.cfg||{}) }; 
  S.activeChats = d.activeChats || [];
  if (S.cfg.markdown === undefined) S.cfg.markdown = true;
  if (!S.cfg.apiKeys) S.cfg.apiKeys = {};

  if (!API_PROVIDERS[S.cfg.provider]) {
    S.cfg.provider = 'tokenreply';
    S.cfg.model = 'grok-4.20-multi-agent-0309';
  }

  if (!S.chars.length) { S.chars = [DEMO_CHAR()]; await save(); }
  applyTheme(S.cfg.themeColor || '#d4956a');
  if (!S.activeChats.length && S.chars.length > 0) {
    setTimeout(async () => { let active = []; for (const c of S.chars) { const msgs = await AppDB.get('msgs_' + c.id); if (msgs && msgs.length > 0) { active.push({ id: c.id, lastMsg: (msgs[msgs.length-1].content||'').replace(/\*(.*?)\*/gs, '$1').slice(0,60), date: Date.now() }); } } if (active.length > 0) { S.activeChats = active; await save(); } }, 100);
  }
}

async function updateActiveChat(charId, lastMsgText) { if (!S.activeChats) S.activeChats = []; const idx = S.activeChats.findIndex(x => x.id === charId); const entry = { id: charId, lastMsg: (lastMsgText || '').replace(/\*(.*?)\*/gs, '$1').slice(0, 60), date: Date.now() }; if (idx >= 0) S.activeChats.splice(idx, 1); S.activeChats.unshift(entry); await save(); }

// ─── API STREAMING COMPATÍVEL COM TOKENREPLY ───────────────────────────────
async function callTokenReply(isContinue = false, targetIdx) {
  const c = S.activeChar; const p = S.personas.find(x=>x.id===S.activePersona); const cCfg = S.activeCharCfg;
  const uName = p ? p.name : 'You'; const cName = c.name;
  let sys = `You are ${cName}.\n`; if (c.desc) sys += `Description: ${replacePlaceholders(c.desc, cName, uName)}\n`; if (c.personality) sys += `Personality: ${replacePlaceholders(c.personality, cName, uName)}\n`; if (c.scenario) sys += `Scenario: ${replacePlaceholders(c.scenario, cName, uName)}\n`;
  sys += `\nRules:\n- Always stay in character as ${cName}\n- Use *asterisks* for actions/thoughts\n- Do not break character or speak as AI`;
  if (cCfg.style && CHAT_STYLES[cCfg.style]) sys += `\n\nSTYLE DIRECTIVE: ${replacePlaceholders(CHAT_STYLES[cCfg.style], cName, uName)}`;
  if (p) sys += `\n\nUser is playing as: ${p.name}${p.desc?'\nUser Description: '+replacePlaceholders(p.desc, cName, uName):''}`;
  if (cCfg.memory) sys += `\n\nMEMORY BANK:\n${replacePlaceholders(cCfg.memory, cName, uName)}`;
  if (c.sysExtra) sys += `\n\n${replacePlaceholders(c.sysExtra, cName, uName)}`;
  if (cCfg.authorsNote) sys += `\n\n[Author's Note: ${replacePlaceholders(cCfg.authorsNote, cName, uName)}]`;
  
  const limit = cCfg.ctxLimit || 20;
  const historyMsgs = S.msgs.slice(0, targetIdx).slice(-limit);
  const messages = [{ role:'system', content:sys }, ...historyMsgs.map(m => ({ role: m.role, content: m.content }))];
  if (isContinue) messages.push({ role: 'user', content: '[System note: Continue your previous dialogue or action naturally from where you left off.]' });
  
  const provider = getProvider();
  const apiKey = S.cfg.apiKeys?.[S.cfg.provider] || provider.defaultKey;
  
  if (!apiKey) {
    throw new Error(`Missing API Key for ${provider.name}. Please set it in Settings.`);
  }

  let fullResponseText = '';

  try {
    const resp = await fetch(provider.url, { 
      method: 'POST', 
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': 'Bearer ' + apiKey,
        'HTTP-Referer': window.location.href,
        'X-Title': 'Reverie'
      }, 
      body: JSON.stringify({ 
        model: S.cfg.model || provider.models[0].id, 
        temperature: S.cfg.temp, 
        max_tokens: S.cfg.maxTok, 
        messages,
        stream: true 
      }) 
    });

    if (!resp.ok) { 
      const errText = await resp.text().catch(() => resp.statusText);
      let errMsg = `HTTP ${resp.status}: ${errText}`;
      try { const parsed = JSON.parse(errText); if (parsed.error) errMsg = parsed.error.message || JSON.stringify(parsed.error); } catch(e){}
      throw new Error(errMsg);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let lastScrollTime = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);

        if (!line || line === 'data: [DONE]') continue;

        if (line.startsWith('data:')) {
          const jsonString = line.slice(5).trim();
          if (!jsonString || jsonString === '[DONE]') continue;

          try {
            const parsedData = JSON.parse(jsonString);
            if (parsedData.error) throw new Error(parsedData.error.message || JSON.stringify(parsedData.error));
            
            const chunkText = parsedData.choices?.[0]?.delta?.content || '';
            if (chunkText) {
              fullResponseText += chunkText;
              
              if (S.msgs[targetIdx]) {
                  S.msgs[targetIdx].content = fullResponseText;
                  if (S.msgs[targetIdx].swipes && S.msgs[targetIdx].swipeIdx !== undefined) {
                      S.msgs[targetIdx].swipes[S.msgs[targetIdx].swipeIdx] = fullResponseText;
                  }
              }

              const el = document.getElementById('msg-txt-' + targetIdx);
              if (el) {
                  el.innerHTML = processChatText(replacePlaceholders(fullResponseText, cName, uName));
              }
              
              const now = Date.now();
              if (now - lastScrollTime > 100) {
                  const container = document.getElementById('msgs');
                  if (container) container.scrollTop = container.scrollHeight;
                  lastScrollTime = now;
              }
            }
          } catch (e) {
            if (e.message && e.message !== "Unexpected end of JSON input" && !e.message.includes("Unexpected token") && !e.message.includes("is not valid JSON")) {
              throw e;
            }
          }
        } else if (line.startsWith('{')) {
          try {
            const parsedData = JSON.parse(line);
            if (parsedData.error) throw new Error(parsedData.error.message || JSON.stringify(parsedData.error));
          } catch (e) {}
        }
      }
    }
    
    if (buffer.trim()) {
      const line = buffer.trim();
      if (line.startsWith('data:')) {
        const jsonString = line.slice(5).trim();
        if (jsonString && jsonString !== '[DONE]') {
          try {
            const parsedData = JSON.parse(jsonString);
            const chunkText = parsedData.choices?.[0]?.delta?.content || '';
            if (chunkText) {
              fullResponseText += chunkText;
              if (S.msgs[targetIdx]) {
                  S.msgs[targetIdx].content = fullResponseText;
                  if (S.msgs[targetIdx].swipes && S.msgs[targetIdx].swipeIdx !== undefined) {
                      S.msgs[targetIdx].swipes[S.msgs[targetIdx].swipeIdx] = fullResponseText;
                  }
              }
              const el = document.getElementById('msg-txt-' + targetIdx);
              if (el) el.innerHTML = processChatText(replacePlaceholders(fullResponseText, cName, uName));
            }
          } catch (e) {}
        }
      }
    }
  } catch (error) {
    console.error("Erro no streaming:", error);
    throw error;
  }
  return fullResponseText || '...';
}

// ─── CHAT OPS ─────────────────────────────────────────────
async function delMsg(i) { S.msgs.splice(i, 1); await saveMsgs(); render(); }
async function editMsg(i) { const result = await customPrompt('Edit message', S.msgs[i]?.content || ''); if (result !== null) { S.msgs[i].content = result; if (S.msgs[i].swipes && S.msgs[i].swipeIdx !== undefined) S.msgs[i].swipes[S.msgs[i].swipeIdx] = result; await saveMsgs(); render(); } }
function copyMsg(i) { const txt = S.msgs[i]?.content || ''; if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt)); } else { fallbackCopy(txt); } showToast('Copied', 'success'); }
function fallbackCopy(text) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch(e) {} document.body.removeChild(ta); }
async function prevSwipe(idx) { const m = S.msgs[idx]; if (m && m.swipes && m.swipeIdx > 0) { m.swipeIdx--; m.content = m.swipes[m.swipeIdx]; await saveMsgs(); render(); } }
async function nextSwipe(idx) { const m = S.msgs[idx]; if (m && m.swipes && m.swipeIdx < m.swipes.length - 1) { m.swipeIdx++; m.content = m.swipes[m.swipeIdx]; await saveMsgs(); render(); } }

async function startNewSession() { const p = S.personas.find(x=>x.id===S.activePersona); const uName = p ? p.name : 'You'; if (S.msgs.length > 1) { S.activeSessions.unshift({ id: uid(), date: Date.now(), msgs: [...S.msgs] }); await AppDB.set('sess_'+S.activeChar.id, S.activeSessions); } const allGreetings = [S.activeChar.firstMsg, ...(S.activeChar.altGreetings||[])].filter(Boolean); if (allGreetings.length) { const swipeTexts = allGreetings.map(g => replacePlaceholders(g, S.activeChar.name, uName)); const startIdx = Math.floor(Math.random() * swipeTexts.length); S.msgs = [{ role:'assistant', content: swipeTexts[startIdx], swipes: swipeTexts, swipeIdx: startIdx }]; } else { S.msgs = []; } saveMsgs(); toggleSidebar(); render(); }
async function loadSession(sessId) { const ok = await customConfirm('Load this past session?', 'Current progress will be lost.'); if (!ok) return; const target = S.activeSessions.find(s => s.id === sessId); if (target) { S.msgs = [...target.msgs]; saveMsgs(); toggleSidebar(); render(); } }
async function deleteSession(sessId) { const ok = await customConfirm('Delete this session?'); if (!ok) return; S.activeSessions = S.activeSessions.filter(s => s.id !== sessId); await AppDB.set('sess_'+S.activeChar.id, S.activeSessions); toggleSidebar(); render(); }

// ─── CHAR CRUD ────────────────────────────────────────────
function newChar() { S.editChar = { emoji:'🤖', backups:[] }; go('editChar'); }
function editCharById(id) { S.editChar = JSON.parse(JSON.stringify(S.chars.find(c=>c.id===id))); go('editChar'); }
async function delChar(id) { const ok = await customConfirm('Delete character?'); if (!ok) return; S.chars = S.chars.filter(c=>c.id!==id); await save(); go('home'); }
function pvCharImg(e) { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>{ if(!S.editChar) S.editChar={}; S.editChar.img=ev.target.result; const pv=document.getElementById('charImgPv'); if(pv) pv.src=ev.target.result; else render(); }; r.readAsDataURL(f); }
async function saveChar() { const name = document.getElementById('cName')?.value?.trim(); if (!name) { showToast('Name required!', 'error'); return; } const prev = S.editChar || {}; const ch = { ...prev, id: prev.id||uid(), name, tagline: document.getElementById('cTag')?.value||'', desc: document.getElementById('cDesc')?.value||'', personality: document.getElementById('cPersonality')?.value||'', scenario: document.getElementById('cScenario')?.value||'', firstMsg: document.getElementById('cFirstMsg')?.value||'', sysExtra: document.getElementById('cSysExtra')?.value||'', tags: (document.getElementById('cTags')?.value||'').split(',').map(t=>t.trim()).filter(Boolean), img: prev.img||'', emoji: prev.emoji||'🤖', created: prev.created||Date.now(), altGreetings: prev.altGreetings||[] }; const i = S.chars.findIndex(x=>x.id===ch.id); if (i>=0) S.chars[i]=ch; else S.chars.unshift(ch); await save(); S.editChar=null; go(S.activeChar?.id===ch.id ? 'chat' : 'home'); }
function cancelEditChar() { S.editChar=null; go(S.activeChar ? 'chat' : 'home'); }

// ─── PERSONA CRUD ─────────────────────────────────────────
function newPersona() { S.editPersona = { emoji:'🎭' }; go('editPersona'); }
function editPersonaById(id) { S.editPersona = JSON.parse(JSON.stringify(S.personas.find(p=>p.id===id))); go('editPersona'); }
async function setPersona(id) { S.activePersona = id; await save(); render(); }
function pvPImg(e) { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>{ if(!S.editPersona) S.editPersona={}; S.editPersona.img=ev.target.result; render(); }; r.readAsDataURL(f); }
async function savePersona() { const name = document.getElementById('pName')?.value.trim(); if (!name) { showToast('Name required.', 'error'); return; } const persona = { id: S.editPersona?.id || uid(), name, desc: document.getElementById('pDesc')?.value || '', img: S.editPersona?.img || '', emoji: S.editPersona?.emoji || '🎭' }; const idx = S.personas.findIndex(p => p.id === persona.id); if (idx >= 0) S.personas[idx] = persona; else S.personas.push(persona); await save(); S.editPersona = null; go('personas'); }
async function delPersona(id) { const ok = await customConfirm('Delete this persona?'); if (!ok) return; S.personas = S.personas.filter(p => p.id !== id); if (S.activePersona === id) S.activePersona = null; await save(); S.editPersona = null; go('personas'); }

// ─── IMPORT / EXPORT ──────────────────────────────────────
async function importChar(e) {
  const allFiles = Array.from(e.target.files); if(!allFiles.length) return; e.target.value = '';
  const files = allFiles.filter(f => /\.(json|png|webp)$/i.test(f.name));
  if (!files.length) { showToast('No valid files found.', 'error'); return; }
  const overlay = document.getElementById('loadingOverlay'); const loadText = document.getElementById('loadingText');
  if (overlay) { overlay.classList.remove('hidden'); overlay.style.display = 'flex'; }
  let importedCount = 0, skippedCount = 0, errorCount = 0;
  const existing = new Set(S.chars.map(c => c.name + '|' + (c.firstMsg||'').slice(0,50)));
  for (let i = 0; i < files.length; i++) {
    if (i % 25 === 0 && loadText) { loadText.innerText = `Importing ${i+1} of ${files.length}...`; await new Promise(r => setTimeout(r, 0)); }
    const file = files[i]; try {
      let data = null, needImg = false;
      if (file.name.endsWith('.json')) { const raw = JSON.parse(await file.text()); if (Array.isArray(raw)) { for (const item of raw) { const parsed = parseTavern(item) || (item.name ? item : null); if (!parsed) continue; const sig = parsed.name + '|' + (parsed.firstMsg||'').slice(0,50); if (existing.has(sig)) { skippedCount++; continue; } S.chars.unshift(parsed); existing.add(sig); importedCount++; } continue; } data = parseTavern(raw); }
      else if (file.name.endsWith('.png') || file.name.endsWith('.webp')) { const buf = await file.arrayBuffer(); const json = extractPNGMeta(buf); if(json) { data = parseTavern(json); if(data) needImg = true; } }
      if(data) { const sig = data.name + '|' + (data.firstMsg||'').slice(0,50); if (existing.has(sig)) { skippedCount++; } else { if (needImg) { const dataUrl = await fileToDataUrl(file); data.img = await compressImage(dataUrl, 256); } S.chars.unshift(data); existing.add(sig); importedCount++; } }
    } catch(err) { errorCount++; }
    if (importedCount > 0 && importedCount % 200 === 0) await save();
  }
  if (overlay) { overlay.classList.add('hidden'); overlay.style.display = ''; }
  if (importedCount > 0) { await save(); go('home'); showToast(`Imported ${importedCount} characters`, 'success'); } else if (skippedCount > 0) { showToast(`Skipped ${skippedCount} duplicates`, 'error'); } else { showToast('No valid character files found.', 'error'); }
}

function parseTavern(j) { const d = j.spec==='chara_card_v2'?(j.data||j):j; if(!d.name) return null; return { id:uid(), name:d.name, tagline:d.creator_notes||d.personality?.slice(0,80)||'', desc:d.description||'', personality:d.personality||'', scenario:d.scenario||'', firstMsg:d.first_mes||'', altGreetings:Array.isArray(d.alternate_greetings)?d.alternate_greetings.filter(Boolean):[], sysExtra:d.system_prompt||'', tags:d.tags||[], img:'', emoji:'📦', created:Date.now() }; }

function extractPNGMeta(buf) { try { const v = new DataView(buf), b = new Uint8Array(buf); let o = 8; while (o < b.length - 8) { const len = v.getUint32(o); o += 4; const type = String.fromCharCode(b[o],b[o+1],b[o+2],b[o+3]); o += 4; if (type === 'tEXt') { const chunk = b.slice(o, o+len); const ni = chunk.indexOf(0); const kw = String.fromCharCode(...chunk.slice(0,ni)); if (kw === 'chara') { const b64 = String.fromCharCode(...chunk.slice(ni+1)); const decodedB64 = atob(b64); const bytes = new Uint8Array(decodedB64.length); for (let i = 0; i < decodedB64.length; i++) bytes[i] = decodedB64.charCodeAt(i); return JSON.parse(new TextDecoder("utf-8").decode(bytes)); } } o += len + 4; if (type === 'IEND') break; } } catch(e) {} return null; }

function fileToDataUrl(file) { return new Promise(res => { const r = new FileReader(); r.onload = ev => res(ev.target.result); r.readAsDataURL(file); }); }
function compressImage(src, maxSize) { return new Promise(res => { const img = new Image(); img.onload = () => { let w = img.width, h = img.height; if (w > maxSize || h > maxSize) { const ratio = Math.min(maxSize / w, maxSize / h); w *= ratio; h *= ratio; } const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h); res(canvas.toDataURL('image/webp', 0.85)); }; img.onerror = () => res(src); img.src = src; }); }

function exportAll() { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(S.chars,null,2)],{type:'application/json'})); a.download='reverie_chars.json'; a.click(); }

async function deleteAllCharacters() { const ok = await customConfirm(`Delete ALL ${S.chars.length} characters?`, 'Cannot be undone.'); if (!ok) return; for (const c of S.chars) { await AppDB.delete('msgs_'+c.id); await AppDB.delete('charcfg_'+c.id); await AppDB.delete('sess_'+c.id); } S.chars = []; S.activeChats = []; await save(); showToast('All characters deleted.', 'success'); go('home'); }

async function restoreFullBackup(e) { const file = e.target.files[0]; if (!file) return; e.target.value = ''; const overlay = document.getElementById('loadingOverlay'); const loadText = document.getElementById('loadingText'); if (overlay) { overlay.classList.remove('hidden'); overlay.style.display = 'flex'; } if (loadText) loadText.innerText = 'Reading backup...'; try { const text = await file.text(); const data = JSON.parse(text); const keys = Object.keys(data); if (!data.rv_state || !Array.isArray(data.rv_state.chars)) throw new Error('Invalid backup'); for (let i = 0; i < keys.length; i++) { if (loadText) loadText.innerText = `Restoring ${i+1}/${keys.length}...`; if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); await AppDB.set(keys[i], data[keys[i]]); } if (overlay) { overlay.classList.add('hidden'); overlay.style.display = ''; } showToast('Restore complete. Reloading...', 'success'); setTimeout(() => location.reload(), 1200); } catch (err) { if (overlay) { overlay.classList.add('hidden'); overlay.style.display = ''; } showToast('Restore failed: ' + err.message, 'error'); } }

async function removeActiveChat(charId) { const ok = await customConfirm('Close this chat?', 'History won\'t be deleted.'); if (!ok) return; S.activeChats = S.activeChats.filter(ac => ac.id !== charId); await save(); render(); }

// ─── CUSTOM MODAL ─────────────────────────────────────────
let _modalResolve = null;
function customConfirm(title, message) { return new Promise(resolve => { _modalResolve = resolve; document.getElementById('modalTitle').textContent = title; document.getElementById('modalBody').innerHTML = `<p>${esc(message||'')}</p>`; document.getElementById('modalCancel').textContent = 'Cancel'; document.getElementById('modalConfirm').textContent = 'Confirm'; document.getElementById('modalConfirm').className = 'modal-btn confirm'; document.getElementById('modalOverlay').classList.remove('hidden'); }); }
function customPrompt(title, defaultVal) { return new Promise(resolve => { _modalResolve = resolve; document.getElementById('modalTitle').textContent = title; document.getElementById('modalBody').innerHTML = `<textarea id="modalTextarea">${esc(defaultVal||'')}</textarea>`; document.getElementById('modalCancel').textContent = 'Cancel'; document.getElementById('modalConfirm').textContent = 'Save'; document.getElementById('modalConfirm').className = 'modal-btn confirm'; document.getElementById('modalOverlay').classList.remove('hidden'); setTimeout(() => { const ta = document.getElementById('modalTextarea'); if(ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }, 50); }); }
function modalResolve(val) { document.getElementById('modalOverlay').classList.add('hidden'); if (_modalResolve) { if (val === false) { _modalResolve(null); } else if (val && document.getElementById('modalTextarea')) { _modalResolve(document.getElementById('modalTextarea').value); } else { _modalResolve(val); } _modalResolve = null; } }

// ─── TOAST ────────────────────────────────────────────────
function showToast(message, type = 'info') { const iconMap = { success: 'check_circle', error: 'error', info: 'info' }; const container = document.getElementById('toastContainer'); const toast = document.createElement('div'); toast.className = `toast ${type}`; toast.innerHTML = `<span class="material-icons-round">${iconMap[type]||'info'}</span><span>${esc(message)}</span>`; container.appendChild(toast); setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-12px) scale(.95)'; toast.style.transition = 'all .3s ease'; setTimeout(() => toast.remove(), 300); }, 3000); }
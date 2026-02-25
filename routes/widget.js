/**
 * widget.js route — Sirve el script embebible dinámico
 * Uso: <script src="https://tu-backend.railway.app/widget.js?clientId=XXXX"></script>
 */

module.exports = (req, res) => {
  const { clientId } = req.query;
  if (!clientId) {
    return res.status(400).type('text/javascript').send('console.error("AutoCerebra: clientId requerido");');
  }

  const backendUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;

  // El widget es un IIFE con Shadow DOM para no contaminar el CSS de la web del cliente
  const widgetScript = `
(function() {
  'use strict';
  const BACKEND = '${backendUrl}';
  const CLIENT_ID = '${clientId}';
  let sessionId = localStorage.getItem('ac_session_' + CLIENT_ID) || null;
  let config = null;
  let isOpen = false;
  let isTyping = false;

  // ── Cargar configuración del bot ──────────────────────────
  async function loadConfig() {
    try {
      const res = await fetch(BACKEND + '/api/chat/config/' + CLIENT_ID);
      if (!res.ok) throw new Error('Config no disponible');
      config = await res.json();
      injectWidget();
    } catch(e) {
      console.error('AutoCerebra: No se pudo cargar la config del chatbot', e);
    }
  }

  // ── Crear widget en Shadow DOM ────────────────────────────
  function injectWidget() {
    const host = document.createElement('div');
    host.id = 'autocerebra-host';
    host.style.cssText = 'position:fixed;z-index:2147483647;' +
      (config.position === 'bottom-left' ? 'bottom:20px;left:20px;' : 'bottom:20px;right:20px;');
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    const primary = config.primaryColor || '#e8341c';

    shadow.innerHTML = \`
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :host { font-family: 'Segoe UI', Arial, sans-serif; }

        #ac-btn {
          width: 60px; height: 60px; border-radius: 50%;
          background: ${primary}; border: none; cursor: pointer;
          box-shadow: 0 4px 20px rgba(0,0,0,.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 26px; transition: transform .2s, box-shadow .2s;
          position: relative;
        }
        #ac-btn:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(0,0,0,.3); }
        #ac-btn .badge {
          position: absolute; top: -4px; right: -4px;
          width: 18px; height: 18px; border-radius: 50%;
          background: #00b86b; border: 2px solid white;
          display: none; animation: pulse 2s infinite;
        }
        @keyframes pulse { 0%,100%{transform:scale(1)}50%{transform:scale(1.15)} }

        #ac-window {
          width: 360px; height: 520px;
          background: white; border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,.2);
          display: flex; flex-direction: column;
          margin-bottom: 12px; overflow: hidden;
          transform-origin: bottom right;
          animation: slideUp .25s ease;
        }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }

        #ac-header {
          background: \${primary}; padding: 16px 18px;
          display: flex; align-items: center; gap: 12px;
          flex-shrink: 0;
        }
        .ac-avatar { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .ac-header-info { flex: 1; }
        .ac-bot-name { color: white; font-weight: 700; font-size: .95rem; }
        .ac-status { color: rgba(255,255,255,.7); font-size: .75rem; display: flex; align-items: center; gap: 5px; }
        .ac-dot { width: 7px; height: 7px; border-radius: 50%; background: #00e676; }
        .ac-close { color: rgba(255,255,255,.8); cursor: pointer; font-size: 1.3rem; line-height: 1; padding: 4px; background: none; border: none; }
        .ac-close:hover { color: white; }

        #ac-messages {
          flex: 1; overflow-y: auto; padding: 16px;
          display: flex; flex-direction: column; gap: 10px;
          background: #f8f8f8;
        }
        #ac-messages::-webkit-scrollbar { width: 4px; }
        #ac-messages::-webkit-scrollbar-track { background: transparent; }
        #ac-messages::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }

        .ac-msg { display: flex; gap: 8px; max-width: 85%; }
        .ac-msg.user { align-self: flex-end; flex-direction: row-reverse; }
        .ac-msg.bot  { align-self: flex-start; }
        .ac-bubble {
          padding: 10px 14px; border-radius: 18px;
          font-size: .875rem; line-height: 1.5; word-break: break-word;
        }
        .ac-msg.bot  .ac-bubble { background: white; color: #111; border-bottom-left-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
        .ac-msg.user .ac-bubble { background: \${primary}; color: white; border-bottom-right-radius: 4px; }

        .ac-typing { display: flex; gap: 4px; padding: 12px 16px; }
        .ac-typing span { width: 8px; height: 8px; border-radius: 50%; background: #aaa; animation: bounce .9s infinite; }
        .ac-typing span:nth-child(2) { animation-delay: .15s; }
        .ac-typing span:nth-child(3) { animation-delay: .3s; }
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)} }

        #ac-footer { padding: 10px 12px; background: white; border-top: 1px solid #eee; flex-shrink: 0; }
        #ac-form { display: flex; gap: 8px; align-items: center; }
        #ac-input {
          flex: 1; padding: 10px 14px; border: 1px solid #e0e0e0;
          border-radius: 24px; font-size: .875rem; outline: none;
          transition: border-color .2s; font-family: inherit;
        }
        #ac-input:focus { border-color: \${primary}; }
        #ac-send {
          width: 40px; height: 40px; border-radius: 50%;
          background: \${primary}; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: opacity .2s;
        }
        #ac-send:hover { opacity: .88; }
        #ac-send svg { width: 18px; height: 18px; fill: white; }
        .ac-powered { text-align: center; font-size: .65rem; color: #bbb; padding: 4px 0 0; }
        .ac-powered a { color: #bbb; text-decoration: none; }

        @media (max-width: 400px) {
          #ac-window { width: 100vw; height: 100vh; border-radius: 0; margin: 0; }
        }
      </style>

      <div id="ac-container" style="display:flex;flex-direction:column;align-items:flex-end;">
        <div id="ac-window" style="display:none;">
          <div id="ac-header">
            <div class="ac-avatar">\${config.avatar || '🤖'}</div>
            <div class="ac-header-info">
              <div class="ac-bot-name">\${config.botName}</div>
              <div class="ac-status"><span class="ac-dot"></span>Online ahora</div>
            </div>
            <button class="ac-close" id="ac-close-btn">✕</button>
          </div>
          <div id="ac-messages"></div>
          <div id="ac-footer">
            <div id="ac-form">
              <input id="ac-input" type="text" placeholder="Escribe tu mensaje..." maxlength="500" autocomplete="off" />
              <button id="ac-send">
                <svg viewBox="0 0 24 24"><path d="M2 21L23 12 2 3v7l15 2-15 2z"/></svg>
              </button>
            </div>
            <div class="ac-powered">Asistente por <a href="https://autocerebra.ai" target="_blank">AutoCerebra AI</a></div>
          </div>
        </div>
        <button id="ac-btn">
          <span id="ac-btn-icon">\${config.avatar || '💬'}</span>
          <span class="badge" id="ac-badge"></span>
        </button>
      </div>
    \`;

    const win   = shadow.getElementById('ac-window');
    const btn   = shadow.getElementById('ac-btn');
    const msgs  = shadow.getElementById('ac-messages');
    const input = shadow.getElementById('ac-input');
    const send  = shadow.getElementById('ac-send');
    const close = shadow.getElementById('ac-close-btn');
    const badge = shadow.getElementById('ac-badge');

    // Show badge after 5s
    setTimeout(() => { badge.style.display = 'block'; }, 5000);

    // Open/close
    function openChat() {
      isOpen = true;
      win.style.display = 'flex';
      btn.style.display = 'none';
      badge.style.display = 'none';
      input.focus();
      if (msgs.children.length === 0) {
        addMessage('bot', config.greeting || '¡Hola! ¿En qué puedo ayudarte?');
      }
      scrollBottom();
    }

    function closeChat() {
      isOpen = false;
      win.style.display = 'none';
      btn.style.display = 'flex';
    }

    btn.addEventListener('click', openChat);
    close.addEventListener('click', closeChat);

    // Send message
    async function sendMessage() {
      const text = input.value.trim();
      if (!text || isTyping) return;

      input.value = '';
      addMessage('user', text);
      setTyping(true);
      scrollBottom();

      try {
        const res = await fetch(BACKEND + '/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: CLIENT_ID, message: text, sessionId }),
        });

        const data = await res.json();
        if (data.sessionId) {
          sessionId = data.sessionId;
          localStorage.setItem('ac_session_' + CLIENT_ID, sessionId);
        }

        setTyping(false);
        if (data.response) addMessage('bot', data.response);
        if (data.error)    addMessage('bot', '😕 Lo siento, ha habido un error. Inténtalo de nuevo.');

      } catch(e) {
        setTyping(false);
        addMessage('bot', '😕 No puedo conectar ahora mismo. Inténtalo en un momento.');
      }

      scrollBottom();
    }

    send.addEventListener('click', sendMessage);
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(); });

    function addMessage(role, text) {
      const wrap = document.createElement('div');
      wrap.className = 'ac-msg ' + role;
      wrap.innerHTML = '<div class="ac-bubble">' + escapeHtml(text).replace(/\\n/g,'<br>') + '</div>';
      msgs.appendChild(wrap);
    }

    function setTyping(v) {
      isTyping = v;
      const existing = shadow.getElementById('ac-typing');
      if (v && !existing) {
        const t = document.createElement('div');
        t.className = 'ac-msg bot'; t.id = 'ac-typing';
        t.innerHTML = '<div class="ac-bubble"><div class="ac-typing"><span></span><span></span><span></span></div></div>';
        msgs.appendChild(t);
      } else if (!v && existing) {
        existing.remove();
      }
    }

    function scrollBottom() {
      setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 50);
    }

    function escapeHtml(t) {
      return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // Auto-open if configured
    if (config.initialOpen) setTimeout(openChat, 1000);
  }

  // ── Boot ──────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadConfig);
  } else {
    loadConfig();
  }

})();
`;
res.setHeader('Content-Type', 'application/javascript');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
};

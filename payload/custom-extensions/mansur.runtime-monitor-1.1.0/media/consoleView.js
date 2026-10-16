// Runtime Monitor - Console View Script
(function () {
  const vscode = acquireVsCodeApi();

  // State
  let isConnected = false;
  let devUrl = 'http://localhost:5173';
  let preserveLog = false;
  let isPaused = false;

  // Data
  const consoleEntries = new Map(); // id -> entry
  const objectPropertiesCache = new Map(); // objectId -> props
  const expandedObjectIds = new Set(); // set of expanded object IDs

  // Filters
  let consoleLevelFilter = 'all';
  let consoleSourceFilter = 'all';
  let consoleSearch = '';

  // DOM Elements
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const btnConnect = document.getElementById('btnConnect');
  const consoleList = document.getElementById('consoleList');
  const btnClearConsole = document.getElementById('btnClearConsole');
  const btnPauseConsole = document.getElementById('btnPauseConsole');
  const btnReloadConsole = document.getElementById('btnReloadConsole');
  const chkPreserveConsole = document.getElementById('chkPreserveConsole');
  const selectSourceFilter = document.getElementById('consoleSourceFilter');
  const inputSearchConsole = document.getElementById('consoleSearch');
  const scrollBottomBtn = document.getElementById('scrollBottomBtn');
  const filterBtns = document.querySelectorAll('#consoleLevelFilters .rm-filter-btn');

  // Autoscroll tracking
  let userScrolledUp = false;
  consoleList.addEventListener('scroll', () => {
    const fromBottom = consoleList.scrollHeight - consoleList.scrollTop - consoleList.clientHeight;
    if (fromBottom > 40) {
      userScrolledUp = true;
      scrollBottomBtn.style.display = 'block';
    } else {
      userScrolledUp = false;
      scrollBottomBtn.style.display = 'none';
    }
  });

  scrollBottomBtn.addEventListener('click', () => {
    consoleList.scrollTop = consoleList.scrollHeight;
    userScrolledUp = false;
    scrollBottomBtn.style.display = 'none';
  });

  // Connect button
  btnConnect.addEventListener('click', () => {
    vscode.postMessage({ type: 'connect' });
  });

  // Toolbar actions
  btnClearConsole.addEventListener('click', () => {
    vscode.postMessage({ type: 'clearConsole' });
  });

  btnPauseConsole.addEventListener('click', () => {
    isPaused = !isPaused;
    btnPauseConsole.classList.toggle('active', isPaused);
    btnPauseConsole.textContent = isPaused ? 'Продолжить' : 'Пауза';
  });

  if (btnReloadConsole) {
    btnReloadConsole.addEventListener('click', () => {
      vscode.postMessage({ type: 'reloadPage' });
    });
  }

  chkPreserveConsole.addEventListener('change', (e) => {
    preserveLog = e.target.checked;
    vscode.postMessage({ type: 'setPreserveLog', value: preserveLog });
  });

  // Level filters
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      consoleLevelFilter = btn.dataset.level || 'all';
      renderConsole();
    });
  });

  // Source filter
  selectSourceFilter.addEventListener('change', (e) => {
    consoleSourceFilter = e.target.value;
    renderConsole();
  });

  // Search input
  let searchTimeout = null;
  inputSearchConsole.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      consoleSearch = e.target.value.trim().toLowerCase();
      renderConsole();
    }, 150);
  });

  function pathBasename(p) {
    if (!p) return '';
    return p.split(/[\/\\]/).pop() || p;
  }

  function updateSourceDropdown() {
    const sources = new Set();
    consoleEntries.forEach(entry => {
      if (entry.errorDetail && entry.errorDetail.filePath) {
        sources.add(pathBasename(entry.errorDetail.filePath));
      } else if (entry.sourceFile) {
        const clean = entry.sourceFile.split(':')[0];
        if (clean) sources.add(pathBasename(clean));
      }
    });

    const currentVal = selectSourceFilter.value;
    selectSourceFilter.innerHTML = '<option value="all">Все файлы</option>';

    Array.from(sources).sort().forEach(src => {
      const opt = document.createElement('option');
      opt.value = src;
      opt.textContent = src;
      if (src === currentVal) opt.selected = true;
      selectSourceFilter.appendChild(opt);
    });
  }

  function renderConsole() {
    consoleList.innerHTML = '';
    updateSourceDropdown();

    const entries = Array.from(consoleEntries.values());

    // Pinned first
    const pinned = entries.filter(e => e.pinned);
    if (pinned.length > 0) {
      const banner = document.createElement('div');
      banner.className = 'rm-pinned-banner';
      banner.textContent = 'ЗАКРЕПЛЕННЫЕ ЗАПИСИ';
      consoleList.appendChild(banner);
      pinned.forEach(entry => appendConsoleEntry(entry, true));

      const divider = document.createElement('div');
      divider.className = 'rm-pinned-divider';
      consoleList.appendChild(divider);
    }

    // Filtered entries
    const filtered = entries.filter(e => {
      if (consoleLevelFilter !== 'all') {
        if (consoleLevelFilter === 'log') {
          if (e.type !== 'log' && e.type !== 'debug') return false;
        } else if (consoleLevelFilter === 'warning') {
          if (e.type !== 'warning' && e.type !== 'warn') return false;
        } else if (e.type !== consoleLevelFilter) {
          return false;
        }
      }
      if (consoleSourceFilter !== 'all') {
        const file = (e.errorDetail && e.errorDetail.filePath) || e.sourceFile || '';
        if (!file.toLowerCase().includes(consoleSourceFilter.toLowerCase())) return false;
      }
      if (consoleSearch) {
        const text = (
          (e.errorDetail ? `${e.errorDetail.title} ${e.errorDetail.cleanMessage} ${e.errorDetail.filePath || ''} ${e.errorDetail.errorCode || ''}` : '') +
          ' ' + (e.text || '') + ' ' + (e.sourceFile || '')
        ).toLowerCase();
        if (!text.includes(consoleSearch)) return false;
      }
      return true;
    });

    filtered.forEach(entry => appendConsoleEntry(entry, false));

    if (!userScrolledUp) {
      consoleList.scrollTop = consoleList.scrollHeight;
    }
  }

  function appendConsoleEntry(entry, isPinnedSection) {
    if (entry.type === 'error' && entry.errorDetail) {
      const card = renderErrorCard(entry);
      consoleList.appendChild(card);
      return;
    }

    const row = document.createElement('div');
    const typeClass = entry.type === 'warning' ? 'warn' : entry.type;
    row.className = `rm-console-entry ${typeClass} ${entry.pinned ? 'pinned' : ''}`;

    // Timestamp
    const time = document.createElement('span');
    time.className = 'rm-console-time';
    time.textContent = entry.timeFormatted || '';
    row.appendChild(time);

    // Body
    const body = document.createElement('div');
    body.className = 'rm-console-body';

    if (entry.args && entry.args.length > 0) {
      entry.args.forEach(arg => {
        const argEl = renderArg(arg, true);
        body.appendChild(argEl);
      });
    } else {
      const textSpan = document.createElement('span');
      textSpan.textContent = entry.text || '(empty)';
      body.appendChild(textSpan);
    }

    // Stack trace (for non-vite exceptions or warnings)
    if (entry.stackTrace && entry.stackTrace.length > 0 && entry.type === 'error') {
      const stack = document.createElement('div');
      stack.className = 'rm-console-stack';
      entry.stackTrace.forEach(frame => {
        const frameDiv = document.createElement('div');
        frameDiv.textContent = frame;
        stack.appendChild(frameDiv);
      });
      body.appendChild(stack);
    }

    row.appendChild(body);

    // Source link (right-aligned like Chrome DevTools)
    if (entry.sourceFile) {
      const src = document.createElement('span');
      src.className = 'rm-console-source';
      src.textContent = entry.sourceFile;
      src.title = `Перейти к ${entry.sourceFile} в редакторе`;
      src.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({
          type: 'openSource',
          url: entry.sourceRawUrl || entry.sourceFile,
          line: entry.sourceLine || 1,
          column: entry.sourceCol || 1
        });
      });
      row.appendChild(src);
    }

    // Entry Actions on hover
    const actions = document.createElement('div');
    actions.className = 'rm-entry-actions';

    const pinBtn = document.createElement('button');
    pinBtn.className = 'rm-action-btn';
    pinBtn.textContent = entry.pinned ? 'Открепить' : 'Закрепить';
    pinBtn.title = entry.pinned ? 'Открепить запись' : 'Закрепить запись сверху';
    pinBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      vscode.postMessage({ type: 'pinConsole', id: entry.id });
    });
    actions.appendChild(pinBtn);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'rm-action-btn';
    copyBtn.textContent = 'Копировать';
    copyBtn.title = 'Копировать сообщение';
    copyBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      vscode.postMessage({
        type: 'copy',
        text: entry.text || JSON.stringify(entry.args)
      });
    });
    actions.appendChild(copyBtn);

    row.appendChild(actions);
    consoleList.appendChild(row);
  }

  function renderErrorCard(entry) {
    const card = document.createElement('div');
    card.className = `rm-console-entry error rm-error-card ${entry.pinned ? 'pinned' : ''}`;

    const detail = entry.errorDetail;

    // Header: Title + Badge + Time
    const header = document.createElement('div');
    header.className = 'rm-error-header';

    const title = document.createElement('span');
    title.className = 'rm-error-title';
    title.textContent = detail.title || 'Error';
    header.appendChild(title);

    if (detail.errorCode) {
      const badge = document.createElement('span');
      badge.className = 'rm-error-badge';
      badge.textContent = detail.errorCode;
      header.appendChild(badge);
    }

    const time = document.createElement('span');
    time.className = 'rm-error-time';
    time.textContent = entry.timeFormatted || '';
    header.appendChild(time);

    card.appendChild(header);

    // Message
    const msg = document.createElement('div');
    msg.className = 'rm-error-message';
    msg.textContent = detail.cleanMessage || entry.text || '(unknown error)';

    if (detail.filePath && detail.line) {
      msg.classList.add('clickable');
      msg.title = `Перейти к ${detail.filePath}:${detail.line}:${detail.column || 1}`;
      msg.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({
          type: 'openSource',
          url: detail.fullPath || detail.filePath,
          line: detail.line,
          column: detail.column || 1
        });
      });
    }
    card.appendChild(msg);

    // Location
    if (detail.filePath) {
      const loc = document.createElement('div');
      loc.className = 'rm-error-location';
      const locText = `${detail.filePath}${detail.line ? ':' + detail.line : ''}${detail.column ? ':' + detail.column : ''}`;
      loc.textContent = locText;
      loc.title = `Перейти к ${locText} в редакторе`;
      loc.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({
          type: 'openSource',
          url: detail.fullPath || detail.filePath,
          line: detail.line || 1,
          column: detail.column || 1
        });
      });
      card.appendChild(loc);
    }

    // Code Frame
    if (detail.codeFrame) {
      const frameDiv = document.createElement('div');
      frameDiv.className = 'rm-error-frame';
      const pre = document.createElement('pre');
      pre.className = 'rm-code-frame';
      pre.textContent = detail.codeFrame;
      frameDiv.appendChild(pre);
      card.appendChild(frameDiv);
    }

    // Technical Details
    const hasTechDetails = detail.rawMessage ||
      (detail.clientStack && detail.clientStack.length > 0) ||
      (detail.browserStack && detail.browserStack.length > 0) ||
      detail.plugin;

    if (hasTechDetails) {
      const details = document.createElement('details');
      details.className = 'rm-error-details';

      const summary = document.createElement('summary');
      summary.className = 'rm-error-details-summary';
      summary.textContent = 'Технические детали';
      details.appendChild(summary);

      const body = document.createElement('div');
      body.className = 'rm-error-details-body';

      if (detail.plugin) {
        const p = document.createElement('div');
        p.innerHTML = `<strong>Plugin:</strong> ${escapeHtml(detail.plugin)}`;
        body.appendChild(p);
      }
      if (detail.originalUrl) {
        const u = document.createElement('div');
        u.innerHTML = `<strong>Original URL:</strong> ${escapeHtml(detail.originalUrl)}`;
        body.appendChild(u);
      }
      if (detail.clientStack && detail.clientStack.length > 0) {
        const cs = document.createElement('div');
        cs.style.marginTop = '4px';
        cs.innerHTML = '<strong>Vite Client Stack:</strong>';
        const pre = document.createElement('pre');
        pre.textContent = detail.clientStack.join('\n');
        cs.appendChild(pre);
        body.appendChild(cs);
      }
      if (detail.browserStack && detail.browserStack.length > 0) {
        const bs = document.createElement('div');
        bs.style.marginTop = '4px';
        bs.innerHTML = '<strong>Browser Stack:</strong>';
        const pre = document.createElement('pre');
        pre.textContent = detail.browserStack.join('\n');
        bs.appendChild(pre);
        body.appendChild(bs);
      }
      if (detail.rawMessage && detail.rawMessage !== detail.cleanMessage) {
        const rm = document.createElement('div');
        rm.style.marginTop = '4px';
        rm.innerHTML = '<strong>Raw Message:</strong>';
        const pre = document.createElement('pre');
        pre.textContent = detail.rawMessage;
        rm.appendChild(pre);
        body.appendChild(rm);
      }

      details.appendChild(body);
      card.appendChild(details);
    }

    // Hover actions
    const actions = document.createElement('div');
    actions.className = 'rm-entry-actions';

    const pinBtn = document.createElement('button');
    pinBtn.className = 'rm-action-btn';
    pinBtn.textContent = entry.pinned ? 'Открепить' : 'Закрепить';
    pinBtn.title = entry.pinned ? 'Открепить запись' : 'Закрепить запись сверху';
    pinBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      vscode.postMessage({ type: 'pinConsole', id: entry.id });
    });
    actions.appendChild(pinBtn);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'rm-action-btn';
    copyBtn.textContent = 'Копировать';
    copyBtn.title = 'Копировать сообщение об ошибке';
    copyBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const parts = [
        detail.title,
        detail.errorCode ? `[${detail.errorCode}]` : '',
        detail.cleanMessage,
        detail.filePath ? `${detail.filePath}:${detail.line || 1}:${detail.column || 1}` : '',
        detail.codeFrame || ''
      ].filter(Boolean);
      vscode.postMessage({ type: 'copy', text: parts.join('\n') });
    });
    actions.appendChild(copyBtn);

    card.appendChild(actions);
    return card;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderArg(arg, isTopLevel = false) {
    if (!arg) {
      const span = document.createElement('span');
      span.className = 'rm-tree-val-undefined';
      span.textContent = 'undefined';
      return span;
    }

    if (arg.type === 'string') {
      const span = document.createElement('span');
      span.className = 'rm-tree-val-string';
      // Top-level string is unquoted (e.g. console.log("hello") -> hello)
      span.textContent = isTopLevel ? arg.value : `"${arg.value}"`;
      return span;
    }

    if (arg.type === 'number') {
      const span = document.createElement('span');
      span.className = 'rm-tree-val-number';
      span.textContent = String(arg.value);
      return span;
    }

    if (arg.type === 'boolean') {
      const span = document.createElement('span');
      span.className = 'rm-tree-val-boolean';
      span.textContent = String(arg.value);
      return span;
    }

    if (arg.type === 'undefined') {
      const span = document.createElement('span');
      span.className = 'rm-tree-val-undefined';
      span.textContent = 'undefined';
      return span;
    }

    if (arg.type === 'object' && arg.subtype === 'null') {
      const span = document.createElement('span');
      span.className = 'rm-tree-val-null';
      span.textContent = 'null';
      return span;
    }

    if (arg.type === 'object' || arg.subtype === 'array') {
      return renderObjectNode(arg);
    }

    const span = document.createElement('span');
    span.textContent = arg.description || (arg.value !== undefined ? String(arg.value) : '');
    return span;
  }

  function renderObjectNode(arg) {
    const container = document.createElement('div');
    container.className = 'rm-tree-node';

    const header = document.createElement('div');
    header.className = 'rm-tree-header';
    header.style.cursor = 'pointer';

    const isArray = arg.subtype === 'array' || arg.className === 'Array';
    const isExpanded = arg.objectId && expandedObjectIds.has(arg.objectId);

    const toggle = document.createElement('span');
    toggle.className = 'rm-tree-toggle';
    toggle.textContent = isExpanded ? '▼' : '▶';

    const preview = document.createElement('span');
    preview.className = 'rm-tree-val-preview';

    // Format header preview text
    let previewText = arg.description || (isArray ? 'Array' : 'Object');
    if (!isArray && arg.preview && arg.preview.properties && arg.preview.properties.length > 0) {
      const propsStr = arg.preview.properties.slice(0, 5).map(p => {
        const v = p.value !== undefined ? (p.type === 'string' ? `"${p.value}"` : p.value) : p.type;
        return `${p.name}: ${v}`;
      }).join(', ');
      previewText = `Object { ${propsStr}${arg.preview.overflow ? ', …' : ''} }`;
    }
    preview.textContent = previewText;

    header.appendChild(toggle);
    header.appendChild(preview);
    container.appendChild(header);

    const children = document.createElement('div');
    children.className = 'rm-tree-children';
    children.style.display = isExpanded ? 'block' : 'none';
    container.appendChild(children);

    function updatePropertiesDisplay() {
      const cached = arg.objectId ? objectPropertiesCache.get(arg.objectId) : null;
      if (cached) {
        renderProperties(children, cached, isArray);
      } else if (arg.preview && arg.preview.properties && arg.preview.properties.length > 0) {
        renderPreviewProperties(children, arg.preview.properties, isArray);
        if (arg.objectId) {
          vscode.postMessage({
            type: 'getObjectProperties',
            objectId: arg.objectId
          });
        }
      } else if (arg.objectId) {
        children.textContent = 'Загрузка...';
        vscode.postMessage({
          type: 'getObjectProperties',
          objectId: arg.objectId
        });
      } else {
        children.textContent = isArray ? '[]' : '{}';
      }
    }

    if (isExpanded) {
      updatePropertiesDisplay();
    }

    header.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const willExpand = !children.style.display || children.style.display === 'none';
      if (willExpand) {
        if (arg.objectId) expandedObjectIds.add(arg.objectId);
        toggle.textContent = '▼';
        children.style.display = 'block';
        updatePropertiesDisplay();
      } else {
        if (arg.objectId) expandedObjectIds.delete(arg.objectId);
        toggle.textContent = '▶';
        children.style.display = 'none';
      }
    });

    return container;
  }

  function renderProperties(container, props, isArray) {
    container.innerHTML = '';
    if (!props || props.length === 0) {
      container.textContent = isArray ? '[]' : '{}';
      return;
    }

    const displayProps = props.filter(p => {
      if (isArray && p.name === 'length') return true;
      if (p.name.startsWith('__')) return false;
      return true;
    });

    displayProps.forEach(p => {
      const line = document.createElement('div');
      line.className = 'rm-tree-node';

      const key = document.createElement('span');
      key.className = 'rm-tree-key';
      key.textContent = `${p.name}: `;
      line.appendChild(key);

      if (p.value) {
        line.appendChild(renderArg(p.value, false));
      } else if (p.type) {
        const v = document.createElement('span');
        v.className = p.type === 'string' ? 'rm-tree-val-string' : 'rm-tree-val-number';
        v.textContent = String(p.description || p.type);
        line.appendChild(v);
      } else {
        const v = document.createElement('span');
        v.className = 'rm-tree-val-preview';
        v.textContent = 'undefined';
        line.appendChild(v);
      }

      container.appendChild(line);
    });
  }

  function renderPreviewProperties(container, props, isArray) {
    container.innerHTML = '';
    props.forEach(p => {
      const line = document.createElement('div');
      line.className = 'rm-tree-node';

      const key = document.createElement('span');
      key.className = 'rm-tree-key';
      key.textContent = `${p.name}: `;
      line.appendChild(key);

      const val = document.createElement('span');
      if (p.type === 'string') {
        val.className = 'rm-tree-val-string';
        val.textContent = `"${p.value}"`;
      } else if (p.type === 'number') {
        val.className = 'rm-tree-val-number';
        val.textContent = String(p.value);
      } else if (p.type === 'boolean') {
        val.className = 'rm-tree-val-boolean';
        val.textContent = String(p.value);
      } else if (p.type === 'object') {
        val.className = 'rm-tree-val-preview';
        val.textContent = p.value || '{...}';
      } else {
        val.textContent = String(p.value);
      }
      line.appendChild(val);
      container.appendChild(line);
    });
  }

  function updateConnectionState(status, customText) {
    if (status) {
      connectionStatus = status;
    }
    if (connectionStatus === 'connected' || isConnected) {
      statusDot.className = 'rm-status-dot connected';
      statusText.textContent = 'Подключено';
      btnConnect.style.display = 'none';
    } else if (connectionStatus === 'disconnected') {
      statusDot.className = 'rm-status-dot disconnected';
      statusText.textContent = customText || 'Отключено';
      btnConnect.style.display = 'inline-flex';
      btnConnect.title = 'Запустить / переподключить headless runtime';
    } else {
      statusDot.className = 'rm-status-dot waiting';
      statusText.textContent = customText || 'Ожидание localhost...';
      btnConnect.style.display = 'inline-flex';
      btnConnect.title = 'Запустить / переподключить headless runtime';
    }
  }

  // Handle messages from Extension Host
  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'init': {
        isConnected = msg.connected;
        devUrl = msg.devUrl || devUrl;
        if (msg.preserveLog !== undefined) {
          preserveLog = msg.preserveLog;
          if (chkPreserveConsole) chkPreserveConsole.checked = preserveLog;
        }
        updateConnectionState(isConnected ? 'connected' : (msg.status || 'waiting'));
        if (msg.logs) {
          msg.logs.forEach(l => consoleEntries.set(l.id, l));
          renderConsole();
        }
        break;
      }
      case 'status': {
        if (msg.status === 'connected') {
          isConnected = true;
          updateConnectionState('connected');
        } else if (msg.status === 'waiting') {
          isConnected = false;
          updateConnectionState('waiting', msg.text);
        } else if (msg.status === 'disconnected') {
          isConnected = false;
          updateConnectionState('disconnected', msg.text);
        }
        break;
      }
      case 'connected': {
        isConnected = true;
        devUrl = msg.url || devUrl;
        updateConnectionState('connected');
        break;
      }
      case 'disconnected': {
        isConnected = false;
        updateConnectionState('disconnected', msg.text || 'Отключено');
        break;
      }
      case 'consoleBatch': {
        if (!isPaused && msg.entries) {
          msg.entries.forEach(e => consoleEntries.set(e.id, e));
          renderConsole();
        }
        break;
      }
      case 'clearConsole': {
        consoleEntries.clear();
        objectPropertiesCache.clear();
        expandedObjectIds.clear();
        renderConsole();
        break;
      }
      case 'pinUpdated': {
        const entry = consoleEntries.get(msg.id);
        if (entry) {
          entry.pinned = msg.pinned;
          renderConsole();
        }
        break;
      }
      case 'objectProperties': {
        if (msg.objectId && msg.properties) {
          objectPropertiesCache.set(msg.objectId, msg.properties);
          renderConsole();
        }
        break;
      }
    }
  });
})();

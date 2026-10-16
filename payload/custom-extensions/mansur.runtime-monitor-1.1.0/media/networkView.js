// Runtime Monitor - Network View Script
(function () {
  const vscode = acquireVsCodeApi();

  // State
  let isConnected = false;
  let devUrl = 'http://localhost:5173';
  let isRecording = true;
  let preserveLog = false;
  let selectedRequestId = null;
  let activeDetailsTab = 'general';
  let diffSelection = []; // [id1, id2]

  // Data
  const networkRequests = new Map(); // id -> request
  const responseBodyCache = new Map(); // requestId -> { body, base64Encoded }

  // Filters
  let networkTypeFilter = 'all';
  let networkSearch = '';

  // DOM Elements
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const btnConnect = document.getElementById('btnConnect');
  const networkTbody = document.getElementById('networkTbody');
  const btnClearNetwork = document.getElementById('btnClearNetwork');
  const btnRecordNetwork = document.getElementById('btnRecordNetwork');
  const btnReloadPage = document.getElementById('btnReloadPage');
  const chkPreserveNetwork = document.getElementById('chkPreserveNetwork');
  const inputSearchNetwork = document.getElementById('networkSearch');
  const filterBtns = document.querySelectorAll('#networkTypeFilters .rm-filter-btn');
  const btnCompareResponse = document.getElementById('btnCompareResponse');
  const diffDrawer = document.getElementById('diffDrawer');
  const btnCloseDiff = document.getElementById('btnCloseDiff');
  const diffContent = document.getElementById('diffContent');

  // Connect button
  btnConnect.addEventListener('click', () => {
    vscode.postMessage({ type: 'connect' });
  });

  // Toolbar Actions
  btnClearNetwork.addEventListener('click', () => {
    vscode.postMessage({ type: 'clearNetwork' });
  });

  btnRecordNetwork.addEventListener('click', () => {
    isRecording = !isRecording;
    btnRecordNetwork.classList.toggle('active', isRecording);
    btnRecordNetwork.textContent = isRecording ? 'Запись' : 'Приостановлено';
  });

  btnReloadPage.addEventListener('click', () => {
    vscode.postMessage({ type: 'reloadPage' });
  });

  chkPreserveNetwork.addEventListener('change', (e) => {
    preserveLog = e.target.checked;
    vscode.postMessage({ type: 'setPreserveLog', value: preserveLog });
  });

  inputSearchNetwork.addEventListener('input', (e) => {
    networkSearch = e.target.value.toLowerCase();
    renderNetwork();
  });

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      networkTypeFilter = btn.getAttribute('data-type') || 'all';
      renderNetwork();
    });
  });

  btnCompareResponse.addEventListener('click', () => {
    if (diffSelection.length === 2) {
      vscode.postMessage({
        type: 'requestDiff',
        id1: diffSelection[0],
        id2: diffSelection[1]
      });
    }
  });

  btnCloseDiff.addEventListener('click', () => {
    diffDrawer.style.display = 'none';
  });

  // Keyboard shortcut: Ctrl+F to search
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      inputSearchNetwork.focus();
      inputSearchNetwork.select();
    } else if (e.key === 'Escape') {
      if (diffDrawer.style.display !== 'none') {
        diffDrawer.style.display = 'none';
      } else if (selectedRequestId) {
        selectedRequestId = null;
        renderNetwork();
      }
    }
  });

  // Render Network
  function renderNetwork() {
    networkTbody.innerHTML = '';
    const requests = Array.from(networkRequests.values());

    const filtered = requests.filter(r => {
      // Type filter
      if (networkTypeFilter === 'xhr' && !['xhr', 'fetch'].includes((r.resourceType || '').toLowerCase())) return false;
      if (networkTypeFilter === 'doc' && !['document'].includes((r.resourceType || '').toLowerCase())) return false;
      if (networkTypeFilter === 'css' && !['stylesheet', 'css'].includes((r.resourceType || '').toLowerCase())) return false;
      if (networkTypeFilter === 'js' && !['script', 'js'].includes((r.resourceType || '').toLowerCase())) return false;
      if (networkTypeFilter === 'failed' && !r.failed && (r.status < 400 || !r.status)) return false;
      if (networkTypeFilter === 'slow' && (!r.durationMs || r.durationMs < 1000)) return false;
      if (networkTypeFilter === 'dup' && !r.isDuplicate) return false;

      // Search
      if (networkSearch) {
        const text = ((r.name || '') + ' ' + (r.url || '') + ' ' + (r.method || '') + ' ' + (r.status || '') + ' ' + (r.initiator?.raw || '')).toLowerCase();
        if (!text.includes(networkSearch)) return false;
      }

      return true;
    });

    filtered.forEach(req => {
      appendNetworkRow(req);
    });

    // Update diff button visibility
    if (diffSelection.length === 2) {
      btnCompareResponse.style.display = 'inline-flex';
      btnCompareResponse.textContent = `Сравнить (2)`;
    } else if (diffSelection.length === 1) {
      btnCompareResponse.style.display = 'inline-flex';
      btnCompareResponse.textContent = `Сравнить (выберите 2-й)`;
    } else {
      btnCompareResponse.style.display = 'none';
    }
  }

  function appendNetworkRow(req) {
    const tr = document.createElement('tr');
    const isSelected = selectedRequestId === req.id;
    const isDiffSelected = diffSelection.includes(req.id);
    tr.className = `rm-network-row ${isSelected ? 'selected' : ''} ${isDiffSelected ? 'diff-selected' : ''} ${req.pinned ? 'pinned' : ''}`;

    // Name
    const tdName = document.createElement('td');
    tdName.className = 'rm-network-td col-name';
    tdName.textContent = req.name || req.url;
    tdName.title = req.url;

    if (req.isDuplicate && req.duplicateCount && req.duplicateCount > 1) {
      const dup = document.createElement('span');
      dup.className = 'rm-badge rm-badge-dup';
      dup.textContent = `×${req.duplicateCount}`;
      dup.title = 'Повторный запрос за короткий интервал';
      tdName.appendChild(dup);
    }
    if (req.durationMs && req.durationMs > 3000) {
      const slow = document.createElement('span');
      slow.className = 'rm-badge rm-badge-critical';
      slow.textContent = 'Медленный';
      tdName.appendChild(slow);
    } else if (req.durationMs && req.durationMs > 1000) {
      const slow = document.createElement('span');
      slow.className = 'rm-badge rm-badge-slow';
      slow.textContent = 'Медленный';
      tdName.appendChild(slow);
    }
    tr.appendChild(tdName);

    // Method
    const tdMethod = document.createElement('td');
    tdMethod.className = 'rm-network-td col-method';
    const methodSpan = document.createElement('span');
    methodSpan.className = `rm-method-badge ${req.method.toLowerCase()}`;
    methodSpan.textContent = req.method;
    tdMethod.appendChild(methodSpan);
    tr.appendChild(tdMethod);

    // Status
    const tdStatus = document.createElement('td');
    tdStatus.className = 'rm-network-td col-status';
    const statusSpan = document.createElement('span');
    statusSpan.className = 'rm-status-badge';
    if (req.failed) {
      statusSpan.className += ' rm-status-failed';
      statusSpan.textContent = req.errorText || 'Failed';
    } else if (req.status) {
      if (req.status >= 200 && req.status < 300) statusSpan.className += ' rm-status-2xx';
      else if (req.status >= 300 && req.status < 400) statusSpan.className += ' rm-status-3xx';
      else statusSpan.className += ' rm-status-4xx';
      statusSpan.textContent = String(req.status);
    } else {
      statusSpan.textContent = '...';
    }
    tdStatus.appendChild(statusSpan);
    tr.appendChild(tdStatus);

    // Type
    const tdType = document.createElement('td');
    tdType.className = 'rm-network-td col-type';
    tdType.textContent = req.resourceType || '-';
    tr.appendChild(tdType);

    // Initiator
    const tdInit = document.createElement('td');
    tdInit.className = 'rm-network-td col-initiator';
    if (req.initiator?.raw) {
      const initLink = document.createElement('button');
      initLink.className = 'rm-link-btn';
      initLink.textContent = req.initiator.raw;
      initLink.title = 'Перейти к источнику в редакторе';
      initLink.addEventListener('click', (ev) => {
        ev.stopPropagation();
        vscode.postMessage({
          type: 'openSource',
          url: req.initiator.file,
          line: req.initiator.line || 1,
          column: req.initiator.col || 1
        });
      });
      tdInit.appendChild(initLink);
    } else {
      tdInit.textContent = '-';
    }
    tr.appendChild(tdInit);

    // Size
    const tdSize = document.createElement('td');
    tdSize.className = 'rm-network-td col-size';
    tdSize.textContent = formatBytes(req.sizeBytes);
    tr.appendChild(tdSize);

    // Time
    const tdTime = document.createElement('td');
    tdTime.className = 'rm-network-td col-time';
    tdTime.textContent = req.durationMs !== undefined ? `${req.durationMs} ms` : '-';
    if (req.durationMs && req.durationMs > 3000) {
      tdTime.style.color = 'var(--vscode-errorForeground)';
      tdTime.style.fontWeight = '600';
    } else if (req.durationMs && req.durationMs > 1000) {
      tdTime.style.color = 'var(--vscode-editorWarning-foreground)';
    }
    tr.appendChild(tdTime);

    // Row click toggles inline details
    tr.addEventListener('click', () => {
      selectedRequestId = selectedRequestId === req.id ? null : req.id;
      if (selectedRequestId && !responseBodyCache.has(req.requestId)) {
        vscode.postMessage({ type: 'getResponseBody', requestId: req.requestId });
      }
      renderNetwork();
    });

    networkTbody.appendChild(tr);

    // If selected, render inline details row
    if (isSelected) {
      const detailsRow = document.createElement('tr');
      detailsRow.className = 'rm-details-row';
      const detailsTd = document.createElement('td');
      detailsTd.colSpan = 7;
      renderRequestDetails(detailsTd, req);
      detailsRow.appendChild(detailsTd);
      networkTbody.appendChild(detailsRow);
    }
  }

  function renderRequestDetails(container, req) {
    const wrap = document.createElement('div');
    wrap.className = 'rm-details-content';

    // Header with sub-tabs & actions
    const header = document.createElement('div');
    header.className = 'rm-details-header';

    const tabsWrap = document.createElement('div');
    tabsWrap.className = 'rm-details-tabs';

    const tabs = [
      { id: 'general', label: 'Общие' },
      { id: 'headers', label: 'Заголовки' },
      { id: 'payload', label: 'Данные запроса', show: Boolean(req.postData) },
      { id: 'response', label: 'Ответ' },
      { id: 'timing', label: 'Время' },
      { id: 'initiator', label: 'Инициатор' }
    ];

    tabs.forEach(t => {
      if (t.show === false) return;
      const btn = document.createElement('button');
      btn.className = `rm-details-tab-btn ${activeDetailsTab === t.id ? 'active' : ''}`;
      btn.textContent = t.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        activeDetailsTab = t.id;
        renderNetwork();
      });
      tabsWrap.appendChild(btn);
    });
    header.appendChild(tabsWrap);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'rm-details-actions';

    const copyUrlBtn = document.createElement('button');
    copyUrlBtn.className = 'rm-btn rm-btn-sm';
    copyUrlBtn.textContent = 'Копировать URL';
    copyUrlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      vscode.postMessage({ type: 'copy', text: req.url });
    });
    actions.appendChild(copyUrlBtn);

    const copyCurlBtn = document.createElement('button');
    copyCurlBtn.className = 'rm-btn rm-btn-sm';
    copyCurlBtn.textContent = 'Копировать cURL';
    copyCurlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const curl = generateCurl(req);
      vscode.postMessage({ type: 'copy', text: curl });
    });
    actions.appendChild(copyCurlBtn);

    const diffBtn = document.createElement('button');
    diffBtn.className = 'rm-btn rm-btn-sm';
    const inDiff = diffSelection.includes(req.id);
    diffBtn.textContent = inDiff ? 'Убрать из сравнения' : 'Сравнить ответ';
    diffBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (inDiff) {
        diffSelection = diffSelection.filter(id => id !== req.id);
      } else {
        if (diffSelection.length >= 2) diffSelection.shift();
        diffSelection.push(req.id);
      }
      renderNetwork();
    });
    actions.appendChild(diffBtn);

    header.appendChild(actions);
    wrap.appendChild(header);

    // Tab body
    const body = document.createElement('div');
    body.className = 'rm-details-body';

    if (activeDetailsTab === 'general') {
      renderGeneralTab(body, req);
    } else if (activeDetailsTab === 'headers') {
      renderHeadersTab(body, req);
    } else if (activeDetailsTab === 'payload') {
      renderPayloadTab(body, req);
    } else if (activeDetailsTab === 'response') {
      renderResponseTab(body, req);
    } else if (activeDetailsTab === 'timing') {
      renderTimingTab(body, req);
    } else if (activeDetailsTab === 'initiator') {
      renderInitiatorTab(body, req);
    }

    wrap.appendChild(body);
    container.appendChild(wrap);
  }

  function renderGeneralTab(container, req) {
    const list = [
      ['Request URL', req.url],
      ['Request Method', req.method],
      ['Status Code', `${req.status || '-'} ${req.statusText || ''}`],
      ['Resource Type', req.resourceType || '-'],
      ['Duration', req.durationMs !== undefined ? `${req.durationMs} ms` : '-'],
      ['Data Length', formatBytes(req.sizeBytes)]
    ];
    renderKeyValuePairs(container, list);
  }

  function renderHeadersTab(container, req) {
    const reqHeaders = Object.entries(req.requestHeaders || {});
    const resHeaders = Object.entries(req.responseHeaders || {});

    const h1 = document.createElement('h4');
    h1.className = 'rm-details-section-title';
    h1.textContent = `Response Headers (${resHeaders.length})`;
    container.appendChild(h1);
    renderKeyValuePairs(container, resHeaders);

    const h2 = document.createElement('h4');
    h2.className = 'rm-details-section-title';
    h2.style.marginTop = '8px';
    h2.textContent = `Request Headers (${reqHeaders.length})`;
    container.appendChild(h2);
    renderKeyValuePairs(container, reqHeaders);
  }

  function renderPayloadTab(container, req) {
    if (!req.postData) {
      container.textContent = 'Данные запроса отсутствуют.';
      return;
    }
    const pre = document.createElement('pre');
    pre.className = 'rm-details-code';
    try {
      const parsed = JSON.parse(req.postData);
      pre.textContent = JSON.stringify(parsed, null, 2);
    } catch {
      pre.textContent = req.postData;
    }
    container.appendChild(pre);
  }

  function renderResponseTab(container, req) {
    const cached = responseBodyCache.get(req.requestId) || (req.responseBody ? { body: req.responseBody } : null);
    if (!cached) {
      container.textContent = 'Загрузка ответа...';
      vscode.postMessage({ type: 'getResponseBody', requestId: req.requestId });
      return;
    }

    const pre = document.createElement('pre');
    pre.className = 'rm-details-code';
    try {
      const parsed = JSON.parse(cached.body);
      pre.textContent = JSON.stringify(parsed, null, 2);
    } catch {
      pre.textContent = cached.body;
    }
    container.appendChild(pre);
  }

  function renderTimingTab(container, req) {
    const list = [
      ['Start Time', new Date(req.startTime * 1000).toLocaleTimeString()],
      ['Duration', req.durationMs !== undefined ? `${req.durationMs} ms` : 'В процессе...']
    ];
    renderKeyValuePairs(container, list);
  }

  function renderInitiatorTab(container, req) {
    if (!req.initiator?.raw) {
      container.textContent = 'Информация об инициаторе отсутствует.';
      return;
    }
    const line = document.createElement('div');
    line.textContent = `Вызвано из: ${req.initiator.raw}`;
    container.appendChild(line);
  }

  function renderKeyValuePairs(container, pairs) {
    if (!pairs || pairs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'rm-empty-subtle';
      empty.textContent = '(пусто)';
      container.appendChild(empty);
      return;
    }
    const dl = document.createElement('dl');
    dl.className = 'rm-dl';
    pairs.forEach(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = String(v);
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    container.appendChild(dl);
  }

  function generateCurl(req) {
    const parts = [`curl -X ${req.method} '${req.url}'`];
    for (const [k, v] of Object.entries(req.requestHeaders || {})) {
      parts.push(`-H '${k}: ${v}'`);
    }
    if (req.postData) {
      const escaped = req.postData.replace(/'/g, "'\\''");
      parts.push(`--data-raw '${escaped}'`);
    }
    return parts.join(' \\\n  ');
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
          if (chkPreserveNetwork) chkPreserveNetwork.checked = preserveLog;
        }
        updateConnectionState(isConnected ? 'connected' : (msg.status || 'waiting'));
        if (msg.requests) {
          msg.requests.forEach(r => networkRequests.set(r.id, r));
          renderNetwork();
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
      case 'networkBatch': {
        if (isRecording && msg.updates) {
          msg.updates.forEach(u => {
            if (u.request) {
              networkRequests.set(u.request.id, u.request);
            }
          });
          renderNetwork();
        }
        break;
      }
      case 'clearNetwork': {
        networkRequests.clear();
        responseBodyCache.clear();
        selectedRequestId = null;
        renderNetwork();
        break;
      }
      case 'responseBody': {
        if (msg.requestId) {
          responseBodyCache.set(msg.requestId, { body: msg.body, base64Encoded: msg.base64Encoded });
          if (selectedRequestId) {
            const currentReq = networkRequests.get(selectedRequestId);
            if (currentReq && currentReq.requestId === msg.requestId) {
              renderNetwork();
            }
          }
        }
        break;
      }
      case 'diffResult': {
        diffDrawer.style.display = 'block';
        diffContent.innerHTML = '';
        if (!msg.diff || msg.diff.length === 0) {
          diffContent.textContent = 'Ответы идентичны (различий нет).';
        } else {
          msg.diff.forEach(d => {
            const line = document.createElement('div');
            line.className = `rm-diff-line ${d.type}`;
            if (d.type === 'added') {
              line.textContent = `+ ${d.path}: ${JSON.stringify(d.newValue)}`;
            } else if (d.type === 'removed') {
              line.textContent = `- ${d.path}: ${JSON.stringify(d.oldValue)}`;
            } else if (d.type === 'modified') {
              line.textContent = `~ ${d.path}: ${JSON.stringify(d.oldValue)} -> ${JSON.stringify(d.newValue)}`;
            }
            diffContent.appendChild(line);
          });
        }
        break;
      }
    }
  });
})();
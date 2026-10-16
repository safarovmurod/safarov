const fs = require('fs');
const path = require('path');

// Global paths for Antigravity IDE on Windows
const os = require('os');
const crypto = require('crypto');
const repairRoot = __dirname;
const deploymentFile = path.join(repairRoot, 'deployment.json');
const deployment = fs.existsSync(deploymentFile) ? JSON.parse(fs.readFileSync(deploymentFile, 'utf8')) : {};
const ideRoot = deployment.ideRoot || path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity IDE');
const workbenchDir = path.join(ideRoot, 'resources', 'app', 'out', 'vs', 'code', 'electron-browser', 'workbench');
const DEFAULT_PATHS = {
  ideRoot,
  packageJson: path.join(ideRoot, 'resources', 'app', 'package.json'),
  workbenchDir,
  workbenchHtml: path.join(workbenchDir, 'workbench.html'),
  jellyScript: path.join(workbenchDir, 'jelly-cursor.js'),
  templateScript: path.join(repairRoot, 'jelly-cursor.template.js'),
  stateFile: path.join(repairRoot, 'jelly-cursor-state.json'),
  userSettings: path.join(deployment.userData || path.join(process.env.APPDATA || '', 'Antigravity IDE'), 'User', 'settings.json'),
};

const MARKER = '<!-- MANSUR_JELLY_CURSOR_PATCH -->';
const LEGACY_START_MARKER = '<!-- jelly-cursor:start -->';
const LEGACY_END_MARKER = '<!-- jelly-cursor:end -->';
const SCRIPT_TAG = '<script src="./jelly-cursor.js"></script>';
const FULL_PATCH = `${MARKER}\n${LEGACY_START_MARKER}${SCRIPT_TAG}${LEGACY_END_MARKER}`;

/**
 * Main repair and inspection logic.
 * @param {object} customPaths - Optional custom paths for testing and isolated verification.
 * @returns {object} Result of the check/repair operation.
 */
function originalCheckAndRepair(customPaths = {}) {
  const paths = { ...DEFAULT_PATHS, ...customPaths };
  const log = [];
  const addLog = (msg) => {
    log.push(msg);
    console.log(`[JellyCursor Repair] ${msg}`);
  };

  addLog('=== Запуск проверки Mouse Click Ripple (Jelly Cursor) ===');

  // 1. Определение текущей версии Antigravity IDE
  let currentVersion = 'unknown';
  if (fs.existsSync(paths.packageJson)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(paths.packageJson, 'utf8'));
      currentVersion = pkg.version || 'unknown';
      addLog(`Текущая версия Antigravity IDE: ${currentVersion}`);
    } catch (err) {
      const errDetail = `Ошибка чтения package.json: ${err.message}`;
      addLog(errDetail);
      return { success: false, reason: errDetail, log };
    }
  } else {
    const errDetail = `Файл package.json не найден по пути: ${paths.packageJson}`;
    addLog(errDetail);
    return { success: false, reason: errDetail, log };
  }

  // 2. Чтение файла состояния (state)
  let state = {
    lastPatchedVersion: null,
    lastCheckTime: null,
    history: []
  };

  if (fs.existsSync(paths.stateFile)) {
    try {
      state = JSON.parse(fs.readFileSync(paths.stateFile, 'utf8'));
      addLog(`Сохранённая в state версия: ${state.lastPatchedVersion || 'отсутствует'}`);
    } catch (e) {
      addLog(`Предупреждение: Не удалось прочитать state-файл, создаётся новый`);
    }
  }

  const isVersionChanged = state.lastPatchedVersion && state.lastPatchedVersion !== currentVersion;
  if (isVersionChanged) {
    addLog(`Обнаружено изменение версии IDE: ${state.lastPatchedVersion} -> ${currentVersion}`);
  }

  // 3. Проверка наличия workbench.html
  if (!fs.existsSync(paths.workbenchHtml)) {
    const errDetail = `Критическая ошибка: workbench.html не найден по пути: ${paths.workbenchHtml}`;
    addLog(errDetail);
    return { success: false, reason: errDetail, log };
  }

  let htmlContent = fs.readFileSync(paths.workbenchHtml, 'utf8');

  // 4. Проверка структуры workbench.html (Safety Check)
  const hasClosingHtmlTag = /<\/html\s*>/i.test(htmlContent);
  if (!hasClosingHtmlTag) {
    const errDetail = `БЕЗОПАСНАЯ ОСТАНОВКА: Структура workbench.html неожиданная (отсутствует закрывающий тег </html>). Файл НЕ изменён во избежание повреждения IDE.`;
    addLog(errDetail);
    return { success: false, reason: errDetail, log };
  }

  // 5. Проверка наличия jelly-cursor.js в папке workbench
  let scriptRestored = false;
  if (!fs.existsSync(paths.jellyScript)) {
    addLog(`jelly-cursor.js отсутствует в ${paths.workbenchDir}. Восстанавливаем из глобального шаблона...`);
    if (fs.existsSync(paths.templateScript)) {
      try {
        fs.copyFileSync(paths.templateScript, paths.jellyScript);
        scriptRestored = true;
        addLog(`jelly-cursor.js успешно восстановлен из шаблона.`);
      } catch (err) {
        const errDetail = `Не удалось скопировать jelly-cursor.js: ${err.message}`;
        addLog(errDetail);
        return { success: false, reason: errDetail, log };
      }
    } else {
      const errDetail = `Критическая ошибка: шаблон jelly-cursor.template.js не найден по пути: ${paths.templateScript}`;
      addLog(errDetail);
      return { success: false, reason: errDetail, log };
    }
  } else {
    addLog(`Файл jelly-cursor.js присутствует на месте.`);
  }

  // 6. Проверка наличия маркера и патча
  const hasMarker = htmlContent.includes(MARKER);
  const hasLegacyPatch = htmlContent.includes(LEGACY_START_MARKER) && htmlContent.includes(LEGACY_END_MARKER);

  let patchApplied = false;
  let backupCreatedPath = null;

  if (hasMarker && hasLegacyPatch) {
    addLog(`Патч уже полностью установлен (маркер и скрипт присутствуют). Никаких изменений не требуется.`);
  } else if (!hasMarker && hasLegacyPatch) {
    // Патч есть, но без уникального маркера Мансура: безопасно нормализуем, не дублируя скрипт
    addLog(`Обнаружен патч без маркера Мансура. Добавляем защитный маркер...`);
    const backupName = `workbench.html.backup-${currentVersion}-${Date.now()}`;
    const backupPath = path.join(path.dirname(paths.workbenchHtml), backupName);
    fs.copyFileSync(paths.workbenchHtml, backupPath);
    backupCreatedPath = backupPath;
    addLog(`Создан безопасный бэкап: ${backupName}`);

    htmlContent = htmlContent.replace(LEGACY_START_MARKER, `${MARKER}\n${LEGACY_START_MARKER}`);
    fs.writeFileSync(paths.workbenchHtml, htmlContent, 'utf8');
    patchApplied = true;
    addLog(`Защитный маркер успешно добавлен.`);
  } else {
    // Патч отсутствует (например после обновления IDE)
    addLog(`Патч отсутствует! Начинается безопасное восстановление...`);

    // ВАЖНО: НИКОГДА НЕ копируем старый бэкап поверх новой версии!
    // Создаём НОВЫЙ бэкап ТЕКУЩЕЙ версии
    const backupName = `workbench.html.backup-${currentVersion}-${Date.now()}`;
    const backupPath = path.join(path.dirname(paths.workbenchHtml), backupName);
    fs.copyFileSync(paths.workbenchHtml, backupPath);
    backupCreatedPath = backupPath;
    addLog(`Создан новый бэкап текущей версии: ${backupName}`);

    // Безопасно вставляем патч ровно один раз перед </html>
    const patchedHtml = htmlContent.replace(/<\/html\s*>/i, `${FULL_PATCH}\n</html>`);
    fs.writeFileSync(paths.workbenchHtml, patchedHtml, 'utf8');
    patchApplied = true;
    addLog(`Патч успешно применён к новому workbench.html ровно 1 раз.`);
  }

  // 7. Проверка глобальных настроек settings.json (rippleEnabled)
  let settingsChecked = false;
  const userSettingsPath = paths.userSettings || path.join(process.env.APPDATA || '', 'Antigravity IDE', 'User', 'settings.json');
  if (fs.existsSync(userSettingsPath)) {
    try {
      const rawSettings = fs.readFileSync(userSettingsPath, 'utf8');
      if (/"jellyCursor\.rippleEnabled"\s*:\s*true/.test(rawSettings)) {
        addLog(`Глобальные настройки: jellyCursor.rippleEnabled = true подтверждено.`);
        settingsChecked = true;
      } else {
        addLog(`Предупреждение: В settings.json jellyCursor.rippleEnabled не равен true.`);
      }
    } catch (e) {
      addLog(`Не удалось проверить settings.json: ${e.message}`);
    }
  }

  // 8. Обновление файла состояния
  state.lastPatchedVersion = currentVersion;
  state.lastCheckTime = new Date().toISOString();
  if (patchApplied || scriptRestored) {
    state.history.push({
      date: new Date().toISOString(),
      version: currentVersion,
      action: patchApplied ? 'PATCHED' : 'RESTORED_SCRIPT',
      backupPath: backupCreatedPath
    });
  }

  try {
    const stateDir = path.dirname(paths.stateFile);
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    fs.writeFileSync(paths.stateFile, JSON.stringify(state, null, 2), 'utf8');
    addLog(`Состояние успешно сохранено в ${paths.stateFile}`);
  } catch (err) {
    addLog(`Предупреждение: Не удалось записать state: ${err.message}`);
  }

  addLog('=== Проверка и восстановление успешно завершены ===');

  return {
    success: true,
    version: currentVersion,
    patchAlreadyPresent: hasMarker && hasLegacyPatch,
    patchApplied,
    backupCreated: backupCreatedPath,
    scriptRestored,
    settingsChecked,
    log
  };
}


function checkAndRepair(customPaths = {}) {
  const paths = { ...DEFAULT_PATHS, ...customPaths };
  const digest = content => crypto.createHash('sha256').update(content).digest('hex');
  let originalHtml, originalScript;
  let pathsReady = false;
  try {
    if (customPaths.ideRoot) {
      paths.packageJson = path.join(paths.ideRoot, 'resources', 'app', 'package.json');
      paths.workbenchDir = path.join(paths.ideRoot, 'resources', 'app', 'out', 'vs', 'code', 'electron-browser', 'workbench');
      paths.workbenchHtml = path.join(paths.workbenchDir, 'workbench.html');
      paths.jellyScript = path.join(paths.workbenchDir, 'jelly-cursor.js');
    }
    const compat = JSON.parse(fs.readFileSync(path.join(repairRoot, 'compatibility.json'), 'utf8'));
    const product = JSON.parse(fs.readFileSync(path.join(paths.ideRoot, 'resources', 'app', 'product.json'), 'utf8'));
    if (product.commit !== compat.commit || product.applicationName !== 'antigravity-ide') throw new Error('Unknown IDE build: automatic repair refused');
    originalHtml = fs.readFileSync(paths.workbenchHtml);
    originalScript = fs.existsSync(paths.jellyScript) ? fs.readFileSync(paths.jellyScript) : null;
    const html = originalHtml.toString('utf8');
    const clean = html.replace(/\s*<!-- MANSUR_JELLY_CURSOR_PATCH -->\s*<!-- jelly-cursor:start -->[\s\S]*?<!-- jelly-cursor:end -->\s*/g, '\n').trim();
    if (digest(clean) !== compat.cleanWorkbenchNormalizedSha256) throw new Error('Unknown workbench content: automatic repair refused');
    if ((html.match(/<script[^>]*src=["']\.\/jelly-cursor\.js["']/g) || []).length > 1) throw new Error('Duplicate injection requires review');
    const template = fs.readFileSync(paths.templateScript);
    if (digest(template) !== compat.jellySha256) throw new Error('Repair template checksum mismatch');
    if (originalScript && digest(originalScript) === compat.jellySha256 && html.includes(FULL_PATCH)) return {success:true, patchAlreadyPresent:true, action:'SKIP'};
    pathsReady = true;
    const backupDir = path.join(repairRoot, 'backup', String(Date.now()));
    fs.mkdirSync(backupDir, {recursive:true});
    fs.writeFileSync(path.join(backupDir, 'workbench.html'), originalHtml);
    if (originalScript) fs.writeFileSync(path.join(backupDir, 'jelly-cursor.js'), originalScript);
    fs.writeFileSync(paths.jellyScript, template);
    const result = originalCheckAndRepair(paths);
    const after = fs.readFileSync(paths.workbenchHtml, 'utf8');
    if (!result.success || (after.match(/MANSUR_JELLY_CURSOR_PATCH/g)||[]).length !== 1 || (after.match(/<script[^>]*src=["']\.\/jelly-cursor\.js["']/g)||[]).length !== 1 || digest(fs.readFileSync(paths.jellyScript)) !== compat.jellySha256) throw new Error('Post-repair verification failed');
    return result;
  } catch (error) {
    if (pathsReady) {
      fs.writeFileSync(paths.workbenchHtml, originalHtml);
      if (originalScript) fs.writeFileSync(paths.jellyScript, originalScript);
      else if (fs.existsSync(paths.jellyScript)) fs.unlinkSync(paths.jellyScript);
    }
    console.error('[JellyCursor Repair] ' + error.message);
    return {success:false, reason:error.message};
  }
}

if (require.main === module) {
  const res = checkAndRepair();
  process.exit(res.success ? 0 : 1);
}

module.exports = { checkAndRepair, DEFAULT_PATHS, MARKER, FULL_PATCH };

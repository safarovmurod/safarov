const vscode = require('vscode');

// Timers exactly as requested
const TAILWIND_DELAY_MS = 5000;
const CRUD_DELAY_MS = 15000;

let pendingRequestId = 0;

/**
 * Check if the cursor is inside a Tailwind className / class string
 */
function getTailwindContext(lineText, charPos) {
  const prefix = lineText.substring(0, charPos);

  // Checks className="..." or class="..." or className={`...`}
  const classMatch = prefix.match(/(?:className|class)\s*=\s*(?:["']([^"']*)|{`([^\`]*)`?)/);
  if (!classMatch) return null;

  const quoteChar = prefix.includes('className={`') ? '`' : (prefix.includes('className="') || prefix.includes('class="') ? '"' : "'");
  const currentClasses = (classMatch[1] !== undefined ? classMatch[1] : classMatch[2]) || '';

  return {
    quoteChar,
    currentClasses: currentClasses.trim(),
    endsInSpace: currentClasses.length === 0 || currentClasses.endsWith(' ')
  };
}

/**
 * Suggest only continuation Tailwind utility classes
 */
function getTailwindSuggestion(twCtx) {
  const cur = twCtx.currentClasses.toLowerCase();
  const sep = twCtx.endsInSpace ? '' : ' ';

  if (!cur) {
    return 'flex items-center justify-between';
  }
  if (cur.endsWith('flex') || cur.endsWith('grid')) {
    return sep + 'items-center justify-between gap-4';
  }
  if (cur.endsWith('text') || cur.endsWith('font')) {
    return sep + 'text-gray-900 dark:text-white font-medium';
  }
  if (cur.endsWith('bg') || cur.endsWith('dark:bg')) {
    return sep + 'bg-white dark:bg-gray-800 rounded-lg shadow-sm';
  }
  if (cur.endsWith('border')) {
    return sep + 'border-gray-200 dark:border-gray-700 rounded-md';
  }
  if (cur.endsWith('w') || cur.endsWith('h') || cur.endsWith('p') || cur.endsWith('m')) {
    return sep + 'w-full p-4';
  }
  if (cur.endsWith('hover') || cur.endsWith('btn') || cur.endsWith('button')) {
    return sep + 'hover:bg-blue-700 transition duration-200';
  }

  // Common continuation for container styles
  return sep + 'items-center gap-2';
}

/**
 * Check if cursor is in CRUD / State context (Redux, Zustand, Jotai)
 */
function getCrudContext(document, position) {
  const lineText = document.lineAt(position.line).text;
  const prefix = lineText.substring(0, position.character).trim();

  // Read surrounding 20 lines to detect store type
  const startLine = Math.max(0, position.line - 20);
  const surroundingText = document.getText(
    new vscode.Range(new vscode.Position(startLine, 0), position)
  );

  const isRedux = /createSlice|createAsyncThunk|extraReducers|dataRedux/i.test(surroundingText);
  const isZustand = /create\s*\(|useZustand|create<|zustand/i.test(surroundingText);
  const isJotai = /atom\s*\(|useAtom|useSetAtom|Jotai/i.test(surroundingText);

  // Match triggers
  return {
    prefix,
    lineText,
    isRedux,
    isZustand,
    isJotai
  };
}

/**
 * Suggest exact logic continuation matching Mansur's requested architecture
 */
function getCrudSuggestion(crudCtx) {
  const p = crudCtx.prefix;

  // ===== 1. REDUX TOOLKIT GLOBAL API (createAsyncThunk) =====
  if (p.includes('getUsers') || p === 'export const getUsers =') {
    if (p.includes('createAsyncThunk')) return ' "users/getUsers", async () => {\n  const { data } = await api.get("/users?limit=8&select=firstName,lastName,image,role");\n  return data.users;\n});';
    return 'createAsyncThunk("users/getUsers", async () => {\n  const { data } = await api.get("/users?limit=8&select=firstName,lastName,image,role");\n  return data.users;\n});';
  }
  if (p.includes('getUserInfo') || p === 'export const getUserInfo =') {
    if (p.includes('createAsyncThunk')) return ' "users/getUserInfo", async (id: number) => {\n  const { data } = await api.get("/users/" + id);\n  return data;\n});';
    return 'createAsyncThunk("users/getUserInfo", async (id: number) => {\n  const { data } = await api.get("/users/" + id);\n  return data;\n});';
  }
  if (p.includes('addUser') && (crudCtx.isRedux || p.includes('createAsyncThunk') || p.includes('thunk'))) {
    if (p.includes('createAsyncThunk')) return ' "users/addUser", async (newUser: NewUser) => {\n  const { data } = await api.post("/users/add", newUser);\n  return data;\n});';
    return 'createAsyncThunk("users/addUser", async (newUser: NewUser) => {\n  const { data } = await api.post("/users/add", newUser);\n  return data;\n});';
  }
  if (p.includes('putUser') && (crudCtx.isRedux || p.includes('createAsyncThunk'))) {
    if (p.includes('createAsyncThunk')) return ' "users/putUser", async (user: User) => {\n  const { data } = await api.put("/users/" + user.id, user);\n  return data;\n});';
    return 'createAsyncThunk("users/putUser", async (user: User) => {\n  const { data } = await api.put("/users/" + user.id, user);\n  return data;\n});';
  }
  if (p.includes('patchRole') && (crudCtx.isRedux || p.includes('createAsyncThunk'))) {
    if (p.includes('createAsyncThunk')) return ' "users/patchRole", async (item: PatchArg) => {\n  const { data } = await api.patch("/users/" + item.id, { role: item.role });\n  return data;\n});';
    return 'createAsyncThunk("users/patchRole", async (item: PatchArg) => {\n  const { data } = await api.patch("/users/" + item.id, { role: item.role });\n  return data;\n});';
  }
  if (p.includes('deleteUser') && (crudCtx.isRedux || p.includes('createAsyncThunk'))) {
    if (p.includes('createAsyncThunk')) return ' "users/deleteUser", async (id: number) => {\n  await api.delete("/users/" + id);\n  return id;\n});';
    return 'createAsyncThunk("users/deleteUser", async (id: number) => {\n  await api.delete("/users/" + id);\n  return id;\n});';
  }

  // Redux Reducer Updates
  if (p.endsWith('state.users =') || p.endsWith('state.users=')) {
    return ' action.payload;';
  }
  if (p.endsWith('state.info =') || p.endsWith('state.info=')) {
    return ' action.payload;';
  }
  if (p.endsWith('state.users.push(')) {
    return 'action.payload);';
  }

  // ===== 2. ZUSTAND GLOBAL API =====
  if (p.includes('getUsers:') || p === 'getUsers') {
    return ' async () => {\n  set({ loading: true, error: "" });\n\n  try {\n    const { data } = await api.get("/users?limit=8&select=firstName,lastName,image,role");\n\n    set({\n      users: data.users,\n      loading: false\n    });\n  } catch {\n    set({\n      error: "GET нашуд. Internet ё link-ро тафтиш кун",\n      loading: false,\n    });\n  }\n},';
  }
  if (p.includes('getUserInfo:') || p === 'getUserInfo') {
    return ' async (id) => {\n  const { data } = await api.get("/users/" + id);\n\n  set({\n    info: data\n  });\n},';
  }
  if (p.includes('closeInfo:') || p === 'closeInfo') {
    return ' () => set({\n  info: null\n}),';
  }
  if (p.includes('addUser:') && crudCtx.isZustand) {
    return ' async (newUser) => {\n  const { data } = await api.post("/users/add", newUser);\n\n  set((state) => ({\n    users: [...state.users, data],\n  }));\n},';
  }
  if (p.includes('putUser:') && crudCtx.isZustand) {
    return ' async (user) => {\n  const { data } = await api.put("/users/" + user.id, user);\n\n  set((state) => ({\n    users: state.users.map((el) =>\n      el.id === data.id ? data : el\n    ),\n  }));\n},';
  }
  if (p.includes('patchRole:') && crudCtx.isZustand) {
    return ' async (id) => {\n  const user = get().users.find((el) => el.id === id);\n\n  if (!user) return;\n\n  const newRole =\n    user.role === "admin"\n      ? "user"\n      : "admin";\n\n  const { data } = await api.patch(\n    "/users/" + id,\n    {\n      role: newRole\n    }\n  );\n\n  set((state) => ({\n    users: state.users.map((el) =>\n      el.id === id\n        ? {\n            ...el,\n            role: data.role\n          }\n        : el\n    ),\n  }));\n},';
  }
  if (p.includes('deleteUser:') && crudCtx.isZustand) {
    return ' async (id) => {\n  await api.delete("/users/" + id);\n\n  set((state) => ({\n    users: state.users.filter(\n      (el) => el.id !== id\n    ),\n  }));\n},';
  }

  // ===== 3. JOTAI LOCAL ATOMS =====
  if (p.includes('showInfoAtom') || p === 'export const showInfoAtom =') {
    return ' atom(null, (get, set, id: number) => {\n  const found =\n    get(tasksAtom).find((el) => el.id === id) || null;\n\n  set(infoAtom, found);\n});';
  }
  if (p.includes('addTaskAtom') || p === 'export const addTaskAtom =') {
    return ' atom(null, (get, set, task: Task) => {\n  set(tasksAtom, [...get(tasksAtom), task]);\n});';
  }
  if (p.includes('editTaskAtom') || p === 'export const editTaskAtom =') {
    return ' atom(null, (get, set, task: Task) => {\n  set(\n    tasksAtom,\n    get(tasksAtom).map((el) =>\n      el.id === task.id ? task : el\n    )\n  );\n});';
  }
  if (p.includes('toggleStatusAtom') || p === 'export const toggleStatusAtom =') {
    return ' atom(null, (get, set, id: number) => {\n  set(\n    tasksAtom,\n    get(tasksAtom).map((el) =>\n      el.id === id\n        ? {\n            ...el,\n            status:\n              el.status === "нав"\n                ? "тайёр"\n                : "нав",\n          }\n        : el\n    )\n  );\n});';
  }
  if (p.includes('deleteTaskAtom') || p === 'export const deleteTaskAtom =') {
    return ' atom(null, (get, set, id: number) => {\n  set(\n    tasksAtom,\n    get(tasksAtom).filter(\n      (el) => el.id !== id\n    )\n  );\n});';
  }

  // ===== 4. JOTAI GLOBAL API ATOMS =====
  if (p.includes('getUsersAtom') || p === 'export const getUsersAtom =') {
    return ' atom(null, async (_get, set) => {\n  set(loadingAtom, true);\n  set(errorAtom, "");\n\n  try {\n    const { data } = await api.get(\n      "/users?limit=8&select=firstName,lastName,image,role"\n    );\n\n    set(usersAtom, data.users);\n  } catch {\n    set(\n      errorAtom,\n      "GET нашуд. Internet ё link-ро тафтиш кун"\n    );\n  }\n\n  set(loadingAtom, false);\n});';
  }
  if (p.includes('getUserInfoAtom') || p === 'export const getUserInfoAtom =') {
    return ' atom(\n  null,\n  async (_get, set, id: number) => {\n    const { data } = await api.get(\n      "/users/" + id\n    );\n\n    set(infoAtom, data);\n  }\n);';
  }
  if (p.includes('addUserAtom') || p === 'export const addUserAtom =') {
    return ' atom(\n  null,\n  async (get, set, newUser: NewUser) => {\n    const { data } = await api.post(\n      "/users/add",\n      newUser\n    );\n\n    set(\n      usersAtom,\n      [...get(usersAtom), data]\n    );\n  }\n);';
  }
  if (p.includes('putUserAtom') || p === 'export const putUserAtom =') {
    return ' atom(\n  null,\n  async (get, set, user: User) => {\n    const { data } = await api.put(\n      "/users/" + user.id,\n      user\n    );\n\n    set(\n      usersAtom,\n      get(usersAtom).map((el) =>\n        el.id === data.id ? data : el\n      )\n    );\n  }\n);';
  }
  if (p.includes('patchRoleAtom') || p === 'export const patchRoleAtom =') {
    return ' atom(\n  null,\n  async (get, set, id: number) => {\n    const user = get(usersAtom).find(\n      (el) => el.id === id\n    );\n\n    if (!user) return;\n\n    const newRole =\n      user.role === "admin"\n        ? "user"\n        : "admin";\n\n    const { data } = await api.patch(\n      "/users/" + id,\n      {\n        role: newRole\n      }\n    );\n\n    set(\n      usersAtom,\n      get(usersAtom).map((el) =>\n        el.id === id\n          ? {\n              ...el,\n              role: data.role\n            }\n          : el\n      )\n    );\n  }\n);';
  }
  if (p.includes('deleteUserAtom') || p === 'export const deleteUserAtom =') {
    return ' atom(\n  null,\n  async (get, set, id: number) => {\n    await api.delete("/users/" + id);\n\n    set(\n      usersAtom,\n      get(usersAtom).filter(\n        (el) => el.id !== id\n      )\n    );\n  }\n);';
  }

  // ===== 5. PRESERVE EXISTING LOCAL CRUD (Zustand & Redux local) =====
  if (p.endsWith('DeleteZ: (id) =>') || p.endsWith('deleteUserZ: (id) =>') || p.endsWith('DeleteUserZ: (id) =>')) {
    return ' set((state) => ({\n    dataZ: state.dataZ.filter((el) => el.id != id)\n  })),';
  }
  if (p.endsWith('AddUserZ: (user) =>') || p.endsWith('addUserZ: (user) =>')) {
    return ' set((state) => ({\n    dataZ: [user, ...state.dataZ]\n  })),';
  }
  if (p.endsWith('EditUserZ: (user) =>') || p.endsWith('updateUserZ: (user) =>')) {
    return ' set((state) => ({\n    dataZ: state.dataZ.map((el) => el.id == user.id ? user : el)\n  })),';
  }

  return null;
}

function activate(context) {
  const provider = {
    async provideInlineCompletionItems(document, position, context, token) {
      const currentReq = ++pendingRequestId;
      const docVersion = document.version;
      const lineText = document.lineAt(position.line).text;

      // 1. Detect Context
      const twCtx = getTailwindContext(lineText, position.character);
      const crudCtx = twCtx ? null : getCrudContext(document, position);

      // If not in Tailwind or CRUD trigger, do not suggest
      if (!twCtx && (!crudCtx || !getCrudSuggestion(crudCtx))) {
        return [];
      }

      // 2. Select exact timer: 5000ms for Tailwind, 15000ms for CRUD
      const delayMs = twCtx ? TAILWIND_DELAY_MS : CRUD_DELAY_MS;

      // 3. Debounce timer with CancellationToken
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, delayMs);
        token.onCancellationRequested(() => {
          clearTimeout(timer);
          resolve();
        });
      });

      // 4. Validate before showing suggestion
      if (token.isCancellationRequested) return [];
      if (currentReq !== pendingRequestId) return [];
      if (document.version !== docVersion) return [];

      // 5. Build inline ghost text suggestion
      let insertText = '';
      if (twCtx) {
        insertText = getTailwindSuggestion(twCtx);
      } else if (crudCtx) {
        insertText = getCrudSuggestion(crudCtx);
      }

      if (!insertText) return [];

      const item = new vscode.InlineCompletionItem(insertText);
      item.range = new vscode.Range(position, position);
      return [item];
    }
  };

  const selectors = [
    { language: 'typescript' },
    { language: 'typescriptreact' }
  ];

  selectors.forEach(selector => {
    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider(selector, provider)
    );
  });

  // Safe auto-check on startup for Jelly Cursor
  setTimeout(function() {
    try {
      const repair = require(require('path').join(require('os').homedir(), '.antigravity', 'jelly-cursor', 'checkAndRepairJellyCursor.js'));
      if (repair && typeof repair.checkAndRepair === 'function') repair.checkAndRepair({ ideRoot: require('path').resolve(vscode.env.appRoot, '..', '..') });
    } catch (e) {}
  }, 2000);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};

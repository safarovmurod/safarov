---
trigger: always_on
---
## Strict User Request Scope and Zero Unauthorized Changes
- **Strict Scope Principle**:
  - Any code modification must strictly correspond to the explicit request of the user.
  - When the user says: «исправь здесь», «исправь вот это», «измени эту часть», «сделай здесь так», «поменяй только это», «исправь ошибку тут», «добавь это сюда» — modify ONLY the explicitly indicated section.
  - If the user indicated a specific file, function, line, component, block, query, handler, import, JSX element, store, atom, reducer, action, or API method: modify ONLY that exact target and only to the minimal extent necessary to fulfill the request. Everything else is strictly READ-ONLY.
  - The user's request forms the strict boundary of the task. Never interpret "do X" as "do X + Y + Z because it is better".

- **Absolute Prohibition of Unsolicited Changes (Zero Scope Creep)**:
  - STRICTLY FORBIDDEN without direct user instruction:
    - Refactoring surrounding or neighboring code;
    - Rewriting working logic or redesigning project architecture/structure;
    - Renaming variables, functions, or files;
    - Creating, deleting, moving, merging, or splitting files;
    - Changing APIs, URLs, stores, or state;
    - Adding, modifying, or extending TypeScript types, interfaces, generics, enums, schemas, or DTOs;
    - Adding validation, fallbacks, helper functions, utilities, or custom hooks;
    - Adding dependencies, installing/removing packages, modifying package.json, tsconfig.json, ESLint, or Prettier configs;
    - Changing router or state manager;
    - Modifying CSS, design, styles, or polishing UI without explicit request;
    - Changing naming conventions, optimizing code, altering async flow, or changing error handling;
    - Adding unrequested loading, try/catch, console.log, comments (//, /* */), JSDoc, TODO, NOTE, or FIXME;
    - Reformatting entire files, reordering imports, changing quotes, semicolons, or spacing;
    - Fixing neighboring bugs, warnings, or lint issues outside the requested target;
    - Performing any "while I'm here" ("заодно полезные") modifications.
  - Best practices, modern standards, cleaner code patterns, or optimizations are recommendations only — they NEVER grant permission to modify unrequested code.

- **No "Я заодно исправил" Rule**:
  - Never fix unrequested issues. The principle "Я заметил ещё одну проблему и тоже исправил её" is strictly prohibited.
  - If an unrelated bug, warning, or problem is discovered during work, DO NOT TOUCH IT in code. You may only briefly mention it at the very end of your response:
    "Обнаружил дополнительную проблему в X, но не менял её, потому что она не входила в запрос."

- **Ask Before Any Additional Change**:
  - If fulfilling a request genuinely requires an additional change outside the user's explicit scope, STOP and ask permission first.
  - Ask strictly in this concise format:
    "Для этого дополнительно нужно изменить X. Разрешаешь? Да / Нет."
  - Until the user explicitly replies "Да", DO NOT make the change. If the user replies "Нет", leave it untouched.
  - If the requested change can be completed within the specified scope without extra edits, DO NOT ask any questions — simply execute the exact request.

- **File Permission Rule**:
  - A file is authorized for edits ONLY if at least one condition is met:
    1. The user explicitly named this file;
    2. The user explicitly pointed to code in this file;
    3. The direct request is technically impossible to compile/execute without a minimal edit to this file.
  - For cascade dependencies (condition 3) that were not obvious from the user's request: ask permission first before editing:
    "Для запрошенного изменения необходимо дополнительно затронуть: 1. X — причина. Разрешаешь? Да / Нет."
  - Reading or inspecting a file for context does NOT grant permission to edit it (Reading ≠ Editing permission).

- **Strict Scope Keywords Interpretation**:
  - Phrases like «только», «только здесь», «только это», «больше ничего», «остальное не трогай», «логику не меняй», «дизайн не трогай», «импорты только исправь», «эту функцию исправь» constitute a HARD scope boundary. This boundary overrides all agent desires to refactor, improve, or apply best practices.
  - «Исправь это» / «Здесь ошибка»: find the exact issue in the pointed section, understand current logic, fix only that problem, stop. All other code is READ-ONLY.
  - «Логику не трогай»: existing behavior must remain identical.
  - «Только дизайн»: do not touch state, API, or business logic.
  - «Только логику»: do not touch CSS, design, or layout.
  - «Только imports»: touch nothing outside the specific required import statement.
  - «Так же сделай здесь»: replicate only the relevant pattern without refactoring surrounding code.
  - Active Manager Isolation: when working on Zustand, touch only Zustand (leave Redux/Jotai alone). When working on Redux, touch only Redux. When working on Jotai, touch only Jotai. Never auto-sync or touch multiple state managers simultaneously unless requested.

- **Minimal Diff and Style Preservation**:
  - Every change must aim for the smallest possible diff: 1 line fix = 1 line changed (do not rewrite the function); 1 function fix = 1 function changed (do not rewrite the file); 1 file fix = 1 file changed (do not touch other files).
  - Existing business logic is assumed correct by default. Do not replace working code with "a better way" unless explicitly told to redesign it.
  - Preserve the user's exact coding style, naming, patterns, line endings, indentation, and quotes.
  - Imports: edit only if explicitly requested or strictly required to compile the requested fix. Never sort, clean up, or touch unrelated imports.
  - Never write speculative code "for the future" (no unrequested wrappers, helpers, abstractions, utilities, or feature flags).

- **Hard Stop and Pre/Post-Edit Diff Verification**:
  - Pre-edit check: "Is this change directly required by the user's explicit request?" If NO or UNCERTAIN -> DO NOT TOUCH (ask if necessary). If YES -> perform the minimal edit.
  - Post-edit check: inspect the diff of every modified line. Every single modified line must have the justification: "Required for the direct user request." If any line was modified due to auto-formatting, prettier, accidental refactor, renamed variable, or unrequested comments/types -> REVERT IT immediately.

- **Strict Priority Hierarchy**:
  1. Explicit current user request.
  2. Explicit user scope restrictions («только», «не трогай», «логику не меняй»).
  3. Global user rules.
  4. Project GEMINI.md / project rules.
  5. Existing project architecture.
  6. Best practices and recommendations (never override user constraints).

- **Prohibition of Unrequested System/Shell Actions**:
  - Never execute unrequested actions: npm install/uninstall, package upgrades, git commit/push, branch creation, cache wiping, destructive shell commands, migrations, database modifications, or .env modifications without explicit user instruction.

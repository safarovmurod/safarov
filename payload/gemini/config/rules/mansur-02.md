---
trigger: always_on
---
## Analyze, verify, explain, fix
- Use ANALYZE → VERIFY → EXPLAIN → FIX. Simple questions need short answers; page changes need related files; architecture and ZIP tasks need the overall structure.
- For complex tasks: 1. Analyze → 2. Understand connections → 3. Implement → 4. Verify → 5. Final result. Do not jump erratically between steps.
- Inspect reasonably related files first (imports, exports, store, components, types) before modifying code, without reading the entire project unnecessarily.
- Separate confirmed errors, confirmed causes, hypotheses and optional recommendations. Do not declare nested map, index keys, data.data, spaces in filenames, Number(id) or navigation state erroneous without evidence.
- For errors: find real cause first → file/location → why it happened → smallest fix → verified result. Mark unknown causes. Do not repeat failed fixes without evidence. Acknowledge your own errors.
- Preserve working code/settings. Logic-only preserves design; design-only preserves logic; analysis-only means no edits.
- Use understandable task commands/known scripts; no unknown downloaded scripts. Windows + Git Bash: run npm in the project folder. Back up configuration and warn before bulk overwrites.
- Safety first: Before deleting important files, mass modifying project files, altering IDE configuration, or running destructive shell commands, verify safety and necessity. Never perform destructive operations based on guesses.
- Run relevant existing lint, type-check and build scripts when application code changes. Report failures honestly. Settings-only checks do not prove an application build passes.

## Stack, files and TypeScript
- New application work: React + TypeScript + Vite + Tailwind; React Router when routing is needed; Axios for API tasks unless the project already has an appropriate fetch approach. Do not install unused packages.
- Check installed packages before adding any new dependency: if a task can be accomplished with already installed tools, do not install a new library.
- Use native HTML elements inside React TSX and simple Tailwind className strings. Do not use MUI components, imports, sx, examples or design recommendations.
- Components and files containing JSX syntax use `.tsx`. Stores, slices, types, data and non-JSX logic use `.ts`. Do not generate application `.jsx`/`.js` or avoid a type error by switching to JavaScript. Tool-required configuration filenames retain supported extensions.
- **TypeScript Only Rule (Строгий режим стека)**:
  - Все новые файлы и новый код проекта создавать ТОЛЬКО в TypeScript:
    - `.tsx` — для любых React-компонентов и файлов с JSX-разметкой.
    - `.ts` — для store, atom, slice, API, types, utils, config-логики без JSX.
  - СТРОГО ЗАПРЕЩЕНО создавать новые `.js` и `.jsx` файлы или предлагать их как альтернативу.
  - Существующие `.js/.jsx` файлы проекта автоматически НЕ удалять и НЕ конвертировать. Если они обнаружены — только сообщить о них в отчёте. Менять или удалять `.js/.jsx` разрешено только по прямому запросу пользователя.
- Convert only explicitly included projects; inspect references and preserve behavior. Resolve references before removing obsolete dependencies.
- Use simple types/interfaces from real data, inference and import type. No `any`, `@ts-ignore`, weakened checks or unjustified assertions to hide errors.
- Necessary `PayloadAction<number>`, `useState<User | null>` and form-event types are allowed. Explain unfamiliar types; keep real ID types consistent.
- Use Redux Toolkit, Zustand, or Jotai only where chosen or requested. Do not add Next.js, React Query, Framer Motion or another framework without a task-related request.

## Design and browser verification
- First inspect all reference sections, layout, spacing, typography, colors, borders and images; then recheck against the project, assets, Tailwind and style.
- Implement native TSX + Tailwind, connect the component/page, render in the browser, compare with the reference and fix confirmed differences. Repeat the relevant checks until resolved or report a concrete blocker. Do not claim visual matching without viewing the result.
- No invented sections, effects, API or image URLs. Prefer local assets; keep filenames. Ask for missing assets/placeholder permission and mobile references when needed.
- Label estimated screenshot dimensions/fonts honestly; describe visual fixes by file/component/property.
- Distinguish missing routes from application crashes. Use appropriate route error UI and separate 404 routes when the router/task supports it; do not add a router solely for this. Route error handling does not catch every event-handler or asynchronous error.
- External repositories are references: inspect relevant README, files and licenses; do not claim the first repository is the intended one or copy complex architecture into a simple project.

## Teaching mode and step-by-step logic
- When explaining code, focus on LOGIC with simple intuitive analogies (e.g., "И atom маълумота дар хдш медора" instead of complex theoretical definitions).
- Break explanations into sequential step-by-step points:
  1. Клик кардӣ.
  2. id-ра гирифт.
  3. function вызов шуд.
  4. axios запрос кард.
  5. data омад.
  6. state update шуд.
  7. React UI-ра нав кард.
- If user asks "чиба?" (why?): do NOT start with a lecture. State the concrete cause immediately first (e.g. "Ича import неправильныйай"), then briefly show where and how to fix it.
- Teach one practical step per message: file, location, code, explanation, result, then wait. Continue after "шд". Do not send five files/full CRUD at once.
- New topics: problem → idea → logic → code → before/after walkthrough. Give hints, simpler everyday examples if needed, relevant mistakes and a small exercise.
- Use a short 3–5 sentence "ЗАПИШИ В ТЕТРАДЬ" note only for a new topic. Ordinary debugging/settings replies do not need it.

## Antigravity IDE and performance
- For Antigravity configuration tasks: analyze existing settings first. Do not create duplicate scripts, extensions, or rules.
- Maintain global customizations at user-level (`~/.gemini/config/`) so they apply across all workspaces and survive restarts. Project-specific rules belong in the workspace.
- Favor event-driven approaches over background watchers, periodic polling, or unnecessary timers. Customizations and hooks must never degrade typing performance in the editor.

## Global Style and Structure Preservation Rule
Перед любым изменением кода сначала анализируй style и structure существующего кода. Не переименовывай без необходимости мои variable, function, component, store, slice и atom. Не переписывай мою architecture только потому, что другой вариант считается более стандартным. Исправляй ошибки внутри моей существующей логики. Используй TypeScript/TSX, если project работает на этом stack.


# Antigravity Portable Setup — evidence report

**Artifact status:** configuration replication implemented and tested; full requested universal completion is **NOT certified**. The runtime gate intentionally prevents `100% COMPLETE` while required observations remain unverified.

## SOURCE ANALYSIS

The current default **Antigravity IDE** installation was selected using the desktop shortcut, uninstall registry, product metadata, default profile associations and current extension registry. The separate Antigravity hub installation was not treated as the editor. No IDE process was running at initial audit. Historical activation logs are evidence of that session, not proof of all current behavior.

- IDE: **2.5.5**; Core: **1.107.0**; build: `ecfbad74d93962fc8ca485d93ab9b4f3d4cb6cf8`; Electron package metadata: **39.2.3**.
- Source installation resolver: `%LOCALAPPDATA%\Programs\Antigravity IDE`.
- Source user data: `%APPDATA%\Antigravity IDE`; extensions: `%USERPROFILE%\.antigravity-ide\extensions`.
- Settings: **208**; keybindings: **15**; extensions: **24**, comprising **20 public + 4 custom**.
- Default profile; no named profiles exported. No snippets found in the active snippets directory.
- Gemini: `GEMINI.md`, `config/rules/mansur.md`, one `mansur-practice` skill. The full source rule text is preserved exactly in three parts below the per-file limit, referenced from global/legacy entrypoints; the original text is retained in the payload.
- Theme: **Dark+** (built-in); icons: **Material Icon Theme 5.38.1**.
- Font chain: JetBrains Mono → Fira Code → Consolas → monospace. Editor **15px**, terminal **14px**, ligatures enabled. Included: 16 JetBrains Mono + 6 Fira Code TTF faces; variable and NL variants are not needed by this chain.
- Protected effect: current 33,421-byte Jelly/Ripple script, exact SHA256; cursor width 1, smooth blinking/caret and current disabled trail/spark/rainbow preserved.
- Native TypeScript relative import behavior, inline suggestions, watcher/search exclusions and source autocomplete activation preserved.
- Disabled `google.antigravity` state is migrated through an allowlisted SQLite key; 36 separately allowlisted UI state keys restore panel locations, pinned/hidden views and sizes. No source database is shipped.
- Discovered machine dependencies: hardcoded repair require in autocomplete; hardcoded browser Program Files paths in Runtime Monitor; source-specific repair constants; startup repair invoked by the autocomplete extension; Russian locale in argv.json.
- No custom startup task/Run entry found for Jelly/Antigravity. No old disabled extension folders, nested duplicate copies, extension backup code or source logs are shipped.
- All 20 public extension payloads match their current installed files and the official exact-version VSIX contents (package installation metadata excluded). The 11 product checksum entries matched the source product manifest; this does not prove an unmodified vendor installation because the product manifest itself is local. The custom workbench patch is explicitly known.

## MISSING FROM OLD SETUP

Current settings absent from its payload: `inlineChat.holdToSpeech`, `accessibility.voice.autoSynthesize`, `accessibility.voice.keywordActivation`, `accessibility.voice.speechTimeout`, `accessibility.signals.voiceRecordingStarted`, `accessibility.signals.voiceRecordingStopped`, `files.watcherExclude`, `search.exclude`.
The old inline autocomplete runtime differed from the current TypeScript-only runtime. Its current source selectors and timers are preserved. Other three custom entrypoint files matched the old payload, but old nested copies and stale repair scripts are excluded.

## OLD SETUP PROBLEMS

Confirmed by reading its scripts and current payload (not inferred from a failed EXE):
- Forced `Stop-Process -Force` even though skip/dry-run parameters existed.
- Reported the editor check as OK when it merely selected a default path; no official IDE installation/update engine.
- Wrote settings wholesale, changed autosave delay based on hardware, and replaced target shortcuts instead of merging.
- Reinstalled four removed public IDs: `formulahendry.auto-close-tag`, `skyran.js-jsx-snippets`, `aaron-bond.better-comments`, `steoates.autoimport`.
- Ignored public extension CLI exit codes and checked mostly file/folder existence; success did not prove actual working extensions.
- Copied a directory into an existing directory in a way consistent with the nested duplicate Runtime Monitor/Reviewer directories present on source.
- Its `Get-ChildItem -Path <directory> -Include ... -File` selection returned **0 files** although its script payload directory contained **8 files**; therefore that loop did not migrate repair files as intended.
- Source-specific user paths in repair/autocomplete payload; no hash-based compatibility matrix, no comprehensive rollback, no dependency/font installation verification.
- Used process-level ExecutionPolicy Bypass; the new launcher does not.
- No previous custom EXE or Inno build project was found in the bounded Desktop setup search. The exact failure of a historical EXE is **unverified**, not claimed as diagnosed.

## DOWNLOAD SOURCES

Each downloadable artifact was actually fetched over HTTPS. IDE and Git Authenticode signatures were Valid (Google LLC and Johannes Schindelin). Node ZIP matched the official SHASUMS256 entry. Public VSIX identity/version were checked and source runtime bytes compared. Fonts were byte-compared to official pinned release archives. TLS verification was not disabled.

### pkief.material-icon-theme
- Official page: https://open-vsx.org/extension/pkief/material-icon-theme
- Resolved source: https://open-vsx.org/api/PKief/material-icon-theme/5.38.1/file/PKief.material-icon-theme-5.38.1.vsix
- Version: `5.38.1`; publisher: pkief.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `fa7515831a2d68b1f78bd02de40f96260bfe74efb03a238c2bde70265e04b696`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### christian-kohler.npm-intellisense
- Official page: https://open-vsx.org/extension/christian-kohler/npm-intellisense
- Resolved source: https://open-vsx.org/api/christian-kohler/npm-intellisense/1.4.5/file/christian-kohler.npm-intellisense-1.4.5.vsix
- Version: `1.4.5`; publisher: christian-kohler.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `962b851a7cafbd51f34afeb4a0b91e985caff3947e46218a12b448533d8f60ab`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### christian-kohler.path-intellisense
- Official page: https://open-vsx.org/extension/christian-kohler/path-intellisense
- Resolved source: https://open-vsx.org/api/christian-kohler/path-intellisense/2.8.0/file/christian-kohler.path-intellisense-2.8.0.vsix
- Version: `2.8.0`; publisher: christian-kohler.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `a856e4436f4d9b4b03d581ec10f826fe79eeb6cb34f5eb9d5b013fd817aeb940`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### ms-ceintl.vscode-language-pack-ru
- Official page: https://open-vsx.org/extension/ms-ceintl/vscode-language-pack-ru
- Resolved source: https://open-vsx.org/api/MS-CEINTL/vscode-language-pack-ru/1.106.0/file/MS-CEINTL.vscode-language-pack-ru-1.106.0.vsix
- Version: `1.106.0`; publisher: ms-ceintl.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `e3b48fbba9d609a21d8d1216067d3496d6b8a29eeb40e8ac43ab9b9a4436fcae`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### edwinhuish.better-comments-next
- Official page: https://open-vsx.org/extension/edwinhuish/better-comments-next
- Resolved source: https://open-vsx.org/api/edwinhuish/better-comments-next/3.5.2/file/edwinhuish.better-comments-next-3.5.2.vsix
- Version: `3.5.2`; publisher: edwinhuish.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `996338cbefc99a683b57406dd346d92d72e21a172fad32f5fec1d22109d9091f`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### usernamehw.errorlens
- Official page: https://open-vsx.org/extension/usernamehw/errorlens
- Resolved source: https://open-vsx.org/api/usernamehw/errorlens/3.28.0/file/usernamehw.errorlens-3.28.0.vsix
- Version: `3.28.0`; publisher: usernamehw.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `10ab65469dd21cab7b177e9fc97ad7e85604b75c9ca140e5e8bdd9fc23f7119d`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### dbaeumer.vscode-eslint
- Official page: https://open-vsx.org/extension/dbaeumer/vscode-eslint
- Resolved source: https://open-vsx.org/api/dbaeumer/vscode-eslint/3.0.34/file/dbaeumer.vscode-eslint-3.0.34.vsix
- Version: `3.0.34`; publisher: dbaeumer.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `ca5334d46f6a39079e751ef4601bfc9f86bc3a46483e87291ec609239d161308`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### Node.js
- Official page: https://nodejs.org/en/download
- Resolved source: https://nodejs.org/dist/v24.18.0/node-v24.18.0-win-x64.zip
- Version: `v24.18.0`; publisher: OpenJS Foundation.
- Install method: User-local ZIP + user PATH.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `0ae68406b42d7725661da979b1403ec9926da205c6770827f33aac9d8f26e821`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### anteprimorac.html-end-tag-labels
- Official page: https://open-vsx.org/extension/anteprimorac/html-end-tag-labels
- Resolved source: https://open-vsx.org/api/anteprimorac/html-end-tag-labels/1.0.0/file/anteprimorac.html-end-tag-labels-1.0.0.vsix
- Version: `1.0.0`; publisher: anteprimorac.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `12be18c9907104fcf8f66c2f737d46003924b00760b27caea6b16597c54bedeb`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### esbenp.prettier-vscode
- Official page: https://open-vsx.org/extension/esbenp/prettier-vscode
- Resolved source: https://open-vsx.org/api/esbenp/prettier-vscode/12.4.0/file/esbenp.prettier-vscode-12.4.0.vsix
- Version: `12.4.0`; publisher: esbenp.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `fb730ea4306d09cdc0a3aaa9e9baae28058cc97a4fbfce8b056b377a0639a9fe`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### formulahendry.code-runner
- Official page: https://open-vsx.org/extension/formulahendry/code-runner
- Resolved source: https://open-vsx.org/api/formulahendry/code-runner/0.12.2/file/formulahendry.code-runner-0.12.2.vsix
- Version: `0.12.2`; publisher: formulahendry.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `99246afaaff6bedec962976ea2cdd07e70ddd58b840666fdcf67fe21e3513dbe`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### formulahendry.auto-rename-tag
- Official page: https://open-vsx.org/extension/formulahendry/auto-rename-tag
- Resolved source: https://open-vsx.org/api/formulahendry/auto-rename-tag/0.1.10/file/formulahendry.auto-rename-tag-0.1.10.vsix
- Version: `0.1.10`; publisher: formulahendry.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `7c94f9a7971a1fbb4f74969597612e8a20e871283c930bfa54f333386c86d4d3`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### bradgashler.htmltagwrap
- Official page: https://open-vsx.org/extension/bradgashler/htmltagwrap
- Resolved source: https://open-vsx.org/api/bradgashler/htmltagwrap/1.0.0/file/bradgashler.htmltagwrap-1.0.0.vsix
- Version: `1.0.0`; publisher: bradgashler.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `06ddf42b305cab0ee4eb4aa10c3c0c8a726ffa48b235d66181ce329c590b04e8`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### rangav.vscode-thunder-client
- Official page: https://open-vsx.org/extension/rangav/vscode-thunder-client
- Resolved source: https://open-vsx.org/api/rangav/vscode-thunder-client/2.41.3/file/rangav.vscode-thunder-client-2.41.3.vsix
- Version: `2.41.3`; publisher: rangav.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `6e094213b816f666805afd6905b497293b6d7660742b4c3f568b6895c52b907f`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### bradlc.vscode-tailwindcss
- Official page: https://open-vsx.org/extension/bradlc/vscode-tailwindcss
- Resolved source: https://open-vsx.org/api/bradlc/vscode-tailwindcss/0.16.0/file/bradlc.vscode-tailwindcss-0.16.0.vsix
- Version: `0.16.0`; publisher: bradlc.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `3fd7ceb8b20a88d1df01c3c95f240e7b3db14fd66b8f003c1d686790608d1942`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### kisstkondoros.vscode-gutter-preview
- Official page: https://open-vsx.org/extension/kisstkondoros/vscode-gutter-preview
- Resolved source: https://open-vsx.org/api/kisstkondoros/vscode-gutter-preview/0.32.2/file/kisstkondoros.vscode-gutter-preview-0.32.2.vsix
- Version: `0.32.2`; publisher: kisstkondoros.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `f293062abed1214dfe8ab03c37770e942ac9901ccc4e045711fe460472e22d94`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### glenn2223.live-sass
- Official page: https://open-vsx.org/extension/glenn2223/live-sass
- Resolved source: https://open-vsx.org/api/glenn2223/live-sass/6.1.5/file/glenn2223.live-sass-6.1.5.vsix
- Version: `6.1.5`; publisher: glenn2223.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `2d26557d99fb3f740e949383e614843af0d039cb386ed5c7b74624cbf288c3f1`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### dsznajder.es7-react-js-snippets
- Official page: https://open-vsx.org/extension/dsznajder/es7-react-js-snippets
- Resolved source: https://open-vsx.org/api/dsznajder/es7-react-js-snippets/4.4.3/file/dsznajder.es7-react-js-snippets-4.4.3.vsix
- Version: `4.4.3`; publisher: dsznajder.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `4b727b2573f28dd4356dda726fac58e6028f6619cdb6015a294f4624fc4ffe3f`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### streetsidesoftware.code-spell-checker
- Official page: https://open-vsx.org/extension/streetsidesoftware/code-spell-checker
- Resolved source: https://open-vsx.org/api/streetsidesoftware/code-spell-checker/4.9.3/file/streetsidesoftware.code-spell-checker-4.9.3.vsix
- Version: `4.9.3`; publisher: streetsidesoftware.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `f0c7d778614278a8716b767f6084b3eb437a66618744975edd7ff2e08e93a2dc`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### ritwickdey.liveserver
- Official page: https://open-vsx.org/extension/ritwickdey/liveserver
- Resolved source: https://open-vsx.org/api/ritwickdey/LiveServer/5.7.10/file/ritwickdey.LiveServer-5.7.10.vsix
- Version: `5.7.10`; publisher: ritwickdey.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `0f8ef819d4c2007f1bfb3b8efb533e72796e29f06fee600c76d1fb17befb5b95`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### Antigravity IDE
- Official page: https://antigravity.google/download
- Resolved source: https://edgedl.me.gvt1.com/edgedl/release2/j0qc3/antigravity/stable/2.5.5-4923483625488384/windows-x64/Antigravity%20IDE.exe
- Version: `2.5.5`; publisher: Google LLC.
- Install method: Signed official Inno Setup /CURRENTUSER /VERYSILENT /NORESTART.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `a8c25631fd5e43bf217a6cf510ca796441817f4ad9c50b1d892282c7366edc4a`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### wix.vscode-import-cost
- Official page: https://open-vsx.org/extension/wix/vscode-import-cost
- Resolved source: https://open-vsx.org/api/wix/vscode-import-cost/3.3.0/file/wix.vscode-import-cost-3.3.0.vsix
- Version: `3.3.0`; publisher: wix.
- Install method: Antigravity IDE CLI exact VSIX.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `c36d455b8e04d31f1423a5641e3a718cb7da67be8144182ce839f61b4fd46a0c`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### Git for Windows
- Official page: https://gitforwindows.org/
- Resolved source: https://github.com/git-for-windows/git/releases/download/v2.55.0.windows.5/Git-2.55.0.5-64-bit.exe
- Version: `2.55.0.windows.5`; publisher: Git for Windows.
- Install method: Signed official Inno Setup /CURRENTUSER /VERYSILENT /NORESTART.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `d065a4e23c3d9a6b5073d609b5be0830227ec3ca053c083ba385061ddfaf94c6`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### JetBrainsMono
- Official page: https://github.com/JetBrains/JetBrainsMono
- Resolved source: https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip
- Version: `v2.304`; publisher: JetBrains.
- Install method: Exact validated extracted fonts; per-user registration.
- Offline fallback: verified bundled extracted TTF faces.
- SHA-256: `6f6376c6ed2960ea8a963cd7387ec9d76e3f629125bc33d1fdcd7eb7012f7bbf` (official release archive; individual TTF hashes are in fonts-manifest.json).
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### FiraCode
- Official page: https://github.com/tonsky/FiraCode
- Resolved source: https://github.com/tonsky/FiraCode/releases/download/6.2/Fira_Code_v6.2.zip
- Version: `6.2`; publisher: tonsky.
- Install method: Exact validated extracted fonts; per-user registration.
- Offline fallback: verified bundled extracted TTF faces.
- SHA-256: `0949915ba8eb24d89fd93d10a7ff623f42830d7c5ffc3ecbf960e4ecad3e3e79` (official release archive; individual TTF hashes are in fonts-manifest.json).
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

### Chrome for Testing
- Official page: https://github.com/GoogleChromeLabs/chrome-for-testing
- Resolved source: https://storage.googleapis.com/chrome-for-testing-public/153.0.8010.52/win64/chrome-win64.zip
- Version: `153.0.8010.52`; publisher: Google LLC.
- Install method: Official HTTPS portable ZIP, exact SHA256; existing browser preferred.
- Offline fallback: verified bundled exact artifact.
- SHA-256: `df4854428c509fcf2f790ac448bca3f994151bcff22008236fa7c4587294fbe1`.
- Verified: **PASS** for retrieval/integrity/version; this is not an assertion of a fresh-PC installation test.

## LOCAL PAYLOAD

- Runtime Monitor 1.1.0: source runtime/dependencies/media; browser paths made dynamic with an official portable-browser fallback.
- AI Structure Reviewer 1.1.0: source runtime and TypeScript dependency; no logic refactor.
- Mansur Inline Autocomplete 1.0.0: current TypeScript/TSX provider and 5,000/15,000ms logic; only repair module path made portable.
- Jelly Cursor 0.0.8: current installed extension; exact workbench effect bytes.
- Source rules, current settings/keybindings, 36 UI layout keys, selected font faces, repair logic with version/hash guards.
- Offline MCP runtime: 113 npm packages pinned by package-lock integrity from registry.npmjs.org; install scripts were not run. Exact runtime file hashes are in mcp-runtime-manifest.json. Browser ZIP and executable are SHA256-pinned to the official Chrome for Testing release; that upstream executable is unsigned, explicitly recorded rather than misreported as signed.
- Temporary verification development extension: used only for automatic tests, never installed as an additional permanent user extension.

## ANTIGRAVITY UPDATE

Source and pinned target are 2.5.5. Resolver selects the recorded compatible official Google artifact, not arbitrary latest. Compatible installed build is skipped. Missing IDE is installed per-user with the signed official installer. An older IDE is retained while a separate per-user build is staged. A newer unknown build is stopped before patching. CLI/version/commit/workbench are validated. Actual vendor installation/update on a fresh/old disposable Windows VM was **SKIPPED**.

## FIXED

Safe path discovery; pinned official artifacts; runtime-resolved paths; JSONC-aware settings merge; keybinding conflict merge; isolated CLI extension staging; checksum-verified extraction fallback; exact registry rebuild with unrelated target entries preserved; no duplicate managed extension versions; source disabled state; per-user fonts; transaction journals; interrupted transaction recovery; bounded downloader retry; corrupted cache replacement; idempotent patch and compatible auto-restore; honest nonzero exit for incomplete verification.
PowerShell 5.1 array conversion and downloader return-value bugs found in development were fixed and retested. Long-path directory backup/copy/rollback uses Node filesystem APIs with containment/reparse checks. No source project was refactored.

## TARGET ADAPTATION

Windows/build/architecture, CPU/RAM, drive/free space, user/environment paths, PowerShell/policy, proxy, editor process/registry/PATH/shortcuts, Node/Git, standard profile files, fonts and workbench. All package paths are relative. Known machine-specific setting paths are reconstructed at runtime. Low RAM does not disable effects or change source visual preferences. Custom target user-data/profile switches are not universally inferred after an IDE process is closed; named profiles are rejected for review.

## TEST RESULTS

**111 automated assertions passed; 0 failed in the final recorded suites.** These are not 111 separate Windows machines or complete UI workflows.

| Suite | Passed | Evidence |
|---|---:|---|
| extras-test-results.json | 6 | `manifests/test-results.json` |
| failure-test-results.json | 4 | `manifests/test-results.json` |
| final-gate-test-results.json | 1 | `manifests/test-results.json` |
| full-config-test-results.json | 47 | `manifests/test-results.json` |
| installer-test-results.json | 12 | `manifests/test-results.json` |
| packaged-host-results.json | 23 | `manifests/test-results.json` |
| rules-test-results.json | 2 | `manifests/test-results.json` |
| runtime-test-results.json | 7 | `manifests/test-results.json` |
| static-test-results.json | 5 | `manifests/test-results.json` |
| ui-state-test-results.json | 4 | `manifests/test-results.json` |

Key evidence: real IDE executable started with an isolated temporary test profile and installed target extensions. All four custom extensions activated; native TS service, TS/TSX documents and commands passed. Real renderer DOM verified one Jelly layer, a Ripple circle that animates and disappears, dark theme, font size and icon stylesheet. The installed Runtime Monitor coordinator used real VS Code services, connected to a loopback fixture, recorded console/network events, refreshed, reused one browser session and cleared/disconnected. The target UI/storage database stayed unchanged by these probes. Both bundled MCP servers initialized, listed tools and executed real tool calls; Chrome MCP also launched a real browser. Missing-browser fallback and MCP rerun were exercised in an isolated target. This does not certify every Monitor panel action, navigation-generation edge case or structure auto-fix scenario.

## REPAIR TESTS

PASS: lost patch/effect restored on a compatible build; repeat repair leaves correct patch unchanged; unknown build rejected before write; corrupted template rejected; missing payload/wrong SHA blocked; real HTTPS cache reused; corrupted cache downloaded/reverified; intentionally wrong download SHA stopped after three attempts without publishing a bad artifact.

## ROLLBACK TEST

**PASS** for configuration files, newly created files, extension directory tree and interrupted journal recovery in isolated fixtures. **SKIPPED** for vendor installer rollback, real installed-font session rollback and an entire fresh-PC OS snapshot. Vendor side effects are explicitly outside the configuration rollback guarantee.

## PORTABILITY

PASS: alternate user root, paths with spaces, Unicode folder, long extension file paths, custom IDE root in a filesystem fixture, PowerShell 5.1, offline artifact selection. Windows 10/ARM64/non-C boot drive/low-RAM hardware are not physically tested. ARM64/x86 and unknown builds fail closed. No administrator request, no drive-letter rewrite of Windows itself.

## SECURITY

The final package contains allowlisted configuration/runtime artifacts and verified vendor distributions. Source user-data databases, passwords, OAuth credentials, session state, account files, MCP header values, cookies, conversations and source logs are excluded. Exact-value credential scanning is performed before ZIP creation; its result is recorded in security-scan.json. Secrets in an existing target database stay on the target and may be in its local rollback backup; that backup is never shipped.
Defender, SmartScreen, UAC, antivirus, Windows DPI and execution policy are untouched. No security bypass or automatic Unblock-File. TLS verification stays enabled. Official signed installers are checked before execution. Source Workspace Trust settings are preserved. Only a generated empty test workspace uses a temporary test-process trust flag; no target trust configuration or user workspace is modified.

## UNRESOLVED

- **SKIPPED — Fresh Windows vendor installer execution:** No disposable second Windows machine/VM available; source installation was not replaced.
- **SKIPPED — Older IDE vendor update and complete vendor rollback:** No disposable old-version target. Prior binary directories are retained, but vendor registry/uninstall changes are not transactionally restored.
- **SKIPPED — Windows 10, ARM64, genuinely non-C system drive, low-RAM hardware:** Only Windows 11 x64 host available. Unicode/long filesystem paths were tested. ARM64/x86 are deliberately rejected.
- **SKIPPED — Authenticated Gemini rule consumption:** No account/session copied; file presence and frontmatter are not proof of prompt injection. Original rule text is now split losslessly into three referenced parts below the documented 12000-character limit; authenticated consumption remains unverified.
- **SKIPPED — Every display/DPI and every panel interaction:** Real renderer Ripple/theme/font/icon checks and installed Runtime Monitor coordinator tests passed on this host; other physical displays and every panel interaction remain untested.
- **SKIPPED — Target font registration installation:** Official bytes validated; target registry font installation was not executed against the source account.
- **SKIPPED — GitHub MCP authorization:** Both credential-free MCP servers passed actual initialize/list/tool calls. GitHub requires a target credential and was not authorized by copying source secrets.
- **PowerShell policy:** double-click execution cannot be guaranteed under Restricted/AllSigned/MOTW without an approved signed distribution. The scripts stop rather than weakening policy.
- **Global rules:** the source global rule exceeded the documented per-file limit and its legacy copy logged invalid frontmatter. The package preserves the original text across three valid referenced parts. Tests prove size and lossless preservation; authenticated model consumption is still unverified. See https://antigravity.google/docs/rules-workflows .
- **Autocomplete concurrency:** stale results and cancellation passed. The unchanged source provider does not itself guarantee only one live timer if the editor fails to cancel older tokens; that stronger resource claim is not certified.
- **UI layout/preferences stored outside settings:** 36 inspected, allowlisted layout keys are migrated and tested, including custom Runtime Console and AI Reviewer containers. Other opaque account/session storage is not cloned.
- **Final status by design:** SETUP and VERIFY remain INCOMPLETE/nonzero when target account authorization and authenticated rule consumption are unavailable, even after file and activation checks pass. No claim of full task completion is made.

## FINAL FILE

`Antigravity-Portable-Setup.zip` — one output archive. No legacy EXE setup, duplicate final ZIP, personal backups or source logs.

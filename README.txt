ANTIGRAVITY PORTABLE SETUP

INSTALL
1. Extract the whole ZIP.
2. Save your work and close Antigravity IDE.
3. Double click SETUP.cmd.
4. Keep the terminal open until the final status.

VERIFY (read-only)
Double click VERIFY.cmd.

DIAGNOSTICS (read-only)
Double click DIAGNOSTICS.cmd.

SUPPORTED PROFILE
Windows x64, Windows 10 build 19041+ / Windows 11, user-writable installation,
Default IDE profile, Antigravity IDE 2.5.5 / Core 1.107.0 / audited commit.
Existing Chrome/Edge is reused. If absent, bundled official Chrome for Testing is installed automatically in a per-user dependency folder.
Only Windows 11 x64 was executed in this development session.
Node 24.18.0, Git 2.55.0.windows.5 and all public extension VSIX files are bundled.
No internet is required to read the included payload. Publisher trust validation
can still require Windows certificate infrastructure.

STATUS - PLEASE READ
This is a tested configuration-replication package, NOT a certified universal
one-click 100% COMPLETE installer. Automated tests passed on this host, but the
full specification has unresolved checks. Read REPORT.md before transferring.

SETUP intentionally ends with INSTALLATION INCOMPLETE / exit 2 when configuration
and local runtime probes pass but target account authorization and authenticated
Gemini rule consumption remain unverified. Visual and Runtime Monitor probes run automatically.
There is no fake success flag and no switch to bypass required checks.

Windows security policy is never changed. If Restricted/AllSigned or downloaded
file policy blocks these unsigned PowerShell scripts, installation stops. This
package cannot promise two-click execution on such a computer without an
approved signed distribution. It does not bypass policy or automatically unblock.

No accounts, cookies, OAuth sessions, tokens, source workspaces or conversations
are included. Sign in on the target yourself. Existing target MCP credentials
remain untouched. Chrome DevTools and Sequential Thinking MCP runtimes are bundled,
configured and tested automatically; GitHub has a separate disabled credential template.

Existing target settings are merged and unrelated keys are preserved. The source
profile wins conflicting settings/keybindings. Backup metadata is in backup\.
Rerunning repairs an interrupted configuration transaction before applying again.
An open IDE is never force-closed. Close it yourself and rerun.

Unknown newer IDE builds are not downgraded or blindly patched. An older IDE is
kept on disk while a pinned official per-user build is installed separately.
Vendor installers may update shortcut/uninstall registration; those external
changes are NOT covered by the file/extension/font-registry rollback engine.

Source custom extension logic is preserved. Only source-specific path literals
and repair compatibility/integrity safeguards were adapted. Browser lookup also supports
the portable fallback. Ripple bytes are exact. 36 allowlisted UI layout keys are restored.
The complete original rules are split into three referenced parts without losing text.
Future unknown IDE updates require a new compatibility audit before auto-repair.

Details: REPORT.md; manifests\test-results.json; manifests\sources-manifest.json.
Exit codes: 0 all required checks passed; 1 failure; 2 required observation/action pending.

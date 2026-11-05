# Switch Console (Windows) — Remote-Host Onboarding & Agent-Session Blockers

**Reporter:** Jayanth Malladi (solo, Flip the Switch hackathon)
**Project:** `JayanthMalladi/shim-desk` — two Claude Code agents + a Mattermost room on a local Switch server
**Console:** Switch Console **v0.40.1** (Windows x64 `.exe`, from `sandbox-quantum/switch` releases)
**Date:** 2026-11-06 (UTC)
**Severity:** Both blockers fully block the project's demo path on Windows + WSL2; local execution is disabled in this build.
**Related open issues:** `sandbox-quantum/switch#1472` (agent socket not found), `#1511` (template form offers no provider on an agent-management server)

> **Live status (as of writing):** Blocker 1's broken `SSH_AUTH_SOCK` registry value is being repaired by the operator in parallel; the next "Add host" attempt may surface a *further* error (agent-pipe reachability / empty service agent) — results will be appended to §4.6.

---

## 1. TL;DR

On **Windows 11 + Switch Console v0.40.1**, a Windows machine cannot execute agent sessions locally ("no provider is set up" / "SDK sessions require a POSIX SSH execution event"), so the standard workaround is to run the agents on a **remote host**. We use **WSL2 Ubuntu on the same machine** (POSIX, node + claude + gh present, sshd reachable, key auth verified from Windows CLI).

Two independent blockers then prevent progress:

| # | Where | Symptom | Cause (assessment) |
|---|---|---|---|
| **1** | Console → Settings → Remote hosts → **Add host** (`wsl-switch`) | `Could not add the host. (Cannot reach wsl-switch: Invalid cygwin unix socket path)` | Console's host-probe authenticates via the **Windows OpenSSH agent** and reads `SSH_AUTH_SOCK`. With the var unset it reports "SSH agent socket not found" (#1472). With a **mangled value** (`\.\pipe\openssh-ssh-agent`, single backslash) it reports **"Invalid cygwin unix socket path"**. The validation is too strict / the error is misleading, and there is no key-file-only fallback. |
| **2** | Room `~shim-desk` (Mattermost), agent `shim-lead.jayanth` (Run location = `wsl-switch`) | `!agents-status` → `shim-lead.jayanth: Connecting…`; agent never answers `@shim` | Host-side session never comes live. WSL-side evidence: `claude` (as root) is **not signed in**, workspace `/mnt/d/shim-desk` **not trusted**, and no Switch sidecar/controller process was found on the host. Unclear which step Console is waiting on — no host-side log surfaced in the UI. |

Both need Switch-side fixes or documentation to proceed; neither is fixable purely on the user's side given the "no provider locally" constraint.

---

## 2. Environment (verified facts)

### 2.1 Windows host

| Item | Value |
|---|---|
| OS | Windows 11, build `10.0.26200.9711` |
| Switch Console | `switch-console-v0.40.1` (`switch-console-x64.exe`), installed from GitHub releases |
| Local server | Docker Desktop `29.9.2` (linux containers); container `switchdash-local-mattermost-mattermost-1` (`mattermost/mattermost-team-edition:11.9.0`) — **Up (healthy)** |
| git | `2.55.0.windows.5` |
| node (Windows) | `v22.15.0` |
| gh (Windows) | `2.103.3`, authenticated as `JayanthMalladi` (scopes: repo, …) via keyring + `gh auth setup-git` |
| OpenSSH agent service | **Running** (session 0); `ssh-agent.exe` visible in `tasklist` |
| WSL | `WSL 3.0.3x`, distro `Ubuntu` (VERSION 2, State **Running**) |

### 2.2 WSL2 Ubuntu (the "host")

| Item | Value |
|---|---|
| IP | `172.18.66.224` (NAT; **changes on WSL restart**) |
| sshd | `openssh-server` installed by us, listening `0.0.0.0:22` (root) |
| Auth | Windows key `C:\Users\Jayanth\.ssh\id_ed25519` present in `/root/.ssh/authorized_keys` (1 line) |
| node | `v22.22.1` |
| git | `2.53.0` |
| claude | `2.1.318` at `/usr/local/bin/claude` — **NOT signed in as root** (see §5) |
| gh | `2.103.3` at `/usr/local/bin/gh` — **NOT authenticated** |
| Working dirs | `/mnt/d/shim-desk`, `/mnt/d/shim-demo-app` visible (WSL↔Windows interop OK) |

### 2.3 Windows SSH alias (`C:\Users\Jayanth\.ssh\config`)

```
Host wsl-switch
    HostName 172.18.66.224
    User root
    IdentityFile /c/Users/Jayanth/.ssh/id_ed25519
    StrictHostKeyChecking accept-new
```

No `IdentityAgent`, no `ProxyCommand` — pure key-file auth.

### 2.4 Registry state (root cause evidence, Blocker 1)

```
HKEY_CURRENT_USER\Environment
    SSH_AUTH_SOCK    REG_SZ    \.\pipe\openssh-ssh-agent
```

⚠️ The value is **mangled**: single backslash `\.\pipe\...`. The correct Windows named-pipe form is **`\\.\pipe\openssh-ssh-agent`** (double backslash). It was set by `setx` from Git Bash / PowerShell, where escaping ate one backslash. `SSH_AUTH_SOCK` does **not** exist in the machine (HKLM) environment.

---

## 3. What we are building (why this setup)

Two Switch agents run the `shim-desk` workflow in a Mattermost room on a **local Switch server**:

- `shim-lead.jayanth` — provider **Claude Code**, model `claude-opus-5-5`, dir `/mnt/d/shim-desk`, auto mode on, bypass off
- `shim-reviewer.jayanth` — provider **Claude Code**, model `claude-sonnet-5-5`, same dir, read-only (disallowed Edit/Write/NotebookEdit)

On the Windows Console, the "power your agents" step **cannot select Claude Code locally**: the provider shows "no provider is set up" and hovering the disabled control says **"SDK sessions require a POSIX SSH execution event."** Consistent with the docs ("Run a Switch server or an agent on a machine other than your own… Linux (Ubuntu) or macOS. **Not Windows**: there's no install path" — that refers to the *agent host* requirement), local agent execution is not available in this Windows build, so agents must run on a remote (POSIX) host. WSL2 is the natural same-machine POSIX host.

---

## 4. Blocker 1 — "Cannot reach wsl-switch: Invalid cygwin unix socket path"

### 4.1 Exact reproduction

1. Windows OpenSSH agent service is **running**.
2. `~/.ssh/config` contains the `wsl-switch` alias above; `ssh wsl-switch` works from Git Bash/PowerShell via **key file only** (BatchMode, no agent):
   ```
   $ ssh -o BatchMode=yes wsl-switch 'echo OK $(node -v)'
   OK v22.22.1        # (key-file auth, no agent involved)
   ```
3. In Switch Console v0.40.1: **Settings → Remote hosts → Add host**, SSH host = `wsl-switch` (or `root@172.18.66.224`), Display name = `wsl` → **Check/Save**.
4. Result:
   ```
   Could not add the host. (Cannot reach wsl-switch: Invalid cygwin unix socket path)
   ```

### 4.2 Error variants observed across the two states

| State of `SSH_AUTH_SOCK` (HKCU user env) | Console "Add host" result |
|---|---|
| **Not set at all** (fresh machine, agent service running) | `SSH agent socket not found for connection '<host>'` — matches open issue #1472 |
| **Set to mangled value** `\.\pipe\openssh-ssh-agent` (single backslash, as in §2.4) | `Cannot reach wsl-switch: Invalid cygwin unix socket path` |
| **Set to correct value** `\\.\pipe\openssh-ssh-agent` | *Not yet successfully tested* — the value had never been storable correctly through `setx`/PowerShell escaping until this report; under repair (see §4.6) |

Key observation for the maintainers: **the error message *changes* with the variable's value.** That proves Console is reading `SSH_AUTH_SOCK` from the process environment (consistent with #1472's finding that `resolveUserEnv()` just never *populates* it on `win32` — but doesn't strip a user-supplied value). The validation then rejects the mangled value with a **cygwin**-flavored error even on a native Windows GUI app — i.e. the pipe-name check is either (a) too strict about the exact `\\.\pipe\` prefix, or (b) the value arrives with backslashes collapsed somewhere in the env/PATH conversion, or (c) the code path assumes a cygwin/MSYS2-style socket (`/tmp/…` or `\\.\pipe\` after a cygpath translation) and rejects any single-backslash form as "cygwin unix".

### 4.3 Evidence package

```text
# 1. Windows CLI ssh to the alias — WORKS (key-file, no agent):
ssh -o BatchMode=yes wsl-switch 'echo OK $(node -v)'
→ OK v22.22.1

# 2. Agent pipe from a user-session process:
$env:SSH_AUTH_SOCK = '\\.\pipe\openssh-ssh-agent'; ssh-add -l
→ (from Git Bash / spawned shells: "Error connecting to agent: No such file or
   directory" — UNRELIABLE probes, likely a service-pipe (session 0) vs
   user-session reachability problem; see 4.4)

# 3. Registry value at time of failure (HKCU\Environment):
SSH_AUTH_SOCK = "\.\pipe\openssh-ssh-agent"        (REG_SZ — note single backslash)

# 4. ~/.ssh/config: no IdentityAgent / SSH_AUTH_SOCK / ProxyCommand entries
#    for wsl-switch (pure IdentityFile).
```

### 4.4 Root-cause analysis (operator's assessment — needs maintainer confirmation)

1. **Primary:** Console's host-reachability probe authenticates SSH using the **OpenSSH agent** (reads `IdentityAgent`/`SSH_AUTH_SOCK`), and on `win32` it never derives the agent pipe by itself (#1472: `resolveUserExec()/resolveUserEnv()` returns early on win32, `detectSshAuthSock()` is not called). So the user must hand it a value.
2. **Secondary:** the value check is brittle. The correct value for the Windows agent *service* is `\\.\pipe\openssh-ssh-agent` (or `Global\openssh-ssh-agent`). Any escaping loss (a single backslash, `/`-translated form, cygwin-style `/tmp/...`) produces **"Invalid cygwin unix socket path"** — which is misleading on Windows and gives no hint about the expected format.
3. **Tertiary (unconfirmed):** even with the correctly-formatted value, the **service** agent pipe may be unreachable from a normal user session (session-0 pipe semantics), and the service agent had **no keys loaded** (`ssh-add` against it failed in our probes). Net effect: the "Add host" probe may still fail, now for a reachability/empty-agent reason, with *yet another* unclear error.
4. **Fundamental design gap:** there is no "use key file only, no agent" path. On a machine where `ssh <alias>` demonstrably works with `IdentityFile` (BatchMode, exit 0), Console's inability to add that host means the host check is stricter than the actual auth requirements.

### 4.5 What we would like

- **Fix on win32:** in the env resolution, call `detectSshAuthSock()` / default to `\\.\pipe\openssh-ssh-agent` when `SSH_AUTH_SOCK` is unset (#1472 suggested fix).
- **Normalize + diagnose:** accept `\\.\pipe\X`, `Global\X`, and cygwin/MSYS2 socket forms; on rejection, print the *actual value read* and the expected format, e.g. `SSH_AUTH_SOCK="\.\pipe\openssh-ssh-agent" is not a valid agent socket path on Windows (expected "\\\\.\\pipe\<name>")`.
- **Offer key-file-only host check:** if agent auth is unavailable/fails, fall back to `ssh -o BatchMode=yes -F <user config> <host> 'echo switch-probe-ok'` using the user's `~/.ssh/config` — which already works here — or at minimum show which auth method failed.
- **First-class WSL detection:** a same-machine WSL distro is the most common POSIX host a Windows user has; a "Use this machine's WSL" onboarding path (via `wsl` interop: `\\wsl$\Ubuntu`, `/mnt/<drive>` for directories) would remove the NAT-IP-changes-on-restart problem entirely (§6).
- **Source pointer:** please confirm which component emits `Invalid cygwin unix socket path` (grep the literal; suspected Go ssh-agent dial/validation path) so we can cross-link.

### 4.6 Live status / next data points (append)

- [ ] `SSH_AUTH_SOCK` repaired to `\\.\pipe\openssh-ssh-agent` in HKCU; Console fully quit + reopened.
- [ ] Result of the next "Add host" attempt (expected: success, *or* a new, more informative failure — record the exact text here).
- [ ] `ssh-add -l` under the correct value from the GUI session: key count (service agent had none loaded; a user-session `ssh-agent -s` prints its own pipe, e.g. `\\.\pipe\sshagent.exe.<pid>.<n>`, which is loadable and should also be accepted — verify Console accepts non-service pipes).
- [ ] If still failing: capture Console logs (location?) + host-side probes.

---

## 5. Blocker 2 — agent session stuck at "Connecting…" on the WSL host

### 5.1 Exact state

- Host `wsl-switch` was eventually added (agent 1 created manually — via the agent form, not the template, because of #1511's missing-provider symptom on this server which has agent management on).
- Agent: `shim-lead.jayanth`, provider **Claude Code**, model `claude-opus-5-5`, run location **wsl-switch**, directory **`/mnt/d/shim-desk`**, auto mode **on**, bypass **off**, "Me and my agents".
- Room: `shim-desk` (Mattermost, bundled local server), alias `@shim`, `!assign-agent` done.
- Observed: in the room, `!agents-status` →
  ```
  shim-lead.jayanth: Connecting…
  ```
  and `@shim <anything>` gets **no reply** (no "starting a session" message, no refusal — silence).

### 5.2 WSL-side evidence (collected 2026-11-06, as root)

```text
# Provider state on the host:
$ which claude && claude --version
/usr/local/bin/claude
2.1.318
$ claude          # as root, in /mnt/d/shim-desk
Ignoring 14 permissions.allow entries from .claude/settings.json:
this workspace has not been trusted. Run Claude Code interactively here once
and accept the trust dialog, or set projects["/mnt/d/shim-desk"].hasTrustDialogAccepted:
true in /root/.claude.json.
Not logged in · Please run /login
→ provider is INSTALLED but NOT SIGNED IN for the host user (root).

# gh state on the host:
$ gh auth status
You are not logged into any GitHub hosts. To log in, run: gh auth login

# Any Switch sidecar/controller on the host?
$ ps aux | grep -iE 'switch|sidecar|controller' | grep -v grep
(nothing)
$ ls /opt/switch* /usr/local/switch* /root/.switch /root/.config/switch*
(nothing)
$ ss -ltn | grep ':22 '
LISTEN  0  4096  0.0.0.0:22  0.0.0.0:*   (our sshd only)
```

Caveat: our process grep is coarse; the Switch-side process may exist under another name or was not started at all. **No host-side log location was shown by the Console UI** for this state.

### 5.3 Hypotheses (ordered by likelihood)

1. **Provider not signed in for the host user.** Docs ("Run an agent on the host" → "Sign in to the agent provider on the host yourself… If a provider shows **Not signed in**, copy the login command shown there, run it in a terminal on the host, then select **Recheck**"). The Console host page for `wsl-switch` likely shows `Claude Code: Not signed in` — we were unable to get past Blocker 1 to complete that flow. The session can't start until `claude` (root) is signed in on WSL. **User-side action pending, but the UI gave no pointer to it** — the room just shows "Connecting…".
2. **Workspace trust:** even signed in, Claude Code refuses the `permissions.allow` entries until `/mnt/d/shim-desk` is trusted for root's `~/.claude.json`. Docs for remote hosts should call out that `hasTrustDialogAccepted` must be pre-set on the host (interactive first-run on a host is awkward).
3. **Controller/sidecar not started or not connected:** docs say Console "deploys a small process onto the host that holds the connection and starts a session when the agent is addressed"; a host reboot stops it. We found no such process; unknown whether it was ever deployed (possibly blocked by Blocker 1's incomplete host check) and whether there is any retry/redeploy.
4. **Silent state:** "Connecting…" with no console-visible reason and no host log is not diagnosable by the user; a status line like "waiting for host-side session (last error: …)" would be needed.

### 5.4 What we would like

- In the agent page / room status, surface **why** a remote-host agent is "Connecting…": (a) provider not signed in on host (with the exact host command to run), (b) trust dialog pending, (c) sidecar not deployed/started + a "Redeploy host agent" action.
- Docs: a "remote agent not answering on a WSL host" checklist (sign in as the *host's* user, `gh`/credentials, trust flag, `node` version ≥22, restart note).
- Verify/documented behavior: does "Recheck" on the host's provider sign-in re-probe, and can the host-side login command be displayed even when the *host* was added via the (currently broken) agent-socket path?

---

## 6. What we ruled out (so the investigation can skip these)

| Suspect | Status |
|---|---|
| WSL sshd down / host unreachable | **No** — `ss` shows :22 LISTEN; Windows `ssh wsl-switch` (key) succeeds; IP stable at time of report |
| WSL NAT IP changed after restart | **No** (not restarted since onboarding) — but *is* a known fragility: a WSL restart re-IPs the distro and the stored host entry would point at a stale IP. Related to the §4.5 "first-class WSL" ask. |
| Wrong/missing alias or key | **No** — `BatchMode=yes` key auth works from both Git Bash and (fresh-process) Windows SSH |
| Missing `claude` on host | **No** — `2.1.318` at `/usr/local/bin/claude` (only *sign-in* missing, §5) |
| Node too old on host | **No** — `v22.22.1` |
| Console's local server dead | **No** — Docker container healthy; Mattermost reachable; `!agents-status` itself responds |
| `~/.ssh/config` agent config | **No** — no `IdentityAgent`/`ProxyCommand`; the agent env is purely `SSH_AUTH_SOCK` |

---

## 7. Related upstream issues

- **#1472** — "Windows: adding a remote host fails with 'SSH agent socket not found' although the OpenSSH agent is running" (open). Our Blocker 1 extends it: with a manually-set (but mangled) `SSH_AUTH_SOCK`, the failure mode is **`Invalid cygwin unix socket path`**, i.e. the env var *is* read — good data point for the fix.
- **#1511** — "Windows: template form offers no provider for a new agent on a server with agent management" (open). We hit the same missing-provider symptom during onboarding; agent 1 was created via the manual agent form.

---

## 8. Suggested code changes (for the Switch coding agent)

1. **`resolveUserEnv()` (win32 branch):** stop early-returning before agent detection; call `detectSshAuthSock()`; default to `\\.\pipe\openssh-ssh-agent` when nothing is found and the agent service is running.
2. **SSH_AUTH_SOCK normalization (Windows):** accept `\\.\pipe\X`, `Global\X`, `cygdrive`/`/tmp` forms; **preserve backslash count** when the value crosses the config/env boundary (the observed single-backslash collapse is the proximate bug — check where the value passes through a template/PATH-join or JSON string on Windows).
3. **Diagnostic error:** include the raw read value + expected formats in the "Cannot reach … socket path" error; distinguish *unset* vs *malformed* vs *unreachable* vs *agent has no keys*.
4. **Key-file fallback probe:** `ssh -F <usercfg> -o BatchMode=yes <host> 'echo switch-probe-ok'`; surface as the host-check method when agent auth is unavailable, and record which method the host entry uses.
5. **WSL first-class host:** if the user's platform is Windows and the target resolves to a WSL distro IP or `\\wsl$\<distro>` share, offer "this machine's WSL (<distro>)" with stable addressing (e.g. `\\wsl.localhost\<distro>` or `wsl.exe -d <distro>` interop) instead of a NAT IP.
6. **Remote-agent status pipeline:** in the room/agent-page status, emit the *reason* for "Connecting…" (provider sign-in / trust / sidecar) and a "Show host logs" affordance; on WSL hosts, document `~/.claude.json` trust + provider login for the **host's** user.

---

## 9. Appendix — full evidence commands & outputs (copy-paste repro)

```powershell
# --- Windows side ---
reg query "HKCU\Environment" /v SSH_AUTH_SOCK
# → (0x2)(REG_SZ) "\.\pipe\openssh-ssh-agent"   ← mangled; must be "\\.\pipe\openssh-ssh-agent"

ssh -o BatchMode=yes wsl-switch "echo OK $(node -v)"
# → OK v22.22.1   (works: key-file auth, no agent)

# --- WSL (as root) ---
ss -ltn | grep ':22 '
# → LISTEN 0 4096 0.0.0.0:22 ...
which claude; claude --version
# → /usr/local/bin/claude / 2.1.318
claude
# → "Not logged in · Please run /login"
# → "Ignoring 14 permissions.allow entries from .claude/settings.json:
#     this workspace has not been trusted … set
#     projects['/mnt/d/shim-desk'].hasTrustDialogAccepted: true in /root/.claude.json"
gh auth status
# → "You are not logged into any GitHub hosts."
ps aux | grep -iE 'switch|sidecar' | grep -v grep
# → (nothing)
ls /opt/switch* /usr/local/switch* /root/.switch /root/.config/switch*
# → (nothing)

# --- Switch Console (GUI) ---
Settings → Remote hosts → Add host (wsl-switch)
# → "Could not add the host. (Cannot reach wsl-switch: Invalid cygwin unix socket path)"
Room ~shim-desk: !agents-status
# → "shim-lead.jayanth: Connecting…"
@shim hello
# → (no response)
```

**Repo for reference:** `github.com/JayanthMalladi/shim-desk` — `docs/DECISIONS.md` (operator log), `switch/shim-desk.template.yaml` (the two-agent + room template), `CLAUDE.md` + `.claude/skills|agents|settings.json` (the untrusted-workspace content Claude Code is ignoring on the host).

---

*Reporter contact: `JayanthMalladi` on GitHub (WeMakeDevs Discord available if maintainers want a live repro session).*

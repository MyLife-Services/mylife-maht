# Synthetic Operator Protocol
## MyLife Playbook Execution Guide

This document is read once and applied to every playbook. It covers the
operating protocol — session management, control flow, and reporting format.
Individual playbooks document what to do; this documents how to do it.

---

## Session Management

All sections in a movement share one cookie jar. Create it before the first
request and pass it on every subsequent call:

```bash
curl -s -c cookiejar.txt -b cookiejar.txt \
  -H "Content-Type: application/json" \
  ...
```

The jar persists across movements within a single run. A new run starts a
fresh jar. Never reuse a jar from a previous run.

---

## Environment

Values are loaded from `playbook.env` (gitignored). For Claude Code execution
they are already present in `tests/lib/session.mjs`. For other engines, load
`playbook.env` before beginning.

Non-sensitive values (`MYLIFE_BASE_URL`, `SYNTHETIC_MBR_ID`) may be embedded
in project instructions. The passphrase is entered fresh per session and never
persisted outside the env file.

---

## Control Flow Keywords

### `on_fail: abort`
If the section does not pass, stop the movement immediately. Do not execute
any further sections. Report what failed and why. This is used when later
sections are meaningless without the current one succeeding (e.g. auth).

### `store:`
After a section passes, write the specified values into a shared context
object. Later sections reference stored values as `${context.key}`. If a
section fails, do not write its store values.

### `vars:`
Section-local variables resolved before the request is built. Available as
`${varName}` within that section only.

### `for_each:`
If the `source` collection is empty: skip all nested `do:` steps, note the
absence, and count the parent section as passed.
If the `source` has items: execute the `do:` block once per item. Each
iteration is reported as a sub-section under the parent.

---

## Assertion Evaluation

`assert:` criteria are evaluated against the raw response. Types:

| Criterion form | Meaning |
|---|---|
| `response is exactly: true` | Strict equality — not "truthy", literally `true` |
| `response is an array` | `Array.isArray(response)` |
| `response.field is a non-empty string` | typeof === 'string' && length > 0 |
| `response contains item where x == y` | Array.some() check |
| `response status is 302` | HTTP status code (not body) |
| `does NOT contain "string"` | Absence check on full dialog text |

All criteria in a section must pass for the section to pass. On first failure,
note which criterion failed and what the response actually contained.

---

## Assessment (`assess:`)

`assess:` blocks require synthetic judgment — they cannot be reduced to a
boolean. Evaluate them honestly:

- If a template variable was not substituted, say so even if the assert passed.
- If a bot response is incoherent, note it even if `success: true`.
- If a fallback default appeared ("MyLife Member") instead of the real name, flag it.

Assessment notes appear in the movement report under each section's learned block.

---

## Reporting Format

After all sections complete, produce the console summary below, then
write a report file as described in **Report File** below.

```
════════════════════════════════════════════════════════
Movement: [name]
Performance: [n]/[total] sections

What the synthetic now understands:
  [section name]
  { learned values as JSON }

Gaps:
  ✗ [section name]: [reason]

Overall: INSTRUMENT IN TUNE  (or REVIEW REQUIRED)
════════════════════════════════════════════════════════
```

Print a one-line status after each section as it completes:
```
  ✓  Survey available teams — 3 team(s). Collections: memories, stories, values
  ✗  Activate personal-avatar — Expected { success: true, id }. Got: null
```

---

## Report File

After completing a movement, write a Markdown report to:

```
tests/playbooks/results/<YYYY-MM-DD-HH-MM>-<movement-number>-<movement-slug>.md
```

Examples:
```
tests/playbooks/results/2026-04-26-14-32-01-login-and-stage-setting.md
tests/playbooks/results/2026-04-26-14-45-03-memory-creation.md
```

The slug is the movement name lowercased with spaces replaced by hyphens.
The timestamp is UTC at the moment the movement completes (`YYYY-MM-DD-HH-MM`).

**File format:**

```markdown
# Movement [number]: [name]
**Suite:** [suite]
**Run:** [ISO timestamp]
**Result:** INSTRUMENT IN TUNE | REVIEW REQUIRED
**Score:** [n]/[total]

## Sections

### ✓ / ✗  [Section name]
**Assertion result:** pass | fail — [criterion that failed, if any]
**Learned:**
\`\`\`json
{ ...learned values }
\`\`\`
**Assessment:** [your qualitative notes]

## Gaps
- [section name]: [reason, if any section failed or had a notable anomaly]

## Context Snapshot
\`\`\`json
{ ...all context keys written during this movement }
\`\`\`
```

If no sections failed and no anomalies were noted, the Gaps section may
be omitted. The Context Snapshot should include every key stored via
`store:` during this movement so downstream movements can reconstruct
state from the file if needed.

---

## URL Encoding

Member IDs contain a pipe character (`|`) which must be percent-encoded as
`%7C` in URL paths. Always encode before substituting into a path.

`ember|95ade320-e0f7-4cef-a001-9324edcb6e71`
→ `ember%7C95ade320-e0f7-4cef-a001-9324edcb6e71`

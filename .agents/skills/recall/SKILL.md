---
name: recall
description: Use this skill whenever you are doing non-trivial engineering work in an existing git repository: fixing bugs, chasing regressions, extending or refactoring existing code, investigating why something is structured the way it is, or preparing a meaningful commit after real repo work. This skill is a working discipline for recovering prior context from git and writing new context back into history, so future agents can reconstruct not just what changed but why. Trigger even if the user never mentions git, history, or commit messages explicitly whenever they ask you to change code that already exists, mention an issue number, bug report, regression, earlier PR or commit, ask "why is this like this?", or need a fix in a repo with meaningful history. Prefer this skill for tasks where previous decisions, failed attempts, or linked commits are likely to matter. Do not trigger for one-off shell commands, throwaway snippets, pure read-only Q&A, or work outside a git repository.
---

# Recall

## What this is

A discipline for using git as the project's long-term memory. Every commit you write should record not just what changed, but why — the decisions, the rejected alternatives, the dead ends, the open questions. Every task you start should begin by consulting the relevant history, so you inherit context instead of re-deriving it.

The reader you are writing for is another agent. Do not optimize commit messages for humans skimming `git log --oneline`. Optimize them for an agent who needs to reconstruct your reasoning. Length is not a concern. Completeness is.

## The workflow

At each of the following four points in a task, do the thing described. Scale the effort to the task: a typo fix moves through all four in seconds; a multi-day feature spends real time at each.

### 1. Orient

Before touching any code or reading any history, articulate the task to yourself. Identify the _core_ of the problem, not just the surface ask. Specifically, answer:

- What is the underlying goal?
- What does success look like, concretely?
- What's the scope — focused fix or architectural?
- What do you already know vs. what do you need to learn?

Keep this short — a paragraph of thinking, not an essay. Do not write it down unless the task is large. Skipping this step makes subsequent history lookups exploratory rather than targeted, which wastes context.

### 2. Look up history when grounded or surprised

Consult git history at two specific moments:

**Grounded lookup.** Once orienting has identified the files, modules, or concepts you're about to work in, check their recent history before editing. Use:

- `git log -p -- <file>` — show recent commits touching this file with full diffs and messages. This is the primary retrieval move.
- `git log --all --grep="<term>"` — find commits mentioning a specific topic, bug number, or concept across the whole repo.
- `git log -S "<string>"` — find commits where a specific string or function name was added or removed. Use this when you want to know when something was introduced.
- `git log --all --grep="#<NN>"` — find every commit related to a specific issue number.
- `git blame <file>` — find which commit last touched a specific line. Combine with `git show <hash>` to read the rationale.

Read enough to answer: has someone tried this before? Is there a decision I should respect? Is there a dead end I'd otherwise repeat? Stop when you have those answers — do not exhaustively read full history.

**Surprise lookup.** When something unexpected happens during the work — code structured oddly, a test failing for non-obvious reasons, a comment hinting at history, a name that doesn't match its usage — go deeper on the specific surprising thing. Surprise is the signal that prior context exists and matters.

### 3. Do the work

Do the engineering work. As you go, track four things so you can record them at commit time:

- What you chose, and what you rejected.
- What you tried that didn't work.
- Constraints you discovered that weren't obvious from the task description.
- Anything you left unresolved or punted on.

You do not need to take notes in real time, but you do need to remember enough to write them up at the end. If the task spans multiple commits, write up each commit's portion at its own commit boundary — do not batch all reasoning into the final commit.

### 4. Distill into the commit message

The goal is to compress the session into the commit message. Everything you learned, tried, decided, and rejected during this task — retain as much of it as possible. The commit message is the only artifact that survives the session. The code shows what changed; the message must preserve why, and everything else that would otherwise be lost.

There is no upper bound on length. Do not summarize when you can be specific. Do not conform to a template — use whatever structure captures the session most faithfully. Prose, bullets, a mix — the format doesn't matter. Completeness does.

### What to preserve

Think of these as categories of information that are easy to lose. Not every commit has all of them. Don't force them into headers or pad empty sections. Just make sure you don't drop them when they exist:

- **The goal** — what you were trying to accomplish and why. Not a restatement of the diff. The underlying problem, the context that motivated the work.
- **Decisions and their rationale** — what you chose and why. What you considered and rejected, and why you rejected it. Rejected alternatives are high-value content — they prevent the next agent from re-deriving and re-rejecting the same options.
- **Dead ends** — things you tried that didn't work, and why they failed. This is the highest-leverage content for preventing repeated mistakes. If you spent time discovering that approach X is incompatible with library Y, the next agent needs to find that in ten seconds, not re-discover it in two hours.
- **Constraints discovered** — things that weren't obvious from the task description but turned out to matter.
- **Open questions** — things you noticed but didn't resolve. The next agent picks them up or doesn't, but at least they're not invisible.

### Structure that matters

Two things should always be present and structured consistently, because they are the links agents follow when researching history:

**Summary line.** The first line. Descriptive, not compressed. This is the retrieval surface — when an agent runs `git log --oneline -- <file>`, the summary line is what it scans to decide which commits to read in full. Optimize for specificity and searchability, not brevity. Do not truncate to fit a character limit. "fix bug" is useless; "fix checkout timeout when cart has >50 items because inventory check was sequential" is useful.

**Fixes / Related.** Include these as metadata lines immediately after the summary, when they apply:

```
Fixes: #<NN>
Related: <hash>, <hash>
```

`Fixes:` gives agents a grep target (`git log --all --grep="#18"`) and tells hosting platforms to auto-close the issue. `Related:` lets agents mechanically follow a chain of commits backward — feature introduced in `abc1234`, bug fixed in `def5678`, edge case fixed here. These are how an agent navigates history, so include them whenever there's an issue or prior commit to reference. But neither replaces explaining the problem or the chain in the body — `Fixes: #42` alone tells the next agent nothing about what #42 was.

## Reading history: practical recipes

When orienting on a task, these are the moves that pay off most:

**"I'm about to touch file X."**

```
git log -p --follow -- <file> | head -300
```

The `--follow` traces renames. `head -300` because you usually want recent context, not full history. Increase if recent commits look thin.

**"The user mentioned issue #18."**

```
git log --all --grep="#18"
```

Then `git show <hash>` on each result.

**"Where did this function come from?"**

```
git log -S "function_name" --source --all
```

Finds commits that added or removed the string. Then `git show` the introducing commit.

**"This line looks weird, why is it like this?"**

```
git blame -w -C -C <file>
```

`-w` ignores whitespace changes. `-C -C` tracks code moved or copied between files. Then `git show <hash>` on the commit that introduced the line.

**"Has this part of the codebase changed recently?"**

```
git log --oneline -20 -- <directory>/
```

A quick scan of recent activity in an area.

**"I want to see the chain of commits related to this work."**
Look for `Related:` lines in commit bodies and follow the chain. Or:

```
git log --all --grep="Related:.*<hash>"
```

Finds commits that reference a given hash in their Related field — i.e., descendants of a logical chain.

You don't need to run all of these on every task. Pick the ones that match your situation.

## Edge cases and caveats

### Young projects with no memory yet

On day one of a project, `git log` returns one commit and there's nothing to consult. That's fine — the skill does nothing on the read side, and starts accumulating memory on the write side from the first real commit forward. Don't manufacture ceremony when there's nothing to read.

### Work in progress, before any commit

If you're hours into a task and haven't committed yet, the rationale doesn't exist in git. Two responses:

- Commit more often. Each logical step gets a commit with its own structured message. This is good practice independent of memory; it just becomes more important here.
- If a session might be interrupted before a commit lands, write a checkpoint commit even if the work isn't done. The summary line should indicate the work is incomplete, but the important thing is the structured body — include it with whatever you know so far. The reasoning is the part that would be lost; the code is already on disk.

### Trivial commits

A typo fix, a formatting change, a dependency bump — these don't need the full structure. A summary line and a one-line Goal is fine. The skill scales down as well as up; don't impose ceremony where there's no reasoning to preserve.

### When the diff and the rationale disagree

If your understanding of the work shifts mid-commit ("I started fixing a bug but discovered the real issue was deeper"), update the message to reflect what actually happened, not the original plan. Commit messages should describe reality. If reality changed, the message should too — and that shift is itself worth recording.

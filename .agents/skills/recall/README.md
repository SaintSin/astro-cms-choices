# recall

Stop teaching your agents the same things about your code over and over.

Recall is an [agent skill](https://agentskills.io/home) that compresses your session's reasoning into structured commit messages, and trains your agent to read history before it starts working. It's like `/compact`, but the context persists in your git history — available to every future session, every teammate, and every agent that touches the code.

## The problem

The most valuable part of an agentic coding session isn't the code, it's the reasoning. The decisions made, the alternatives rejected, the dead ends discovered. All of that lives in the chat transcript and vanishes when the session closes.

The next session starts from zero. Your agent re-derives the same decisions, hits the same dead ends, and rediscovers the same constraints. You end up re-explaining the same things about your codebase, over and over.

## How it works

Recall does two things:

**Writes context into git.** When your agent commits, Recall produces structured commit messages that capture the goal, the decisions and their rationale, rejected alternatives, dead ends, and open questions. The reasoning lives next to the diff it explains, indexed by everything git already indexes.

**Reads context from git.** Before editing code, Recall trains your agent to use `git log -p`, `git log -S`, `git blame`, and other commands to pull in prior context. Your agent learns _why_ the code is the way it is before changing it — making it more effective at fixing bugs and extending features.

No new infrastructure. No external services. Just git, which you already have.

## Installation

```sh
npx rosie-skills install withastro/recall
```

Then ask your agent to add recall to its instructions file so it loads the skill early — before examining files, not just when it's ready to commit:

```
Update AGENTS.md (or CLAUDE.md) to always load the recall skill before reading or editing code in this repo.
```

## What the agent does differently

With Recall loaded, your agent follows a four-step workflow:

1. **Orient** — Articulate the core problem before touching code.
2. **Look up history** — Consult `git log`, `git blame`, etc. to inherit prior context instead of re-deriving it.
3. **Do the work** — Track decisions, rejected alternatives, and dead ends as it goes.
4. **Distill** — Compress the session into a commit message that retains as much reasoning as possible.

Commit messages end up looking like this:

```
fix checkout timeout when cart has >50 items because inventory check was sequential

Fixes: #42
Related: abc1234, def5678

The checkout endpoint timed out for carts with >50 items. The root cause
was sequential per-item inventory checks against an API that rate-limits
at 20 rps — a 50-item cart took 2.5s just in inventory calls.

Batched inventory checks in groups of 10. This keeps us under the rate
limit while cutting wall time ~5x. Considered per-item parallelism first,
but the rate limit makes that worse, not better — parallel requests hit
429s and trigger retry backoff.

Also tried caching inventory locally to skip the API entirely. Stale cache
caused oversells in testing. Would need a cache invalidation strategy we
don't have time to build right now.

The rate limit may change when we migrate to the v3 inventory API. The
batch size of 10 is hardcoded in checkout.ts — revisit it then.
```

Before your agent edits a file, it consults the history to understand why the code looks the way it does:

```
> Fix the race condition in the queue processor

loading skill: recall

I'll start by checking the history of the queue processor before
making changes.

$ git log -p --follow -- src/queue.ts | head -300

Found 3 recent commits. The last change (ab1c2d) switched from
a mutex to a semaphore because the mutex was causing deadlocks
under high concurrency — that's the constraint I need to respect.

$ git log -S "acquireLock" --source --all

The lock was originally introduced in e3f4a5b to fix a duplicate
processing bug. The commit message notes that retry logic must
re-acquire the lock, not reuse the existing handle.

Now I have enough context to fix this without undoing prior work.
```

## License

MIT

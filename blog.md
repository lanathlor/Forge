# Every AI coding tool gets it backwards

I've been a tech lead for years. I manage teams, I ship products, I care about code quality. And every AI coding tool I've tried has the same fundamental problem: the AI is in charge.

Claude Code, Devin, Cursor, Agent Teams, Gas Town — they all follow the same pattern. You prompt the AI. The AI decides to plan. The AI decides what to code. The AI decides whether to run tests. The AI decides if the output is good enough. The AI decides when to commit.

Sometimes it runs your tests. Sometimes it doesn't. Sometimes it writes tests that test nothing. Sometimes it hallucinates that tests pass. You're supposed to trust the output because a second AI reviewed it — an AI reviewing an AI's work with the same blindspots.

I kept thinking: this is insane. I would never let a junior developer decide whether to run the linter. I would never let them skip tests because they "felt confident." The CI pipeline doesn't ask developers how they feel about their code. It runs the checks. Pass or fail. No negotiation.

So I built **Forge** in 3 days.

## The architecture is stupidly simple

Forge is a deterministic orchestrator that treats AI as a dumb tool. Not a brain. Not a decision-maker. A tool, like `gcc` or `prettier`.

Here's how it works:

1. You create a **plan** — a structured set of steps and tasks, stored in a database. Not in the AI's context window. Not in a prompt that evaporates when the session ends. In a database, queryable, versioned, persistent.

2. Forge picks a task from the plan and invokes **your AI provider** with a controlled context. Forge ships with a plugin system — Codex SDK, Claude Agent SDK, Claude Code CLI, even Ollama for local models. You pick what you want. The provider brings its own file reading, shell access, and code editing. But Forge controls what it sees. It builds the prompt, scopes the context to the relevant files, and defines the task boundaries. The AI does the coding. Forge decides what to code, when, and whether the result is acceptable.

3. Forge takes the output and runs **your QA gates**. Not AI-powered review. Your actual scripts. The ones already in your repo.

4. Gates pass? Forge commits. Gates fail? Forge retries or escalates. The AI never decides if its own work is good enough.

The configuration is a `.forge.json` file in your repo:

```json
{
  "maxRetries": 3,
  "qaGates": [
    { "name": "ESLint", "command": "pnpm eslint . --ext .ts,.tsx" },
    { "name": "TypeScript", "command": "pnpm tsc --noEmit" },
    { "name": "Coverage", "command": "pnpm test:coverage" },
    { "name": "Build", "command": "pnpm build" }
  ]
}
```

Swap your AI provider between `claude-sdk`, `codex-sdk`, `claude-code`, or `ollama` — your call, your auth, your ToS.

That's it. Your existing scripts. Your existing quality standards. Forge just runs them and enforces them without negotiation.

## Why the plan lives in a database

This is the part that sounds boring but changes everything.

When the AI plans in its context window, the plan is gone when the session ends. If the AI crashes, the plan is gone. If you want to see what the AI planned to do before it did it, you can't — it's buried in a conversation. If you want to pause, review, and resume tomorrow, tough luck.

With Forge, the plan is structured data in a database. Every step, every task, every status — queryable, inspectable, modifiable. You can pause a plan, go to bed, and resume it in the morning. You can look at a half-completed plan and reorder the remaining tasks. You can run a query to see how many tasks failed QA gates last week and on which types of tasks the AI struggles most. You can have one plan feed into another.

The plan is yours. Not the AI's. You can review it before a single line of code gets generated. The AI never even sees the full plan — it gets one task at a time, with just enough context to do its job.

This also means Forge doesn't care if the AI provider crashes mid-task. The plan state is in the database. Restart, pick up where you left off. No context window to reconstruct, no conversation history to replay.

## It won't eliminate AI slop. It reduces it.

Let me be clear about what Forge does and doesn't do.

AI-generated code is still AI-generated code. It will still have weird patterns, unnecessary abstractions, and questionable naming choices. Forge doesn't make the AI smarter. It doesn't fix the fundamental limitations of LLMs writing code.

What it does is keep the AI producing **working, somewhat acceptable code for longer periods of time**. Without gates, AI coding sessions degrade. The AI makes a mistake in file 3, doesn't catch it, and by file 10 it's building on a broken foundation. The errors compound. You end up with code that looks plausible but doesn't run.

Forge catches the rot early. If the lint fails on file 3, the AI fixes it before touching file 4. If tests break, the plan stops until they pass. The code won't be beautiful, but it will be functional. And functional code that needs cleanup is infinitely more useful than plausible-looking code that doesn't compile.

## Forge built Forge

Halfway through building it, I pointed Forge at its own repo. The bootstrap process was clunky — the early version had rough edges and I had to intervene more than I'd like. But it worked. Forge generated tasks, ran them through the AI provider, checked the gates, committed the results.

For the sake of the proof of concept, I let it have more autonomy than I normally would on a real project — fewer manual review steps, looser gates. Even with that slack, the output was usable. Not perfect, but usable. That's when I knew the core idea was sound: a dumb loop of "generate, check, commit or retry" produces surprisingly reasonable results when the checks are deterministic.

The codebase itself is the proof. Go read it. It's not beautiful — it's vibe coded, and I won't pretend otherwise. But it's maintainable. The tech debt is manageable. The structure makes sense. That's more than I can say for most AI-generated codebases I've seen.

A note on that: Forge is the only project I've vibe coded, and I don't recommend vibe coding. This is a thought experiment, not a workflow endorsement. If I find myself still reaching for Forge in a few months, I'll rebuild it properly — using Forge itself, but with the manual control turned way up. That's kind of the point.

## Why this matters

Every "AI orchestrator" right now is actually just more AI. Gas Town? The Mayor is a Claude Code instance. The workers are Claude Code instances. The coordination is Claude talking to Claude. Copilot Orchestra? The "quality gate" is an AI agent reviewing code. GitHub Agent HQ? A platform to run AI agents that internally make all their own decisions.

They're building increasingly elaborate ways for AI to supervise itself. And it doesn't work, for the same reason you don't let developers approve their own pull requests.

The alternative is embarrassingly obvious: treat the AI like any other tool in your pipeline. You don't let `npm install` decide whether to run. You don't let your build tool decide whether tests matter. Why would you let an AI make those decisions?

Forge makes the AI a function call. `provider.execute(task, context) -> code changes`. Your orchestrator — deterministic, testable, inspectable code — handles everything else.

## What Forge is not

It's not a product. I built it in 3 days for myself because I was frustrated. The code is rough. There are known weird behaviors. I've been using it on my own projects and I like it.

Some people I showed it to said I should open-source it. So here it is.

If the idea resonates with you, try it. If you think the "AI-as-brain" approach is better, I'd genuinely like to hear why.

If you find bugs — and you will — open an issue.

**[Forge on GitHub](https://github.com/lanathlor/Forge)**

---

*I'm an engineering leader based in France. I built Forge because I wanted AI to write code for me without giving up the engineering discipline I spent years building. If you manage a team and share that frustration, I'd love to hear from you.*

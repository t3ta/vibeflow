# VibeFlow

**VibeFlow** is an autonomous refactoring pipeline that combines the Mastra workflow engine with Claude Code‑powered language models to transform _monolithic_ back‑end code bases into cleanly separated **modular monoliths**.

---

## What VibeFlow Does

1. **Boundary discovery** – automatically detects context boundaries in TypeScript, Go and Python sources (plus schema files) and writes them to `domain-map.json`.
2. **Architecture planning** – converts the discovered boundaries into a human‑readable design proposal (`plan.md`).
3. **Automated refactoring** – generates and optionally applies language‑specific patches that follow the plan.
4. **Test synthesis & relocation** – moves existing tests into their new modules and scaffolds missing cases.
5. **Migration execution** – builds, runs and measures the patched code; rolls back on failure.
6. **AI‑assisted code review** – comments on pull requests and auto‑merges when all criteria are met.

Each step is idempotent and can be re‑run safely, making the process robust in local and CI environments.

---

## Repository Layout (work in progress)

```
.
├── src/                 # CLI, core logic, agent stubs
├── workspace/           # target projects live here (kept outside this repo’s deps)
└── README.md
```

---

## Quick Start (early alpha)
[text](../ikimon/.mcp.json)
```bash
# 1. clone a monolithic project into the workspace
vf clone https://github.com/your-org/your‑app.git

# 2. generate a refactor plan
vf plan

# 3. run the refactor (‑a applies patches)
vf refactor -a
```

> **Important:** the CLI currently contains stub implementations – it prints placeholders until the individual agents are wired in.

---

## Roadmap

| Milestone | Deliverable                                                         |
| --------- | ------------------------------------------------------------------- |
| M1        | BoundaryAgent & ArchitectAgent completed                            |
| M2        | RefactorAgent integrated with Claude Code via local/Ollama endpoint |
| M3        | TestSynthAgent + MigrationRunner                                    |
| M4        | End‑to‑end CI template & GitHub Action                              |
| M5        | Public beta release                                                 |

Feedback and contributions are welcome. Please open an issue or start a discussion!

# Changelog

All notable changes to AG Kit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/).
Starting with `2026.5.13`, this project uses calendar versioning in `YYYY.M.D` format.

## [Unreleased]

No unreleased changes.

## [2026.6.23] - 2026-06-23

> Rules modularization, README cleanup, and version bump.

### Changed
- **Modular rules architecture**: Split the monolithic `GEMINI.md` rules file into 6 focused, single-responsibility files: `core-protocol.md`, `request-routing.md`, `universal-rules.md`, `code-rules.md`, `design-rules.md`, and `quick-reference.md`. Enables conditional loading — only relevant rules are activated per request context.

### Removed
- **`GEMINI.md`**: Replaced by the 6 modular rule files above.

## [2026.6.7] - 2026-06-07

> Documentation website overhaul: a redesigned MDX rendering system, full multi-language support (English, Tiếng Việt, 中文, 日本語), a working table of contents, and a new in-site changelog page. This release touches only the `web/` docs site.

### Added
- **Multi-language docs (en / vi / zh / ja)**: client-side i18n with a language switcher (flag dropdown) in the header. Persists choice to localStorage + cookie and switches instantly without a reload. All UI chrome (header, footer, search, mobile menu, TOC) plus all 7 docs pages and all 10 guide examples are translated; each example page ships `content.{en,vi,zh,ja}.mdx` selected by a `LocalizedDoc` wrapper with English fallback.
- **Changelog page** at `/docs/changelog`, rendered from `web/src/services/changelog.json` with per-section badges, linked from the sidebar and footer.
- **Working "On This Page" table of contents**: scroll-spy TOC that builds from page headings (auto-slugging headings that lack an id) and highlights the active section.
- **Syntax highlighting & MDX pipeline**: wired `rehype-pretty-code` (shiki), `rehype-slug`, `rehype-autolink-headings`, and `remark-gfm` into the MDX build; added `next/font` (Inter + JetBrains Mono).
- **Follow-on-X dialog**: a one-time auto-popup (re-openable from a header button) inviting visitors to follow [@antigravitykit](https://x.com/antigravitykit).

### Changed
- **Redesigned MDX components** (terminal/dev-tool aesthetic): Terminal with window chrome, Step with connector line, Callout, FeatureGrid, ProTips, and a new StatusList component. Replaced hand-rolled `<div>` blocks in example content with these components.
- **Neutral accent color**: docs accent now follows the foreground color (white in dark mode) instead of cyan/emerald, matching a standard docs look.
- **Synced docs catalogs** (`skills.json`, `agents.json`, `workflows.json`) to the real repository: 45 skills, 20 agents, 13 workflows; removed phantom skill names.

### Fixed
- Heading `id`s are now forwarded through the MDX component mapping so the TOC and anchor links work.
- Inline code no longer double-boxes fenced code blocks; lists use `list-outside`.
- Corrected the installation page Node requirement (18+), CLI flag aliases, and the `ag-kit status` output description.

## [2026.6.2] - 2026-06-02

> Full-kit accuracy audit. Reviewed every component of AG Kit — all 45 skills, 20 agents, 13 workflows, the GEMINI.md rules, and both overview docs — against verified 2026 facts (OWASP Top 10:2025, MCP spec 2025-06-18, Rust 2024 edition, Node 24 LTS). Removed dead references, fabricated numbers, internal contradictions, broken formatting, and stale date stamps. Also taught the CLI to surface update notifications from `ag-kit status`.

### Added
- **CLI update check on `status`**: `ag-kit status` now prints the installed CLI version and checks npm for a newer release (parallel, 1.5s timeout), showing an update banner or confirming you're current. Added `--quiet` to suppress the check in CI/CD.

### Changed
- **Remaining 36 skills audited & fixed**: corrected stale tech (Rust 1.75→2024 edition, MCP SSE/WebSocket→Streamable HTTP, PlanetScale FK support, `aioredis`→`redis.asyncio`), rewrote the vulnerability-scanner checklist to OWASP Top 10:2025, and stripped fabricated benchmarks/prices/time-estimates across brainstorming, code-review-graph, and others.
- **20 agents & 13 workflows audited**: removed dead agent/skill references, fixed a corrupted `rust-pro` frontmatter, added missing `tools:`/`allowed-tools` fields, corrected the orchestrate agent roster to 20, and softened mandatory auto-install protocols to opt-in.
- **ARCHITECTURE.md & AGENT_FLOW.md catalogs** now match the repository exactly: 45 skills (added `rust-pro`, `intelligent-routing`; removed 5 phantom skills like `prisma-expert`/`nestjs-expert`), 16 skill-level scripts, refreshed framework lists.
- Bumped root, web, and cli package versions to `2026.6.2`.

### Fixed
- **Dead references** across the kit: `react-best-practices`→`nextjs-react-expert`, `api-designer`/`conversation-manager`/`refactoring-patterns` removed or repointed, two phantom scripts (`dependency_analyzer.py`, `bundle_analyzer.py`) dropped from GEMINI.md.
- **Broken formatting**: escaped PowerShell pipes breaking Markdown tables, fixed a broken code fence in plan-writing, repaired mojibake in project-planner, and translated leftover Turkish text in GEMINI.md, mobile-design, and frontend-specialist.
- **Stale date stamps**: removed "(2025)"/"for 2025" stamps from titles and intros across many skills and agents for evergreen docs.

## [2026.5.31] - 2026-05-31

> Skill accuracy pass. Audited and upgraded the `app-builder` skill plus 8 tech skills against verified 2026 facts (Next.js 16, React 19, Node 24 LTS, Tailwind v4, Express 5). Focus: kill version drift, internal contradictions, fabricated numbers, and stale date stamps.

### Added
- **Conflict Resolution in app-builder**: `project-detection.md` now has a priority order for ambiguous requests (platform > domain, head noun, then Socratic Gate) instead of naive keyword matching.
- **Per-template version notes**: All 13 `app-builder` templates carry a `> Versions reflect the latest stable line verified 2026-05` note and use a "major line + latest stable" style instead of pinned exact numbers, so they age gracefully.

### Changed
- **app-builder architecture normalized to Layer-based**: Rewrote `scaffolding.md` (`src/{app,components,lib,actions,types}/` with `lib/dal.ts` + `lib/db.ts`) to match `nextjs-fullstack/TEMPLATE.md`, resolving a contradiction where the two files described different Next.js structures.
- **All 13 app-builder templates refreshed** to 2026 best-practice structure: FastAPI domain/module layout, Express 5 + `app.ts`/`server.ts` split, electron-vite main/preload/renderer, CRXJS `manifest.config.ts`, Nuxt 4 `app/` srcDir, Astro 6 Content Layer API, Turborepo `tasks` key, `@inquirer/prompts`. Auth standardized to Auth.js v5 / Clerk; Node 24 LTS and React 19 across the board. `nuxt-app` translated from Vietnamese to English.
- **nodejs-best-practices**: Rebaselined to Node 24 LTS (type-stripping default, test runner stable since Node 20).
- **tailwind-patterns / frontend-design / nextjs-react-expert**: Softened or sourced unsupported "Nx faster" claims with official figures; stripped stale `(2025)` date stamps from titles and intros across the audited skills.

### Fixed
- **orchestrate.md plan-file convention**: Replaced 10 references to `docs/PLAN.md` with the house-standard `{task-slug}.md` in project root, aligning the workflow with `project-planner` and `app-builder`.
- **Fabricated numbers removed**: Dropped invented metrics like "API routes (12 endpoints)", "Estimated Time: 15-20 minutes", "Fastify 2-3x faster", and "Oxide 10x faster"; replaced with functional descriptions or official benchmarks.
- **nextjs-react-expert rule counts**: Reconciled the contradictory 57/58/59 totals to 58, acknowledged Section 9 (Cache Components), and aligned the `name` frontmatter with the folder.
- **Broken glob in react_performance_checker.py**: `rglob('*.{ts,tsx}')` matched zero files (Python pathlib has no brace expansion) — added an `_iter_files` helper so the audit script actually scans the project.
- **frontend-design contradictions**: Resolved mesh-gradient (banned vs "mandatory"), flat-design ("FAILED" vs valid choice), and "PURPLE BANNED" absolutism into intent-based guidance; removed a misplaced and incorrect "Next.js 16 next/form" section (`next/form` shipped in Next.js 15); cleared Turkish mojibake; wired the orphan `accessibility_checker.py` into the script table.
- **api-patterns dead links**: Repointed cross-references `backend-development` → `nodejs-best-practices` and `security-hardening` → `vulnerability-scanner`; translated a leftover Turkish line.
- **database-design**: Corrected PlanetScale "No foreign keys" — foreign key constraints have been GA since February 2024.
- **python-patterns**: Replaced deprecated `aioredis` with `redis-py` (`redis.asyncio`).
- **ARCHITECTURE.md**: Fixed a corrupted `## Scripts` heading character and reconciled the skill count to 45.

## [2026.5.25] - 2026-05-25

### Added
- **Vietnamese Documentation**: Created [README-VI.md](file:///Users/vudovn/Desktop/project/ag-kit/README-VI.md) providing a high-quality, professional Vietnamese translation of the refactored project guide.

### Changed
- **Folder Structure Normalization**: Successfully migrated the workspace from `.agent` to `.agents` folder naming across all documentation, architecture guides, and CLI configurations.
- **Singular Agent Directory**: Renamed the specialist agents directory inside `.agents` from `agents/` to `agent/` to maintain clean singular naming conventions.
- **Polished README Layouts**: Refactored `README.md` and `web/README.md` to remove old comparison tables, convert relative branding assets to absolute URLs, and reorganize the support section (Buy Me a Coffee + MBBank QR donations).
- **Website Documentation Sync**: Refactored Next.js documentation pages (`installation/page.tsx`, `cli/page.tsx`, and `workflows/page.tsx`) to align with the new `.agents/agent/` folder paths, 20 agents, 45 skills, and 13 workflows.

### Fixed
- **Dynamic Path Detection in Scripts**: Refactored the Python validation suite (`checklist.py`, `verify_all.py`, `auto_preview.py`, and `session_manager.py`) to dynamically detect `.agents` or `.agent` directories at runtime, eliminating the need for a root symlink while preserving backward compatibility.
- **Syntax Error in verify_all.py**: Removed a broken, invalid import statement (`from 930-15 import results`) that was causing syntax errors in the full verification script.
- **Documentation Component Counts**: Corrected inaccurate counts of workflows (from 14 to 13) and skills (from 44 to 45) in `.agents/ARCHITECTURE.md` and all related README tables.

## [2026.5.13] - 2026-05-13

### Added
- **Code Review Graph Skill**: Added a skill for token-efficient code review using Tree-sitter AST graphs and MCP blast radius analysis. It documents installation, workflow usage, alternatives, and token-savings scenarios for large codebases.
- **New AG Kit logo**: Added a new AG Kit brand mark as both PNG and SVG assets for the website and Open Graph metadata.

### Changed
- **Release versioning**: Switched project releases from semantic versioning to calendar versioning in `YYYY.M.D` format. The first calendar-versioned release is `2026.5.13`.
- **Package versions**: Set the root package and docs app package versions to `2026.5.13`.
- **Project rebrand**: Renamed public-facing references from the previous product name to **AG Kit** across package metadata, README files, docs pages, app metadata, `.agent` templates, scripts, workflows, and repository links.
- **Landing page**: Simplified the home page, removed the embedded external wordmark, and switched the hero identity to the new AG Kit logo.
- **Docs content**: Updated documentation titles, examples, installation copy, footer links, and guide metadata to use the AG Kit brand and `ag-kit` package/repository naming.
- **Font loading**: Removed the Google-hosted font import from the app layout and switched the global font tokens to local system font stacks.

### Fixed
- **Docs lint issues**: Escaped JSX apostrophes, fixed inline `// turbo` rendering, and adjusted React Compiler lint violations in theme, mobile menu, and sidebar skeleton components.

### Removed
- **External brand dependency**: Removed old Google-linked product references and the embedded external wordmark from the web app.

## [3.0.0] - 2026-04-01

### Added
- **Coordinator Mode Skill**: Multi-agent orchestration with parallel workers, synthesis protocol, fork semantics, and phase-based workflow (Research -> Synthesis -> Implementation -> Verification).
- **Memory System Skill**: Persistent cross-session memory with `MEMORY.md` index, 4-type taxonomy (`user`, `feedback`, `project`, `reference`), topic files, and auto-recall at session start.
- **Context Compression Skill**: Auto-compress context in long sessions with micro-compact tool output, phase summaries, and session checkpoints.
- **Verify Changes Skill**: Prove code works by running it instead of only inspecting it.
- **Batch Operations Skill**: Multi-file pattern-based modifications with preview-before-execute safety.
- **Simplify Code Skill**: Detect and reduce over-engineered complexity, unnecessary abstractions, dead code, and deep nesting.
- **Skillify Skill**: Auto-create new skills from repetitive multi-step workflows.
- **New Workflow `/coordinate`**: Advanced multi-agent coordination with coordinator protocol.
- **New Workflow `/remember`**: Save information to persistent cross-session memory.
- **New Workflow `/verify`**: Verify code changes through execution.

### Changed
- **Orchestrator Agent**: Major upgrade with coordinator mode patterns, phase-based workflow, worker prompt synthesis guide, fork semantics, concurrency rules, memory integration, and context compression awareness.
- **Parallel Agents Skill**: Enhanced with `when_to_use` frontmatter and concurrency classification.
- **All 44 Skills**: Added `when_to_use` frontmatter field for conditional and intelligent skill loading to reduce token waste.
- **README.md**: Complete rewrite with v2 vs v3 comparison table, pros and cons, migration guide, and attribution.

### Token Impact
- **+1,500 tokens** upfront from memory index and enhanced agents.
- **-3,000 to -15,000 tokens** saved per session through memory, compression, and better prompts.
- **Net: 13-33% more token-efficient** depending on session type.

### Inspired By
- Advanced AI agent source code analysis, including production coordinator, memory, and context management patterns.
- Patterns distilled into original markdown-based templates. No external code copied.

## [2.0.2] - 2026-02-04

### Added
- **New Skill `rust-pro`**: Rust 1.75+ expertise.

### Changed
- **Agent Workflows**: Updated `orchestrate.md` to fix Turkish output.

## [2.0.1] - 2026-01-26

### Added
- **Agent Flow Documentation**: Added comprehensive workflow documentation in `.agents/AGENT_FLOW.md`.
- **Agent Routing Checklist**: Documented mandatory steps before code or design work.
- **Socratic Gate Protocol**: Documented requirement clarification flow.
- **Cross-Skill References**: Added cross-skill reference pattern documentation.
- **New Skill `react-best-practices`**: Consolidated Next.js and React expertise.
- **New Skill `web-design-guidelines`**: Professional web design standards and patterns.

### Changed
- **Skill Consolidation**: Merged `nextjs-best-practices` and `react-patterns` into `react-best-practices`.
- **Architecture Updates**: Enhanced `.agents/ARCHITECTURE.md` with improved flow diagrams.
- **Rules Update**: Updated `.agents/rules/GEMINI.md` with Agent Routing Checklist.
- **Agent Updates**: Updated `frontend-specialist.md` and `qa-automation-engineer.md` with enhanced skill references and testing workflows.
- **Frontend Design Skill**: Enhanced `frontend-design/SKILL.md` with cross-references to `web-design-guidelines`.

### Removed
- Deprecated `nextjs-best-practices` skill after consolidation.
- Deprecated `react-patterns` skill after consolidation.

### Fixed
- **Agent Flow Accuracy**: Corrected misleading terminology in `AGENT_FLOW.md`.
- Changed "Parallel Execution" to "Sequential Multi-Domain Execution".
- Changed "Integration Layer" to "Code Coherence" with a more accurate description.
- Added reality notes about AI sequential processing versus simulated multi-agent behavior.
- Clarified that scripts require user approval and are not auto-executed.

## [2.0.0] - Unreleased

### Initial Release
- Initial release of AG Kit.
- 20 specialized AI agents.
- 37 domain-specific skills.
- 11 workflow slash commands.
- CLI tool for easy installation and updates.
- Comprehensive documentation and architecture guide.

[Unreleased]: https://github.com/vudovn/ag-kit/compare/v2026.6.23...HEAD
[2026.6.23]: https://github.com/vudovn/ag-kit/compare/v2026.6.7...v2026.6.23
[2026.6.7]: https://github.com/vudovn/ag-kit/compare/v2026.6.2...v2026.6.7
[2026.6.2]: https://github.com/vudovn/ag-kit/compare/v2026.5.31...v2026.6.2
[2026.5.31]: https://github.com/vudovn/ag-kit/compare/v2026.5.25...v2026.5.31
[2026.5.25]: https://github.com/vudovn/ag-kit/compare/v2026.5.13...v2026.5.25
[2026.5.13]: https://github.com/vudovn/ag-kit/compare/v3.0.0...v2026.5.13
[3.0.0]: https://github.com/vudovn/ag-kit/compare/v2.0.2...v3.0.0
[2.0.2]: https://github.com/vudovn/ag-kit/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/vudovn/ag-kit/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/vudovn/ag-kit/releases/tag/v2.0.0

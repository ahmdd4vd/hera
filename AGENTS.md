# Hera — AI Coding Agent Architecture Reference

## Purpose

Hera is a complete architectural reference for building production-grade AI coding agents. Every detail is verified from the Pi Agent source code (62K stars, TypeScript monorepo).

## Ownership

- **Root**: This AGENTS.md — project-wide rules, Hera Framework integration
- **SKILL.md**: Main architecture reference (19 sections, 37KB)
- **HERA_FRAMEWORK.md**: Structural framework for agent projects
- **install.sh**: Installation script for 18 AI agents

## Local Contracts

### Hera Framework

This project uses the Hera Framework (see HERA_FRAMEWORK.md). All edits must follow the framework's Read Before Editing and Update After Editing rules.

### File Structure

```
hera/
├── AGENTS.md                   ← This file (root contract)
├── HERA_FRAMEWORK.md           ← Structural framework
├── SKILL.md                    ← Architecture reference
├── README.md                   ← GitHub documentation
├── CLAUDE.md                   ← Claude Code config
├── install.sh                  ← Installation script
├── assets/hera-logo.jpg        ← Logo
├── .cursor/rules/hera.mdc     ← Cursor config
├── .agents/rules/hera.md      ← Antigravity config
├── .agents/workflows/hera.md  ← Antigravity workflow
└── .kiro/skills/hera/SKILL.md ← Kiro config
```

### Supported Agents

Claude Code, Hermes, OpenCode, Codex, Cursor, Antigravity, Pi, Gemini, Aider, Copilot, Amp, Kilo, Kiro, Devin, Trae, CodeBuddy, OpenClaw, Factory Droid

## Work Guidance

### Before Editing SKILL.md

1. Read this AGENTS.md
2. Read HERA_FRAMEWORK.md
3. Verify changes against Pi source code at /root/pi-agent
4. Ensure all code references are accurate

### After Editing

1. Update this AGENTS.md if structure changes
2. Update README.md if user-facing content changes
3. Run verification (see below)

## Verification

- All TypeScript code in SKILL.md must match Pi source code
- All file paths must exist in /root/pi-agent
- All line counts must be accurate
- All type definitions must be correct

## Child DOX Index

This project has no child AGENTS.md files. All content is in root-level files.

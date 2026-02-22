# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Tab Vault** — a Chrome extension (Manifest V3) that solves RAM/CPU drain from too many tabs while preserving them as ADHD workflow aids. Tabs are either live (open) or vaulted (fully closed and saved). No suspension, no halfway — closed is closed.

## Key Documents

- **PRD.md** — Full product requirements and feature specs
- **TICKETS.md** — Implementation tickets with completion promises (used by Ralph Loop)
- **PROMPT.md** — Ralph Loop instructions for autonomous ticket execution
- **archive/** — Completed PROMPT.md and TICKETS.md files are moved here after a loop finishes

## Document Workflow

1. Before starting a Ralph Loop, ensure `PROMPT.md` and `TICKETS.md` are current.
2. Ralph Loop processes tickets one at a time per `PROMPT.md` instructions.
3. Each completed ticket gets `[DONE]` added to its heading in `TICKETS.md`.
4. When all tickets are done, move `PROMPT.md` and `TICKETS.md` to `archive/` with a date suffix (e.g., `archive/TICKETS-2026-02-22.md`).

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla HTML/CSS/JS (no frameworks, no bundlers)
- `chrome.storage.local` for persistence
- Background service worker for tab operations

## Status

Early development — project documents created, implementation not yet started.

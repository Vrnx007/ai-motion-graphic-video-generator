<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Remotion & video

- For Remotion-specific patterns (Player, Lambda, Three.js integration), follow the official [Remotion Agent Skills](https://www.remotion.dev/docs/ai/skills): run `npx skills add remotion-dev/skills` in this repo so Cursor/Codex pick up current best practices.
- Optional internal QA: borrow a “scene review” pass (issues list + JSON-only fix) from the Claude Code Video Toolkit workflow — not shipped as a runtime dependency.

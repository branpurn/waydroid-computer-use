# Community survey (Android computer-use)

Infra fills this after the live survey pass. Candidates to evaluate:

## Mobile GUI agents

- [ ] AppAgent / similar LLM+UI trees
- [ ] Mobile-Agent / Mobile-Agent-v2
- [ ] AndroidWorld / Android-in-the-Wild benchmarks
- [ ] Other 2024–2026 “computer use” mobile stacks

## Screen + input tooling

- [ ] scrcpy (mirror + input)
- [ ] raw ADB (`screencap`, `input`)
- [ ] Waydroid-specific display (`waydroid show-full-ui`, Weston/cage)

## GAPPS / Play Store on Waydroid

- [ ] waydroid-script / MindTheGapps / NikGapps style flows
- [ ] Distro docs for Fedora + Waydroid GAPPS

## Reuse vs adapt

| Approach | Reuse | Adapt for Waydroid+Fedora |
|----------|-------|---------------------------|
| ADB primitives | High | Low |
| Full agent frameworks | Medium | Action I/O + hosting |
| scrcpy | Medium | Headless/CI use |
| Host-side capture | — | Prefer (Fedora lever) |

## Top takeaways

_TBD after survey._

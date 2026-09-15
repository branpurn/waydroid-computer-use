# Community survey (Android computer-use)

Host assumption for this project: **Waydroid on Fedora** (full Linux host under container Android). Lab topology is out of scope — only the platform matters.

Survey date: 2026-09-15.

## 1. Mobile GUI agents

| Project | URL | One-line | Rec |
|--------|-----|----------|-----|
| **AppAgent** | https://github.com/TencentQQGYLab/AppAgent | GPT-4V agent: explore → UI docs → taps/swipes. | **Adapt** loop; swap emulator for Waydroid ADB. |
| **AppAgentX** | https://appagentx.github.io/ | Next-gen AppAgent (2025). | **Watch / adapt** ideas. |
| **Mobile-Agent (v1–v3.5 / GUI-Owl)** | https://github.com/X-PLUG/MobileAgent | Multi-agent GUI stack; AndroidWorld + real-device. | **Reuse** schemas/eval glue; **adapt** device layer. |
| **AndroidWorld + M3A** | https://github.com/google-research/android_world | Live Android env + dynamic tasks; ReAct/Reflexion. | **Reuse** patterns; **adapt** hard (AVD/gRPC, not Waydroid). |
| **A3** | https://github.com/YuxiangChai/A3 | Arena: online Play Store tasks + MLLM eval. | **Reuse** eval concepts; skip AVD image. |
| **AITK** | https://github.com/YuxiangChai/AITK | Lightweight ADB/Appium toolkit + MLLM↔device. | **Adapt** strongly — best thin I/O reference. |
| **UI-TARS / UI-TARS-2** | https://github.com/bytedance/UI-TARS | VLM GUI agent; `MOBILE_USE` actions. | **Reuse** action vocab; **adapt** runtime. |
| **AutoDroid** | https://github.com/MobileLLM/AutoDroid | LLM + DroidBot UI graph + ADB. | **Reuse** exploration ideas; optional DroidBot. |
| **DroidBot** | https://github.com/honeynet/droidbot | ADB UI hierarchy → events. | **Reuse** as low-level inspiration. |
| **DigiRL** | https://github.com/DigiRL-agent/digirl | RL for in-the-wild device control. | **Skip** training initially. |
| **MobileWorld** | https://github.com/Tongyi-MAI/MobileWorld | Harder multi-task bench. | **Watch** for task design. |

## 2. Screen mirror + input

| Project | URL | One-line | Rec |
|--------|-----|----------|-----|
| **scrcpy** | https://github.com/Genymobile/scrcpy | Mirror + input over ADB. | **Reuse** for human debug; agent loop prefers `adb screencap` + `input`. |
| **sndcpy** | https://github.com/rom1v/sndcpy | Legacy audio forward. | **Skip**. |
| **use-waydroid-on-x11** | https://github.com/1999AZZAR/use-waydroid-on-x11 | Nest Waydroid in Weston/cage under X11. | **Adapt** only on X11 hosts. |

## 3. Waydroid: Play Store, ADB, display

| Project / doc | URL | One-line | Rec |
|---------------|-----|----------|-----|
| **Waydroid docs** | https://docs.waydro.id | Platform + desktop install. | **Reuse**. |
| **Official GAPPS init** | https://docs.waydro.id/usage/install-on-desktops | `waydroid init -s GAPPS`. | **Reuse** first path. |
| **Play certification** | https://docs.waydro.id/faq/google-play-certification | Register `android_id` for Play Protect. | **Reuse** in setup. |
| **waydroid_script** | https://github.com/casualsnek/waydroid_script | OpenGApps / MindTheGapps, Magisk, libndk/houdini. | **Reuse** for extras + ARM translation on x86_64. |
| **NikGapps** | https://github.com/nikgapps/project | Recovery-zip GApps. | **Skip** (wrong install model). |
| **waydroid-helper** | https://github.com/waydroid-helper/waydroid-helper | GUI for extras. | **Optional** UX. |
| **ArchWiki Waydroid** | https://wiki.archlinux.org/title/Waydroid | Nesting, binder, ARM translation. | **Adapt** tips. |

## 4. Reuse vs adapt (Fedora + Waydroid)

| Layer | Reuse | Must adapt |
|-------|-------|------------|
| Agent reasoning | AppAgent / Mobile-Agent / UI-TARS / M3A patterns | — |
| Device I/O | ADB verb set | AVD, gRPC, AndroidWorld Docker stack |
| Display | Native Wayland `waydroid show-full-ui` | cage/Weston only on X11 |
| Play Store | Official GAPPS or waydroid_script + certification | NikGapps; phone-only assumptions |
| ARM APKs on x86_64 | libndk / libhoudini via script | Assume all Play APKs are x86 |
| Benchmarks | Task *ideas* | Full AVD-centric runners |

## Top 5 takeaways

1. Thin **ADB control plane** (AITK/AppAgent-style): `screenshot`, `tap`, `swipe`, `type`, `key`, `launch_app` — do not fork AndroidWorld’s AVD/gRPC stack.
2. **Fedora setup path:** install Waydroid → `waydroid init -s GAPPS` (or MindTheGapps via script) → Play Protect certification → optional ARM translation → enable USB debugging for host ADB.
3. Steal action vocab from **UI-TARS `MOBILE_USE` + AppAgent/Mobile-Agent**; optional scrcpy for operators only.
4. **Skip** NikGapps, sndcpy, and AVD-centric harnesses initially.
5. On Fedora **Wayland**, skip cage/Weston; keep the repo a thin adapter: host brain ↔ Waydroid hands.

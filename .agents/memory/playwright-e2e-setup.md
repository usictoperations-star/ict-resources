---
name: Playwright e2e setup in this pnpm monorepo
description: How to get @playwright/test installed and actually running (chromium launches) for an artifact in this Replit workspace, plus a selector gotcha for shadcn Dialogs.
---

- Install `@playwright/test` as a workspace-scoped devDependency, not via `installLanguagePackages` at root (that fails with `ERR_PNPM_ADDING_TO_ROOT`). Use `pnpm add -D @playwright/test --filter @workspace/<artifact>`.
- Chromium browser binaries download fine with `pnpm exec playwright install chromium`, but `--with-deps` fails (no apt/sudo in Replit). The browser then fails to launch with missing shared libraries (`libglib-2.0.so.0`, then `libgbm.so.1`, etc.) until the Nix system deps are installed via `installSystemDependencies` (package-management skill): `glib nspr nss dbus atk at-spi2-atk cups libdrm expat xorg.libxcb libxkbcommon mesa alsa-lib cairo pango gtk3 xorg.libX11 xorg.libXcomposite xorg.libXdamage xorg.libXext xorg.libXfixes xorg.libXrandr xorg.libxshmfence at-spi2-core libgbm libglvnd systemd`.
- **Why:** Playwright's `install --with-deps` assumes an apt-based OS; Replit is NixOS, so browser shared-library deps must be added via Nix packages instead.
- No `webServer` block is needed in `playwright.config.ts` when the target app already runs via a Replit workflow — just point `baseURL` at `http://localhost:80` (the shared proxy) and assume the app is already up.
- shadcn/Radix `Dialog` + `DialogTitle` often duplicates the dialog's heading text on the submit button too (e.g. dialog titled "Add Database" with a submit button labeled "Add Database"). `dialog.getByText("X", { exact: true })` then hits both and throws a Playwright strict-mode violation — scope to `dialog.getByRole("heading", { name: "X" })` instead.

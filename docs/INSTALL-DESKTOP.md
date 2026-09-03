# HNI Pricing — Desktop Install Note

Personal OFFLINE edition: all data stays on this computer (no login, no cloud).
The team/cloud version remains the website. Sharing between the two = Export
backup in one, Import in the other.

## macOS (HNI-Pricing-<version>.dmg)

1. Open the .dmg, drag "HNI Pricing" into Applications.
2. FIRST launch only (the app is unsigned): right-click the app → **Open** →
   **Open** again in the warning dialog. After that it opens normally.
   If macOS still blocks it: System Settings → Privacy & Security → scroll to
   the blocked-app message → **Open Anyway**.
3. One-time migration from the browser version: in the browser app press
   **Export**, then in the desktop app press **Import** and pick the file.

## Windows (HNI-Pricing-Setup-<version>.exe)

1. Run the installer. On the SmartScreen warning: **More info → Run anyway**.
2. Same one-time Export → Import migration as above.

## Notes

- Data lives unencrypted in the app's local storage; laptop protection =
  FileVault/BitLocker + login password.
- No auto-update: replace the app when handed a new file.
- Save as PDF opens a real file dialog (no browser print dance).
- Distribution: shared drive or USB — the files are too large for email.

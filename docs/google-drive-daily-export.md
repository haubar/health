# Private Google Drive daily health export

The scheduled Netlify function runs at 19:50 Asia/Taipei and writes a dated `health-YYYY-MM-DD.json` into the owner's private [Health Daily Reports](https://drive.google.com/drive/folders/1T-ipFKStBr5pNBNXS4DB8w_JI8MED7IB) folder. The ChatGPT reminder runs at 20:00.

## One-time authorization (required before this works)

1. Enable **Google Drive API** on the same Google Cloud project as the dashboard.
2. Obtain a **Google OAuth refresh token** for the same owner Google account with the `https://www.googleapis.com/auth/drive.file` scope, using the existing OAuth client ID and secret. The owner must explicitly consent. **Do not put tokens in GitHub, URLs, or chat.** Prefer a first-party consent flow; if the OAuth client is in testing mode, refresh tokens may expire.
3. In Netlify's protected environment variables, set `DRIVE_REFRESH_TOKEN` to that refresh token (functions runtime scope). The existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are reused.
4. Deploy and inspect Netlify scheduled-function logs for `Drive health summary exported`; verify the dated file appears in the folder and is readable by the connected ChatGPT Google Drive integration.
5. Test the 20:00 ChatGPT reminder. Confirm the reported date, steps, and weight against the dashboard.

### Security and limits

- This feature does not publish Google Health data or OAuth credentials.
- The report contains only the derived daily assessment, not raw health records.
- Missing data remains `null`; no zero-step or weight measurement is invented.
- The export intentionally fails closed if more than one Google Health owner is connected.
- The Drive OAuth token must be authorized to create and update files in the destination folder.
- `drive.file` is a limited scope, but access to an existing folder may require selecting the folder via Google Picker or a one-time explicit authorization; a 403 from Drive indicates setup is incomplete.
- No scheduled export is active until this PR is merged, deployed, and the environment variable is configured.

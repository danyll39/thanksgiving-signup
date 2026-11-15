# Thanksgiving Sign-Up 🦃

A one-page potluck sign-up list. Guests type their name and tap **"I'll bring it"** next to a dish, or add their own. Only the person whose name matches can remove a sign-up. Sign-ups are saved in a Google Sheet, so everyone sees the same list (it refreshes every 20 seconds).

## Files

- `index.html` – the sign-up page (hosted on GitHub Pages)
- `google-apps-script/Code.gs` – the Google Sheet backend

## One-time setup

1. Create a new Google Sheet (sheets.new).
2. In the sheet, open **Extensions → Apps Script**, delete what's there, paste in all of `google-apps-script/Code.gs`, and save.
3. Click **Deploy → New deployment**, choose type **Web app**, set **Execute as: Me** and **Who has access: Anyone**, then **Deploy**. Approve the permissions Google asks for.
4. Copy the **Web app URL** (it ends in `/exec`).
5. In `index.html`, paste it into `var SCRIPT_URL = '';` and commit.
6. Turn on GitHub Pages (Settings → Pages → Branch: `main`). Pages needs the repo to be public on a free GitHub plan.

The "Signups" tab in the sheet fills with the default dishes the first time the page loads. You can edit dish names or categories there directly.

If you change `Code.gs` later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

# Raghav & Abhilasha · Wedding RSVP site

Live site: https://raghav-abhilasha.github.io

A single-page site (plain HTML, CSS and JavaScript, no build step) with an
RSVP form that saves each reply as a column in a Google Sheet, through a
Google Apps Script web app.

```
index.html              page structure + link-preview <meta> tags
assets/js/config.js     ALL editable text: names, dates, event, venue, "Good to know", contact, RSVP URL
assets/js/main.js       fills the page from config.js, scroll animations
assets/js/rsvp.js       RSVP form logic (conditional questions, validation, sending)
assets/css/style.css    look and feel; colours and fonts at the top (:root)
assets/img/             invitation artwork, share image, favicons
apps-script/            the Google Apps Script backend (Code.js, appsscript.json)
```

## Edit the content

1. Open `assets/js/config.js` and change the text.
2. The quick-pick dates in the arrival and departure questions are
   `rsvp.arrivalDates` and `rsvp.departureDates`. Guests can always choose
   "Another date".
3. Colours and fonts: the `:root` block at the top of `assets/css/style.css`.
4. The WhatsApp link preview comes from the `<meta>` tags at the top of
   `index.html`, not from `config.js`. Edit them there. WhatsApp caches
   previews, so changes can take a while to show for links already shared.

Preview on your computer:

```
python -m http.server 8000
```

then open http://localhost:8000.

Publish changes:

```
git add -A
git commit -m "Update wedding details"
git push
```

GitHub Pages updates the live site within a minute or two.

## The Google Sheet and backend

- Sheet: https://docs.google.com/spreadsheets/d/1gKdW3OKwqDnPITQfV2rSFv68_FbSI-wwunEvelbCqyk/edit
  - First tab: the labels are in column A, and each RSVP is one column (B, C, D …), with the newest on the right. Read each entry top to bottom. Don't reorder or insert rows.
  - **Summary** tab: totals, headcount, and counts per function, night of stay and food preference. It's all formulas, so it updates by itself.
- Script: open the sheet, then **Extensions > Apps Script**, or
  https://script.google.com/d/1KMl0z6Sm9RDa8caR8dx8PxzRKvrpC_CfUEDZaqLwItxSikcbwwSkBEzU/edit
- Web app URL (already in `config.js` as `RSVP_ENDPOINT`):
  https://script.google.com/macros/s/AKfycbykznCgPCWNwBd8xhvhr5hz3EVRMPkIGV5XkYUlh40tZaWEtNBkl7Xk_4n20puRG9zwqQ/exec
  Opening it in a browser should show `"RSVP endpoint is live"`.
- Every new RSVP emails the script owner. To send them to another address,
  add a Script Property `NOTIFY_EMAIL` in the script's **Project Settings**.
  Gmail accounts can send about 100 such emails a day.

### Change and redeploy the Apps Script

Edit `apps-script/Code.js`, then from the `apps-script` folder:

```
clasp push
clasp deploy -i AKfycbykznCgPCWNwBd8xhvhr5hz3EVRMPkIGV5XkYUlh40tZaWEtNBkl7Xk_4n20puRG9zwqQ -d "what changed"
```

Using `-i` with the same deployment ID keeps the same `/exec` URL, so the
website needs no change. (A plain `clasp deploy` would create a new URL.)

Running `setup` again is safe. It leaves the responses alone, turns an old
row-per-RSVP tab sideways if it finds one, and rebuilds the Summary tab.

If you add a new kind of permission to the code (for example, reading
another file), open the script editor, run `setup` once and click **Allow**
again. Until then, the web app returns an error.

## Export the guest list

- **Download:** in the sheet, **File > Download > Microsoft Excel (.xlsx)** or
  **Comma-separated values (.csv)** (the CSV covers the current tab only).
- **A filterable list:** Google Sheets filters work on rows, not columns. To
  filter (for example *Attending* = `Yes`, or by *Nights of stay*), add a new
  tab and put `=TRANSPOSE(Sheet1!A1:ZZ23)` in cell A1. Use your first tab's
  real name if it isn't `Sheet1`. That gives one row per guest, which updates
  by itself. Then use **Data > Create a filter** on that tab.
- Fields the form no longer asks about, filled in automatically:
  - *Functions attending* is always the wedding.
  - *Pickup / drop needed* is worked out from the travel mode. Flight, train or bus means pickup or drop; own car means none.
  - *Room needed* is always Yes.
  - *Nights of stay* covers each night from the arrival date to the night before departure, and always includes 11 Dec.
  - *Rooms needed*, *Food preference* and *Allergies* stay empty.
- If someone submits twice, keep the newer column (further right) and delete
  the older one. The Summary tab counts every column.

## Add a custom domain later

1. Buy a domain from any registrar (e.g. GoDaddy, Namecheap, Hostinger).
2. In GitHub: repo **Settings > Pages > Custom domain**, enter it (e.g.
   `www.raghavabhilasha.com`) and save. GitHub adds a `CNAME` file to the repo.
3. At your domain provider, add DNS records:
   - for `www`: a `CNAME` record pointing to `raghav-abhilasha.github.io`
   - for the bare domain: `A` records to `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153`
4. Wait for DNS (minutes to a few hours), then tick **Enforce HTTPS** in
   **Settings > Pages**.
5. Update the `og:url` and `og:image` / `twitter:image` URLs in `index.html` to
   the new domain, then commit and push.
6. Run `git pull` locally so you have the `CNAME` file GitHub created.

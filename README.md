# Data Discrepancy Reporter

A single-page app in plain HTML, CSS and JavaScript. No server code, no
libraries, no dependencies and no build step: the files in this folder are the
whole site.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | The markup for both views: the welcome screen and the app |
| `styles.css` | All styles: tokens, welcome screen, app, responsive rules |
| `app.js` | All behaviour: welcome animation, Home, the Discrepancies flow, the router |
| `assets/` | The Discrepancies and Records sidebar icons |
| `staticwebapp.config.json` | Azure Static Web Apps settings (security headers) |

## Try it on your computer

Double-click `index.html`. It runs straight from the file, no web server needed.

## Deploy to Azure Static Web Apps

Put these files at the top level of your repository, then point Azure at that
folder and tell it there is nothing to build.

GitHub Actions — in the workflow file Azure created under `.github/workflows/`,
set these values in the `with:` block of the `Azure/static-web-apps-deploy` step:

```yaml
app_location: "/"          # the folder that holds index.html
api_location: ""           # no API in this repository
output_location: ""        # nothing is built
skip_app_build: true       # deploy the files as they are
```

Azure Pipelines — the same four values go in the `inputs:` of the
`AzureStaticWebApp@0` task.

If you keep the site in a subfolder instead (for example `site/`), set
`app_location` to that folder name.

When creating the Static Web App in the Azure portal, choose the build preset
"Custom" (or "HTML"), app location `/`, and leave API location and output
location empty.

## Routes

The part of the address after `#` decides what is shown, so Back, Forward,
reload and bookmarks all work. Everything is handled in the browser.

| Address | Shows |
| --- | --- |
| `/#/` | Welcome screen |
| `/#/home` | Home |
| `/#/discrepancies` | Discrepancies (import, detect, review, report) |
| `/#/records` | Records |
| `/#/user` | User |

To add a page: add a `<section class="page" data-page="name">` and a sidebar
link to `#/name` in `index.html`, then add `name` to `PAGES` in `app.js`.

## Calling an Azure Function

- Linked Function App (Static Web Apps Standard plan): call it as
  `fetch('/api/yourFunction')`. Nothing else to change.
- A Function App on its own address: allow this site under CORS on the Function
  App, and add `connect-src 'self' https://your-func.azurewebsites.net` to the
  `Content-Security-Policy` value in `staticwebapp.config.json`. Without that
  the browser blocks the call.

## Notes

- Imported records are sample data generated in `app.js` (`buildRows`); the
  5-second waits (`LAG`) stand in for the real import and detection services.
- The two sidebar icons were made from the supplied PNGs by turning their grey
  background transparent, so they can take the sidebar's text colour.

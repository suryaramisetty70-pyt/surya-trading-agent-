# Website essentials

- **Pages and navigation** — Home, Terminal, Stock detail, forecast view, account if used, Help, and a useful 404 page. Consistent navigation, search, clear titles and stable links.
- **Responsive and accessible UI** — Check phone, tablet and desktop widths. Support keyboard navigation, visible focus, labeled controls, adequate contrast and text alternatives for charts.
- **Loading and error states** — Give every data view loading, ready, empty, stale and error states as applicable. Bound requests, explain failures and offer retry. Preserve the current selection.
- **Data clarity** — Show exchange, currency, source, as-of time and session status. Separate observed data from model estimates. Verify feed and display rights for the intended audience.
- **Account and security** — HTTPS, server-side secrets, input validation, safe output rendering, access control, rate limits, safe cookies and isolated user ledgers where applicable. Redact secrets and personal data from logs.
- **Performance** — Paginate large lists, cache data within rights and freshness rules, lazy-load heavy views and measure response times and mobile behavior.
- **Deployment** — Separate staging and production, document environment variable names and migration steps, automate checks, keep health endpoints, backups, monitoring and rollback instructions.
- **User information** — Explain simulated fills, data delay and forecast limits. Provide support contact and relevant privacy and use information. Confirm publication rights and review requirements before public release.
- **Testing** — Add unit and API coverage for the regression paths, browser checks for navigation and mobile, and staged checks with authorized provider data. Record failures and dependency blockers.

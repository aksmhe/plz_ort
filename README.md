# PLZ Ort

Kleine Frappe-/ERPNext-App (v15 und v16): Beim Eintippen einer **deutschen Postleitzahl** im Formular **Adresse**
werden **Ort** und **Bundesland** automatisch ausgefüllt.

- Datenquelle: [OpenPLZ API](https://openplzapi.org) (kostenlos, ohne Schlüssel). Es wird **nur die Postleitzahl** gesendet.
- Gibt es zu einer PLZ mehrere Orte, erscheint ein Auswahlfenster.
- Ein schon eingetragener Ort mit Ortsteil (z. B. „Selm Bork“ bei PLZ 59379) wird nicht überschrieben.
- Ist als Land etwas anderes als „Germany“ eingetragen, passiert nichts.

## Installation (frappe_docker)

In `apps.json` ergänzen:

```json
{ "url": "https://github.com/<KONTO>/plz_ort", "branch": "main" }
```

Image neu bauen, Container neu starten, dann:

```bash
bench --site <site> install-app plz_ort
```

## Hinweis

Falls vorher ein Client Script mit derselben Funktion angelegt war (z. B. „Adresse PLZ Ort“), dieses nach der
Installation **deaktivieren**, sonst läuft die Abfrage doppelt.

## Lizenz

MIT

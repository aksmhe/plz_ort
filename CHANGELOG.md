# Änderungen

## 0.3.0

- **Wirkt jetzt in allen Formularen und Dialogen** mit PLZ- und Ort-Feld, nicht mehr nur im Formular **Adresse**.
  Neu dabei: Schnellerfassung bei **Neu Kunde** und **Neu Lieferant** (Land-Feld `country_address`) und das Formular **Lager** (Feld `pin`).
- Eingebunden über `app_include_js` (`plz_ort.bundle.js`) statt `doctype_js`. Die alte Datei `public/js/address.js` entfällt.
- Weitere Feldpaare lassen sich mit `plz_ort.feldpaare.push({...})` anmelden.
- Ändert man die PLZ, während die Abfrage noch läuft, wird das veraltete Ergebnis verworfen.
- Nach dem Update: `bench --site <site> clear-cache` und Browser neu laden.

## 0.2.0

- Österreich, Schweiz und Liechtenstein. Bei leerem Land wird in allen passenden Ländern gesucht.
- Bis zu 50 Orte je PLZ.

## 0.1.0

- Erste Version: Ort und Bundesland aus der deutschen PLZ im Formular **Adresse**.

# PLZ Ort für ERPNext

Füllt im Formular **Adresse** nach dem Eintippen einer Postleitzahl automatisch **Ort** und **Bundesland** bzw. **Kanton** aus.
Unterstützt werden **Deutschland, Österreich, Schweiz und Liechtenstein**.
Ort und Bundesland müssen nicht mehr abgetippt werden. Tippfehler wie „Frankfrut“ fallen weg.

- Läuft mit **ERPNext / Frappe 15 und 16**
- Kostenlos, ohne Anmeldung und ohne Schlüssel. Datenquelle ist die freie [OpenPLZ API](https://openplzapi.org).
- Es wird **nur die Postleitzahl** gesendet, keine Namen und keine Adressen.

---

## Inhalt

1. [Was die App macht](#1-was-die-app-macht)
2. [Installation](#2-installation)
3. [Einrichtung in ERPNext](#3-einrichtung-in-erpnext)
4. [Ausprobieren](#4-ausprobieren)
5. [Grenzen](#5-grenzen)
6. [Fehlerbehebung](#6-fehlerbehebung)
7. [Datenschutz und Sicherheit](#7-datenschutz-und-sicherheit)

---

## 1. Was die App macht

- **Ort und Bundesland automatisch:** Sobald im Feld **Postleitzahl** eine passende PLZ steht, fragt ERPNext die OpenPLZ API ab. Danach trägt es **Ort** (*City*) und **Bundesland/Kanton** (*State*) ein.
- **Vier Länder:** Welches Land abgefragt wird, richtet sich nach dem Feld **Land**:

  | Land | PLZ | Feld Bundesland/Kanton bekommt |
  |---|---|---|
  | `Germany` | 5 Ziffern | Bundesland, z. B. `Hessen` |
  | `Austria` | 4 Ziffern | Bundesland, z. B. `Oberösterreich` |
  | `Switzerland` | 4 Ziffern | Kanton, z. B. `Zürich` |
  | `Liechtenstein` | 4 Ziffern | bleibt leer, Liechtenstein hat keine Bundesländer |
- **Mehrere Orte zu einer PLZ:** Gehören zu einer PLZ mehrere Orte, öffnet sich ein Fenster. Man wählt dort den richtigen Ort aus und klickt **Übernehmen**.
- **Ortsteile bleiben stehen:** Steht im Feld **Ort** schon ein Name, der den gefundenen Ort enthält, bleibt er unverändert. Beispiel: „Selm Bork“ bei PLZ 59379.
- **Land leer:** Bei 5 Ziffern sucht die App in Deutschland. Bei 4 Ziffern sucht sie in Österreich, der Schweiz und Liechtenstein. Gibt es die PLZ in mehreren Ländern, steht das Land im Auswahlfenster in Klammern dahinter. Das passende Land trägt die App danach ins Feld **Land** ein.
- **Land nachträglich geändert:** Steht schon eine PLZ im Formular und man ändert das **Land**, sucht die App neu.
- **Andere Länder:** Steht als **Land** z. B. `France`, passiert nichts.
- **Unbekannte PLZ:** Unten rechts erscheint kurz der Hinweis *„PLZ … nicht gefunden“*. Die Felder bleiben unverändert.

So sieht das aus:

| Eingabe Postleitzahl | Vorher im Feld Ort | Ergebnis Ort | Ergebnis Bundesland |
|---|---|---|---|
| `61197` | leer | `Florstadt` | `Hessen` |
| `59379` | `Selm Bork` | `Selm Bork` (bleibt) | `Nordrhein-Westfalen` |
| PLZ mit mehreren Orten | leer | Auswahlfenster | passend zum gewählten Ort |
| `1010`, Land `Austria` | leer | `Wien, Innere Stadt` | `Wien` |
| `8001`, Land `Switzerland` | leer | `Zürich` | `Zürich` (Kanton) |
| `9490`, Land `Liechtenstein` | leer | `Vaduz` | leer |
| `4600`, Land leer | leer | Auswahlfenster, z. B. „Wels (Österreich)“, „Olten (Schweiz)“ | passend zur Auswahl |
| `1234`, Land `Germany` | – | nichts passiert (nur 4 Ziffern) | nichts passiert |
| `00000` | – | Hinweis „nicht gefunden“ | – |

---

## 2. Installation

### Mit frappe_docker (eigenes Image)

#### Vorher: Platzhalter ermitteln

In den Befehlen unten stehen Platzhalter in spitzen Klammern, z. B. `<site>`. Diese ersetzt man durch die **eigenen** Werte, **ohne** die spitzen Klammern.
Alle Befehle in dieser Tabelle **zeigen nur etwas an und ändern nichts**. Man führt sie auf dem Server als der Benutzer aus, der Docker bedienen darf.

| Platzhalter | Bedeutung | So findet man ihn heraus | Beispiel |
|---|---|---|---|
| `<backend-container>` | Name des Containers, in dem ERPNext läuft | `docker ps --format '{{.Names}}' \| grep backend` | `erpnext-backend-1` |
| `<site>` | Name der ERPNext-Site, meist die Internetadresse ohne `https://` | `docker exec <backend-container> ls sites`: Gemeint ist der Ordnername, der wie eine Adresse aussieht. `apps.json`, `apps.txt`, `assets` und `common_site_config.json` gehören **nicht** dazu. | `erp.example.com` |
| `<image>` und alter Tag | Image, mit dem ERPNext gerade läuft | `docker ps --format '{{.Names}}  {{.Image}}' \| grep backend`: Was **vor** dem Doppelpunkt steht, ist `<image>`, dahinter steht der **alte Tag**. | `erpnext-custom:16-paypal` → `<image>` = `erpnext-custom`, alter Tag = `16-paypal` |
| `<neuer-tag>` | frei wählbarer Name für das neue Image. Er sollte sich vom alten unterscheiden, damit der Rückweg offen bleibt. | selbst festlegen | `16-plz` |
| `<projekt>` | Name des Docker-Compose-Projekts | `docker inspect <backend-container> --format '{{ index .Config.Labels "com.docker.compose.project" }}'` | `erpnext` |
| `<compose-datei>` | Datei, in der steht, welches Image die Container nutzen | `docker inspect <backend-container> --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}'` | `/home/benutzer/erpnext.yaml` |
| `<frappe_docker-ordner>` | Ordner mit `apps.json` und dem Unterordner `images` | `find ~ -maxdepth 3 -name apps.json -path '*frappe_docker*'`: Gemeint ist der Ordner, in dem die gefundene Datei liegt. | `/home/benutzer/frappe_docker` |

> 💡 **Tipp:** Am besten alle Werte einmal ermitteln und in eine Notiz schreiben. Danach setzt man die Befehle unten fertig zusammen und fügt sie Schritt für Schritt ein.

#### Installation Schritt für Schritt

1. Eine **Sicherung** erstellen. Am Ende erscheint eine „Backup Summary“:
   ```bash
   docker exec <backend-container> bench --site <site> backup --with-files
   ```
2. Eine **Kopie der `apps.json`** anlegen und die Datei danach ansehen:
   ```bash
   cd <frappe_docker-ordner>
   cp apps.json apps.json.vor-plz
   cat apps.json
   ```
   Dann diese Zeile als **letzten Eintrag** ergänzen, z. B. mit `nano apps.json`. Die vorhandenen Einträge bleiben stehen. Achtung: Zwischen den Einträgen steht ein Komma, nach dem letzten keins.
   ```json
   {"url": "https://github.com/aksmhe/plz_ort", "branch": "main"}
   ```
3. Das Image **neu bauen**, im `<frappe_docker-ordner>`. Das dauert etwa 15–30 Minuten. Für ERPNext 16 muss `FRAPPE_BRANCH` auf `version-16` stehen, für ERPNext 15 auf `version-15`.
   ```bash
   docker build \
     --build-arg=FRAPPE_PATH=https://github.com/frappe/frappe \
     --build-arg=FRAPPE_BRANCH=version-16 \
     --secret=id=apps_json,src=apps.json \
     --tag=<image>:<neuer-tag> \
     --file=images/layered/Containerfile .
   ```
4. Das neue Image **prüfen**. Alle bisherigen Apps **und** `plz_ort` müssen in der Liste stehen:
   ```bash
   docker run --rm <image>:<neuer-tag> ls apps
   ```
5. Eine **Kopie der Compose-Datei** anlegen und nachsehen, ob der alte Tag darin steht:
   ```bash
   cp <compose-datei> <compose-datei>.vor-plz
   grep -n "<image>:<alter-tag>" <compose-datei>
   ```
   Dann auf den neuen Tag umstellen und neu starten. ERPNext ist dabei 1–2 Minuten nicht erreichbar:
   ```bash
   sed -i 's/<image>:<alter-tag>/<image>:<neuer-tag>/g' <compose-datei>
   docker compose -p <projekt> -f <compose-datei> up -d
   ```
6. Die App in die Site **installieren** und prüfen:
   ```bash
   docker exec <backend-container> bench --site <site> install-app plz_ort
   docker exec <backend-container> bench --site <site> migrate
   docker exec <backend-container> bench --site <site> list-apps
   ```
   In der Liste muss jetzt `plz_ort` stehen. Nach dem Neustart muss man sich im Browser neu bei ERPNext anmelden.

#### Rückweg, falls etwas nicht klappt

- **Vor Schritt 6:** einfach wieder auf das alte Image umstellen:
  ```bash
  sed -i 's/<image>:<neuer-tag>/<image>:<alter-tag>/g' <compose-datei>
  docker compose -p <projekt> -f <compose-datei> up -d
  ```
- **Nach Schritt 6:** die App zuerst wieder entfernen und danach wie oben zurückstellen:
  ```bash
  docker exec <backend-container> bench --site <site> uninstall-app plz_ort --yes
  ```

#### Auf eine neue Version aktualisieren

Ist `plz_ort` schon installiert, baut man das Image wie in Schritt 3 neu, aber mit **`--no-cache`** und einem **neuen Tag**. Ohne `--no-cache` holt Docker den neuen Code von GitHub nicht.
Danach geht es weiter mit Schritt 4 und 5. Statt `install-app` reicht in Schritt 6 dann:
```bash
docker exec <backend-container> bench --site <site> migrate
```
Zum Schluss die Seite im Browser mit **Strg + Umschalt + R** neu laden.

### Mit bench (klassische Installation)

```bash
bench get-app https://github.com/aksmhe/plz_ort --branch main
bench --site <site> install-app plz_ort
bench --site <site> migrate
bench build --app plz_ort
```

---

## 3. Einrichtung in ERPNext

Die App braucht **keine Einstellungen**. Nach der Installation funktioniert sie sofort.

### 3.1 Altes Client Script abschalten (falls vorhanden)

Wurde die gleiche Funktion vorher als **Client Script** eingerichtet, läuft die Abfrage sonst doppelt.

1. Suchleiste → **Client Script** öffnen.
2. Nach Skripten für den Doctype **Address** suchen, z. B. mit dem Namen „Adresse PLZ Ort“.
3. Skript öffnen, den Haken **Aktiviert** (*Enabled*) herausnehmen und **speichern**.

> Abschalten genügt. Das Skript muss nicht gelöscht werden, so bleibt es als Rückfall erhalten.

### 3.2 Browser neu laden

Damit der Browser das neue Skript lädt, die Seite einmal mit **Strg + Umschalt + R** (Mac: **Cmd + Umschalt + R**) neu laden.

---

## 4. Ausprobieren

1. Suchleiste → **Adresse** → **Neu** (*Add Address*).
2. Bei **Land** `Germany` wählen oder das Feld leer lassen.
   Für die anderen Länder z. B. `Austria` mit PLZ `1010` oder `Switzerland` mit PLZ `8001`.
3. Bei **Postleitzahl** z. B. `61197` eintippen und das Feld verlassen, mit der Tab-Taste oder einem Klick daneben.
4. Bei **Ort** muss jetzt `Florstadt` stehen und bei **Bundesland** `Hessen`.
5. Zum Testen das Formular **ohne Speichern** wieder schließen.

---

## 5. Grenzen

- **Nur vier Länder:** Deutschland, Österreich, Schweiz und Liechtenstein. Für andere Länder füllt die App nichts aus.
- **Höchstens 50 Orte je PLZ:** Mehr liefert die OpenPLZ API auf einmal nicht.
- **Internet nötig:** Die Abfrage läuft **direkt aus dem Browser** des Benutzers zur OpenPLZ API. Blockiert eine Firewall oder ein Werbeblocker `openplzapi.org`, wird nichts ausgefüllt.
- **Nur im Formular:** Beim **Datenimport** (*Data Import*) oder bei Adressen, die über die API angelegt werden, füllt die App nichts aus.
- **Straßennamen** füllt die App nicht aus, nur Ort und Bundesland.
- **Verfügbarkeit:** Die OpenPLZ API ist ein freier Dienst ohne Zusage, dass er immer erreichbar ist. Ist sie nicht erreichbar, passiert einfach nichts. Man kann Ort und Bundesland dann wie gewohnt von Hand eintragen.

---

## 6. Fehlerbehebung

| Was passiert | Ursache | Lösung |
|---|---|---|
| Nach Eingabe der PLZ passiert nichts | Browser hat noch das alte Skript | Seite mit **Strg + Umschalt + R** neu laden |
| Es passiert weiterhin nichts | Feld **Land** steht auf einem anderen Land oder die Ziffernzahl passt nicht | Land auf `Germany`, `Austria`, `Switzerland` oder `Liechtenstein` stellen bzw. leeren und PLZ neu eintippen |
| Es passiert weiterhin nichts | App nicht in der Site installiert | `docker exec <backend-container> bench --site <site> list-apps`: `plz_ort` muss dabei sein, sonst Schritt 6 der Installation wiederholen |
| Es passiert weiterhin nichts | `openplzapi.org` wird blockiert | Im Browser `https://openplzapi.org/de/Localities?postalCode=61197` öffnen. Erscheint kein Text mit „Florstadt“, Firewall oder Werbeblocker prüfen. |
| Auswahlfenster erscheint zweimal oder Felder flackern | Altes Client Script läuft noch | Client Script abschalten, siehe [3.1](#31-altes-client-script-abschalten-falls-vorhanden) |
| Hinweis *„PLZ … nicht gefunden“* | Die PLZ gibt es nicht oder sie ist ganz neu | PLZ prüfen, Ort von Hand eintragen |
| Bundesland bleibt leer | OpenPLZ liefert für diese PLZ kein Bundesland | Bundesland von Hand eintragen |

---

## 7. Datenschutz und Sicherheit

- An die OpenPLZ API wird **nur die Postleitzahl** gesendet. Name, Straße, Firma oder E-Mail bleiben in ERPNext.
- Die App speichert **nichts** selbst. Sie füllt nur Felder im offenen Formular aus. Gespeichert wird erst, wenn der Benutzer auf **Speichern** klickt.
- Die App braucht **keine Zugangsdaten** und keine Schlüssel. Im Code stehen keine Passwörter.
- Die App ändert **keine Rechte** und legt keine neuen Tabellen an.

---

## Lizenz

MIT, siehe [license.txt](license.txt). Das englische Original ist rechtlich verbindlich.
Die deutsche Übersetzung zum besseren Verständnis steht in [license_de.txt](license_de.txt).

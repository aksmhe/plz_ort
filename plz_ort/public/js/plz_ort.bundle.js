// PLZ Ort: Ort und Bundesland/Kanton aus der Postleitzahl füllen.
// Länder: Deutschland, Österreich, Schweiz, Liechtenstein.
// Quelle: OpenPLZ API (https://openplzapi.org). Es wird nur die Postleitzahl gesendet.
//
// Wirkt in allen Formularen UND Dialogen (z. B. Schnellerfassung Kunde/Lieferant),
// in denen ein PLZ-Feld zusammen mit einem Ort-Feld vorkommt. Welche Felder
// zusammengehören, steht in plz_ort.feldpaare. Eigene Paare lassen sich ergänzen:
//
//   plz_ort.feldpaare.push({ plz: "meine_plz", ort: "mein_ort", region: "mein_land", land: ["country"] });

frappe.provide("plz_ort");

// Feldpaare: plz und ort sind Pflicht, region und land optional.
// Bei land zählt das erste Feld, das es im Formular/Dialog gibt.
plz_ort.feldpaare = plz_ort.feldpaare || [
	// Adresse, Schnellerfassung Kunde/Lieferant (dort heißt das Land "country_address")
	{ plz: "pincode", ort: "city", region: "state", land: ["country", "country_address"] },
	// Lager (Warehouse)
	{ plz: "pin", ort: "city", region: "state", land: ["country"] },
];

// Schlüssel = Ländername, wie ERPNext ihn speichert (Doctype Country)
plz_ort.laender = plz_ort.laender || {
	Germany: { api: "de", muster: /^\d{5}$/, region: (x) => x.federalState && x.federalState.name },
	Austria: { api: "at", muster: /^\d{4}$/, region: (x) => x.federalProvince && x.federalProvince.name },
	Switzerland: { api: "ch", muster: /^\d{4}$/, region: (x) => x.canton && x.canton.name },
	// Liechtenstein hat keine Bundesländer
	Liechtenstein: { api: "li", muster: /^\d{4}$/, region: () => "" },
};

// ---------------------------------------------------------------------------
// Einheitlicher Zugriff auf Formular (frm) und Dialog (FieldGroup)

function kontext_formular(frm) {
	return {
		besitzer: frm,
		hat: (f) => !!(f && frm.fields_dict && frm.fields_dict[f]),
		lesen: (f) => frm.doc[f],
		setzen: (f, v) => frm.set_value(f, v),
	};
}

function kontext_dialog(fg) {
	return {
		besitzer: fg,
		hat: (f) => !!(f && fg.fields_dict && fg.fields_dict[f]),
		lesen: (f) => fg.get_value(f),
		setzen: (f, v) => fg.set_value(f, v),
	};
}

// Passendes Feldpaar samt tatsächlich vorhandenem Land-Feld
function paar_aufloesen(k, paar) {
	if (!k.hat(paar.plz) || !k.hat(paar.ort)) return null;
	const land = [].concat(paar.land || []).find((f) => k.hat(f)) || null;
	return {
		plz: paar.plz,
		ort: paar.ort,
		region: k.hat(paar.region) ? paar.region : null,
		land,
	};
}

// Feldpaare, die auf ein geändertes Feld reagieren (als PLZ- oder als Land-Feld)
function betroffene_paare(k, feldname) {
	const treffer = [];
	for (const paar of plz_ort.feldpaare) {
		const p = paar_aufloesen(k, paar);
		if (!p) continue;
		if (p.plz === feldname) treffer.push({ p, art: "plz" });
		else if (p.land === feldname) treffer.push({ p, art: "land" });
	}
	return treffer;
}

function feld_geaendert(k, feldname) {
	for (const { p, art } of betroffene_paare(k, feldname)) {
		if (art === "land") {
			// Land wurde gerade von der App selbst gesetzt: nichts tun
			const merker = k.besitzer.__plz_ort_land;
			if (merker && merker === k.lesen(p.land)) {
				delete k.besitzer.__plz_ort_land;
				continue;
			}
			// Land nachträglich geändert und PLZ schon da: neu suchen
			if (k.lesen(p.plz)) plz_ort.suchen(k, p);
		} else {
			plz_ort.suchen(k, p);
		}
	}
}

// ---------------------------------------------------------------------------
// Suche

plz_ort.suchen = function (k, p) {
	const plz = String(k.lesen(p.plz) || "").trim();
	const land = p.land ? k.lesen(p.land) : null;
	const L = plz_ort.laender;

	// Land gesetzt: nur dieses Land. Land leer: alle Länder, zu denen die PLZ passt.
	let laender;
	if (land) {
		if (!L[land]) return;
		laender = [land];
	} else {
		laender = Object.keys(L);
	}
	laender = laender.filter((l) => L[l].muster.test(plz));
	if (!laender.length) return;

	const abfragen = laender.map((l) => {
		const cfg = L[l];
		// pageSize=50 ist das Maximum der API, sonst kommen nur die ersten 10 Orte
		const url = `https://openplzapi.org/${cfg.api}/Localities?postalCode=${encodeURIComponent(plz)}&page=1&pageSize=50`;
		return fetch(url)
			.then((r) => (r.ok ? r.json() : []))
			.then((list) => (list || []).map((x) => ({ name: x.name, region: cfg.region(x) || "", land: l })))
			.catch(() => []);
	});

	return Promise.all(abfragen).then((ergebnisse) => {
		// PLZ inzwischen geändert: altes Ergebnis verwerfen
		if (String(k.lesen(p.plz) || "").trim() !== plz) return;

		// gleiche Orte (Land + Name) nur einmal anbieten
		const orte = [...new Map(ergebnisse.flat().map((x) => [x.land + "|" + x.name, x])).values()];

		if (!orte.length) {
			frappe.show_alert({ message: __("PLZ {0} nicht gefunden", [plz]), indicator: "orange" });
			return;
		}

		const uebernehmen = (x) => {
			const ort = k.lesen(p.ort) || "";
			// Ortsteil behalten, z. B. "Selm Bork" bei Ort "Selm"
			if (!ort || !ort.toLowerCase().includes(x.name.toLowerCase())) {
				k.setzen(p.ort, x.name);
			}
			if (p.region) k.setzen(p.region, x.region);
			if (p.land && k.lesen(p.land) !== x.land) {
				// verhindert, dass der Länderwechsel die Suche gleich noch einmal startet
				k.besitzer.__plz_ort_land = x.land;
				k.setzen(p.land, x.land);
			}
		};

		if (orte.length === 1) {
			uebernehmen(orte[0]);
			return;
		}

		// Bei mehreren Ländern das Land mit anzeigen
		const mehrereLaender = new Set(orte.map((x) => x.land)).size > 1;
		const beschriftung = (x) => (mehrereLaender ? `${x.name} (${__(x.land)})` : x.name);

		const d = new frappe.ui.Dialog({
			title: __("Ort zur PLZ {0} wählen", [plz]),
			fields: [
				{
					fieldname: "ort",
					fieldtype: "Select",
					label: __("Ort"),
					reqd: 1,
					options: orte.map(beschriftung).join("\n"),
				},
			],
			primary_action_label: __("Übernehmen"),
			primary_action(v) {
				uebernehmen(orte.find((x) => beschriftung(x) === v.ort));
				d.hide();
			},
		});
		d.show();
	});
};

// ---------------------------------------------------------------------------
// Einhängen: Formulare

(function () {
	const SM = frappe.ui.form.ScriptManager;
	if (!SM || SM.prototype.__plz_ort) return;
	const original = SM.prototype.trigger;
	SM.prototype.trigger = function (event_name, doctype, name) {
		const ergebnis = original.apply(this, arguments);
		try {
			const frm = this.frm;
			// nur Felder des Hauptdokuments, keine Kindtabellen
			if (frm && frm.doc && (!doctype || doctype === frm.doctype) && typeof event_name === "string") {
				feld_geaendert(kontext_formular(frm), event_name);
			}
		} catch (e) {
			console.error("plz_ort:", e);
		}
		return ergebnis;
	};
	SM.prototype.__plz_ort = true;
})();

// ---------------------------------------------------------------------------
// Einhängen: Dialoge (z. B. Schnellerfassung Kunde/Lieferant)

(function () {
	const FG = frappe.ui.FieldGroup;
	if (!FG || FG.prototype.__plz_ort) return;
	const original = FG.prototype.make;
	FG.prototype.make = function () {
		const ergebnis = original.apply(this, arguments);
		try {
			dialog_ueberwachen(this);
		} catch (e) {
			console.error("plz_ort:", e);
		}
		return ergebnis;
	};
	FG.prototype.__plz_ort = true;

	function dialog_ueberwachen(fg) {
		const k = kontext_dialog(fg);
		const felder = new Set();
		for (const paar of plz_ort.feldpaare) {
			const p = paar_aufloesen(k, paar);
			if (!p) continue;
			felder.add(p.plz);
			if (p.land) felder.add(p.land);
		}
		felder.forEach((f) => {
			const df = fg.fields_dict[f].df;
			if (df.__plz_ort) return;
			const bisher = df.change || df.onchange;
			const neu = function () {
				const r = bisher ? bisher.apply(this, arguments) : undefined;
				feld_geaendert(k, f);
				return r;
			};
			// Frappe ruft df.change bevorzugt vor df.onchange auf
			if (df.change) df.change = neu;
			else df.onchange = neu;
			df.__plz_ort = true;
		});
	}
})();

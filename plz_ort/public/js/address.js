// PLZ Ort: Ort und Bundesland/Kanton aus der Postleitzahl füllen.
// Länder: Deutschland, Österreich, Schweiz, Liechtenstein.
// Quelle: OpenPLZ API (https://openplzapi.org). Es wird nur die Postleitzahl gesendet.

// In eine Funktion gepackt, damit nichts doppelt deklariert wird, wenn ERPNext das Skript erneut lädt.
(() => {
	// Schlüssel = Ländername, wie ERPNext ihn speichert (Doctype Country)
	const PLZ_ORT_LAENDER = {
		Germany: { api: "de", muster: /^\d{5}$/, region: (x) => x.federalState && x.federalState.name },
		Austria: { api: "at", muster: /^\d{4}$/, region: (x) => x.federalProvince && x.federalProvince.name },
		Switzerland: { api: "ch", muster: /^\d{4}$/, region: (x) => x.canton && x.canton.name },
		// Liechtenstein hat keine Bundesländer
		Liechtenstein: { api: "li", muster: /^\d{4}$/, region: () => "" },
	};

	function plz_ort_suchen(frm) {
		const plz = (frm.doc.pincode || "").trim();
		const land = frm.doc.country;

		// Land gesetzt: nur dieses Land. Land leer: alle Länder, zu denen die PLZ passt.
		let laender;
		if (land) {
			if (!PLZ_ORT_LAENDER[land]) return;
			laender = [land];
		} else {
			laender = Object.keys(PLZ_ORT_LAENDER);
		}
		laender = laender.filter((l) => PLZ_ORT_LAENDER[l].muster.test(plz));
		if (!laender.length) return;

		const abfragen = laender.map((l) => {
			const cfg = PLZ_ORT_LAENDER[l];
			// pageSize=50 ist das Maximum der API, sonst kommen nur die ersten 10 Orte
			const url = `https://openplzapi.org/${cfg.api}/Localities?postalCode=${encodeURIComponent(plz)}&page=1&pageSize=50`;
			return fetch(url)
				.then((r) => (r.ok ? r.json() : []))
				.then((list) => (list || []).map((x) => ({ name: x.name, region: cfg.region(x) || "", land: l })))
				.catch(() => []);
		});

		Promise.all(abfragen).then((ergebnisse) => {
			// gleiche Orte (Land + Name) nur einmal anbieten
			const orte = [...new Map(ergebnisse.flat().map((x) => [x.land + "|" + x.name, x])).values()];

			if (!orte.length) {
				frappe.show_alert({ message: __("PLZ {0} nicht gefunden", [plz]), indicator: "orange" });
				return;
			}

			const uebernehmen = (x) => {
				const ort = frm.doc.city || "";
				// Ortsteil behalten, z. B. "Selm Bork" bei Ort "Selm"
				if (!ort || !ort.toLowerCase().includes(x.name.toLowerCase())) {
					frm.set_value("city", x.name);
				}
				frm.set_value("state", x.region);
				if (frm.doc.country !== x.land) {
					// verhindert, dass der Länderwechsel die Suche gleich noch einmal startet
					frm.__plz_ort_land = x.land;
					frm.set_value("country", x.land);
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
	}

	frappe.ui.form.on("Address", {
		pincode(frm) {
			plz_ort_suchen(frm);
		},
		country(frm) {
			// Land wurde gerade von der App selbst gesetzt: nichts tun
			if (frm.__plz_ort_land && frm.__plz_ort_land === frm.doc.country) {
				delete frm.__plz_ort_land;
				return;
			}
			// Land nachträglich geändert und PLZ schon da: neu suchen
			if (frm.doc.pincode) plz_ort_suchen(frm);
		},
	});
})();

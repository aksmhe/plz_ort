// PLZ Ort: Ort und Bundesland aus der deutschen Postleitzahl füllen.
// Quelle: OpenPLZ API (https://openplzapi.org). Es wird nur die Postleitzahl gesendet.

frappe.ui.form.on("Address", {
	pincode(frm) {
		const plz = (frm.doc.pincode || "").trim();
		if (!/^\d{5}$/.test(plz)) return;
		if (frm.doc.country && frm.doc.country !== "Germany") return;

		fetch("https://openplzapi.org/de/Localities?postalCode=" + plz)
			.then((r) => (r.ok ? r.json() : []))
			.then((list) => {
				if (!list || !list.length) {
					frappe.show_alert({ message: __("PLZ {0} nicht gefunden", [plz]), indicator: "orange" });
					return;
				}

				// gleiche Ortsnamen nur einmal anbieten
				const orte = [...new Map(list.map((x) => [x.name, x])).values()];

				const uebernehmen = (x) => {
					const ort = frm.doc.city || "";
					// Ortsteil behalten, z. B. "Selm Bork" bei Ort "Selm"
					if (!ort || !ort.toLowerCase().includes(x.name.toLowerCase())) {
						frm.set_value("city", x.name);
					}
					if (x.federalState && x.federalState.name) {
						frm.set_value("state", x.federalState.name);
					}
					if (!frm.doc.country) frm.set_value("country", "Germany");
				};

				if (orte.length === 1) {
					uebernehmen(orte[0]);
					return;
				}

				const d = new frappe.ui.Dialog({
					title: __("Ort zur PLZ {0} wählen", [plz]),
					fields: [
						{
							fieldname: "ort",
							fieldtype: "Select",
							label: __("Ort"),
							reqd: 1,
							options: orte.map((x) => x.name).join("\n"),
						},
					],
					primary_action_label: __("Übernehmen"),
					primary_action(v) {
						uebernehmen(orte.find((x) => x.name === v.ort));
						d.hide();
					},
				});
				d.show();
			})
			.catch(() => {});
	},
});

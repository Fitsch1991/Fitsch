import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import ical from 'ical';
import { supabase } from './supabaseClient.js';

const app = express();
const port = process.env.PORT || 3000;

/* -------------------------
   BASIC ROUTES
--------------------------*/

app.get('/ping', (req, res) => {
    res.send('pong');
});

app.get('/', (req, res) => {
    res.send('✅ iCal Sync läuft!');
});

/* -------------------------
   START SERVER
--------------------------*/

app.listen(port, () => {
    console.log(`🚀 Server läuft auf Port ${port}`);

    // Start verzögert (wichtig für Stabilität)
    setTimeout(() => {
        console.log("🔄 Initialer iCal Sync startet...");
        fetchBookings();

        setInterval(() => {
            fetchBookings();
        }, 60 * 60 * 1000);

    }, 5000);
});

/* -------------------------
   KEEP ALIVE (optional)
--------------------------*/

function keepAlive() {
    const url = `http://localhost:${port}/ping`;

    fetch(url)
        .then(res => res.text())
        .then(text => console.log(`KeepAlive: ${text}`))
        .catch(err => console.error(`KeepAlive error: ${err.message}`));
}

setInterval(keepAlive, 14 * 60 * 1000);

/* -------------------------
   LOAD ICAL URLS
--------------------------*/

const icalUrls = Object.keys(process.env)
    .filter(key => key.startsWith("ICAL_URL_"))
    .map(key => process.env[key])
    .filter(url => url && url.startsWith("http"));

/* -------------------------
   GUEST HANDLING
--------------------------*/

async function getOrCreateGastId(gastName) {
    try {
        let { data } = await supabase
            .from('gaeste')
            .select('id')
            .ilike('nachname', `%${gastName}%`)
            .maybeSingle();

        if (data) return data.id;

        const { data: newGast } = await supabase
            .from('gaeste')
            .insert([{ nachname: gastName }])
            .select('id')
            .single();

        return newGast?.id || null;

    } catch (err) {
        console.error("Gast Fehler:", err.message);
        return null;
    }
}

/* -------------------------
   ICAL SYNC (CRASH SAFE)
--------------------------*/

async function fetchBookings() {
    try {
        console.log("🔄 iCal Sync gestartet");

        if (!icalUrls.length) {
            console.log("⚠️ Keine ICAL URLs gesetzt");
            return;
        }

        let allBookings = [];

        for (let index = 0; index < icalUrls.length; index++) {
            const url = icalUrls[index];

            try {
                console.log(`📡 Quelle ${index + 1}: ${url}`);

                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const text = await response.text();

                if (!text.includes("BEGIN:VCALENDAR")) {
                    throw new Error("Kein gültiger iCal Inhalt");
                }

                const parsed = ical.parseICS(text);

                for (const event of Object.values(parsed)) {
                    if (!event.start || !event.end || !event.summary) continue;

                    const gastId = await getOrCreateGastId(event.summary);

                    allBookings.push({
                        zimmer_id: index + 1,
                        check_in: event.start.toISOString(),
                        check_out: event.end.toISOString(),
                        gast_id: gastId,
                        anzahl_personen: 2,
                        preis_pro_person: 0,
                        anzahlung: 0,
                        status: 'booking',
                        verpflegung: 'Frühstück',
                        hund: false,
                        zusatz_preis: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
                }

                console.log(`✅ Quelle ${index + 1} OK`);

            } catch (err) {
                console.error(`❌ Quelle ${index + 1} FEHLER: ${url}`);
                console.error(err.message);
                continue; // WICHTIG: verhindert Crash
            }
        }

        if (allBookings.length > 0) {
            console.log(`💾 Speichere ${allBookings.length} Buchungen...`);

            const { error } = await supabase
                .from('buchungen')
                .upsert(allBookings, {
                    onConflict: ['zimmer_id', 'check_in']
                });

            if (error) {
                console.error("Supabase Fehler:", error.message);
            } else {
                console.log("✅ Speicherung erfolgreich");
            }
        } else {
            console.log("ℹ️ Keine Buchungen gefunden");
        }

    } catch (err) {
        console.error("💥 GLOBALER SYNC FEHLER (Server läuft weiter):", err.message);
    }
}

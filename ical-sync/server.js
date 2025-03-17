import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import ical from 'ical';
import { supabase } from './supabaseClient.js';

// Express-Server initialisieren
const app = express();
const port = process.env.PORT || 3000;

// /ping-Endpunkt zum Keep-Alive
app.get('/ping', (req, res) => {
    res.send('pong');
});

app.listen(port, () => {
    console.log(`Server läuft auf Port ${port}`);
});

// Keep-Alive-Funktion, die den /ping-Endpunkt alle 14 Minuten aufruft
function keepAlive() {
    const url = `http://localhost:${port}/ping`;
    fetch(url)
        .then(res => res.text())
        .then(text => console.log(`KeepAlive ping response: ${text}`))
        .catch(err => console.error(`KeepAlive error: ${err.message}`));
}
setInterval(keepAlive, 14 * 60 * 1000); // 14 Minuten in Millisekunden

// Lade alle iCal-URLs aus der .env-Datei dynamisch
const icalUrls = Object.keys(process.env)
    .filter(key => key.startsWith("ICAL_URL_"))
    .map(key => process.env[key])
    .filter(Boolean); // Entfernt leere Werte

// Funktion zum Abrufen oder Erstellen der Gast-ID basierend auf dem Namen
async function getOrCreateGastId(gastName) {
    let { data, error } = await supabase
        .from('gaeste')
        .select('id')
        .ilike('nachname', `%${gastName}%`)
        .maybeSingle();
    
    if (error) {
        console.error(`⚠️ Fehler beim Abrufen der Gast-ID für ${gastName}:`, error.message);
        return null;
    }
    
    if (data) {
        return data.id;
    }
    
    console.log(`➕ Neuer Gast wird erstellt: ${gastName}`);
    const { data: newGast, error: insertError } = await supabase
        .from('gaeste')
        .insert([{ nachname: gastName }])
        .select('id')
        .single();
    
    if (insertError) {
        console.error(`❌ Fehler beim Erstellen des neuen Gasts ${gastName}:`, insertError.message);
        return null;
    }
    
    return newGast.id;
}

// Funktion zum Abrufen und Speichern der iCal-Daten
async function fetchBookings() {
    console.log("🔄 Starte iCal-Synchronisation...");
    let allBookings = [];
    let existingBookings = new Set();

    await Promise.all(icalUrls.map(async (url, index) => {
        console.log(`📡 Abrufen von: ${url}`);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP-Fehler! Status: ${response.status}`);
            }
            const icalData = await response.text();
            const parsedData = ical.parseICS(icalData);

            for (const event of Object.values(parsedData)) {
                if (event.start && event.end && event.summary) { 
                    console.log("📅 Gefundene Buchung:", event);
                    
                    // Gast-ID abrufen oder neuen Gast erstellen
                    const gastId = await getOrCreateGastId(event.summary);
                    
                    // Erstelle einen eindeutigen Key für die Buchung
                    const bookingKey = `${index + 1}_${event.start.toISOString()}_${event.end.toISOString()}`;
                    
                    // Prüfen, ob Buchung bereits existiert
                    if (!existingBookings.has(bookingKey)) {
                        existingBookings.add(bookingKey);
                        
                        allBookings.push({
                            zimmer_id: index + 1, // Zimmernummer basierend auf Reihenfolge
                            check_in: event.start.toISOString(),
                            check_out: event.end.toISOString(),
                            gast_id: gastId,
                            anzahl_personen: 2, // Standardwert
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
                }
            }
        } catch (error) {
            console.error(`⚠️ Fehler beim Abrufen von ${url}:`, error.message);
        }
    }));

    if (allBookings.length > 0) {
        console.log("💾 Speichere Buchungen in Supabase...");
        const { data, error } = await supabase
            .from('buchungen')
            .upsert(allBookings, { onConflict: ['zimmer_id', 'check_in'] });
        if (error) {
            console.error("❌ Fehler beim Speichern in Supabase:", error.message);
        } else {
            console.log("✅ Buchungen erfolgreich in Supabase gespeichert.");
        }
    } else {
        console.log("ℹ️ Keine neuen Buchungen gefunden.");
    }
}

// Starte die erste Synchronisation und setze den Wiederholungsintervall auf 60 Minuten
fetchBookings();
setInterval(fetchBookings, 60 * 60 * 1000);

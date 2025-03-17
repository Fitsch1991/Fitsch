import 'dotenv/config';
import fetch from 'node-fetch';
import ical from 'ical';
import { supabase } from './supabaseClient.js'; // Importiere Supabase aus supabaseClient.js

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
    
    // Falls Gast nicht existiert, neuen Gast erstellen
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
                            preis_pro_person: 0, // Falls benötigt, später anpassbar
                            anzahlung: 0, // Standardwert
                            status: 'booking',
                            verpflegung: 'Frühstück', // Standardwert
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
        const { data, error } = await supabase.from('buchungen').upsert(allBookings, { onConflict: ['zimmer_id', 'check_in'] });
        if (error) {
            console.error("❌ Fehler beim Speichern in Supabase:", error.message);
        } else {
            console.log("✅ Buchungen erfolgreich in Supabase gespeichert.");
        }
    } else {
        console.log("ℹ️ Keine neuen Buchungen gefunden.");
    }
}

// Starte die Synchronisation
fetchBookings();

// Falls du es jede Stunde automatisch starten willst:
setInterval(fetchBookings, 60 * 60 * 1000); // Alle 60 Minuten

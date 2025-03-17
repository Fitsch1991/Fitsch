import express from 'express';
import ical from 'ical-generator';
import { supabase } from './supabaseClient.js'; // ✅ Richtiger relativer Pfad

const app = express();
const port = process.env.PORT || 3000;

app.get('/api/ical/room/:roomId.ics', async (req, res) => {
    const { roomId } = req.params;

    // iCal-Kalender für das Zimmer erstellen
    const cal = ical({ name: `Zimmer ${roomId} Belegung` });

    try {
        // Buchungen aus Supabase für das Zimmer abrufen
        const { data: bookings, error } = await supabase
            .from('buchungen')
            .select('*')
            .eq('zimmer_id', roomId);

        if (error) {
            throw error;
        }

        // Falls keine Buchungen vorhanden sind
        if (!bookings || bookings.length === 0) {
            console.log(`ℹ️ Keine Buchungen für Zimmer ${roomId}`);
        }

        // Buchungen in iCal-Format umwandeln
        bookings.forEach(booking => {
            cal.createEvent({
                start: new Date(booking.check_in),
                end: new Date(booking.check_out),
                summary: `Belegt (${booking.personenanzahl} Personen)`,
                location: `Zimmer ${roomId}`,
                description: `Buchung von Gast-ID: ${booking.gast_id}`,
            });
        });

        // iCal-Datei als Antwort senden
        res.setHeader('Content-Type', 'text/calendar');
        res.send(cal.toString());
    } catch (error) {
        console.error(`⚠️ Fehler beim Abrufen der Buchungen für Zimmer ${roomId}:`, error.message);
        res.status(500).send('Interner Serverfehler');
    }
});

app.listen(port, () => {
    console.log(`📅 iCal-Export läuft auf Port ${port}`);
});

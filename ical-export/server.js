import express from 'express';
import ical from 'ical-generator';
import { supabase } from './supabaseClient.js';
import http from 'http'; // Importiert das eingebaute http-Modul

const app = express();
const port = process.env.PORT || 3000;

// Neuer /ping Endpunkt, der einfach "pong" zurückgibt
app.get('/ping', (req, res) => {
    res.send('pong');
});

// iCal-Route
app.get('/api/ical/room/:roomId.ics', async (req, res) => {
    const { roomId } = req.params;
    const cal = ical({ name: `Zimmer ${roomId} Belegung` });

    try {
        const { data: bookings, error } = await supabase
            .from('buchungen')
            .select('*')
            .eq('zimmer_id', roomId);

        if (error) {
            throw error;
        }

        if (!bookings || bookings.length === 0) {
            console.log(`ℹ️ Keine Buchungen für Zimmer ${roomId}`);
        }

        bookings.forEach(booking => {
            cal.createEvent({
                start: new Date(booking.check_in),
                end: new Date(booking.check_out),
                summary: `Belegt (${booking.personenanzahl} Personen)`,
                location: `Zimmer ${roomId}`,
                description: `Buchung von Gast-ID: ${booking.gast_id}`,
            });
        });

        res.setHeader('Content-Type', 'text/calendar');
        res.send(cal.toString());
    } catch (error) {
        console.error(`⚠️ Fehler beim Abrufen der Buchungen für Zimmer ${roomId}:`, error.message);
        res.status(500).send('Interner Serverfehler');
    }
});

// Startet den Server
app.listen(port, () => {
    console.log(`📅 iCal-Export läuft auf Port ${port}`);
});

// Funktion, die den /ping Endpunkt anpingt
function keepAlive() {
    const url = `http://localhost:${port}/ping`;
    http.get(url, (res) => {
        console.log(`KeepAlive ping response: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error(`KeepAlive error: ${err.message}`);
    });
}

// Ruft die keepAlive-Funktion alle 14 Minuten auf (14 * 60 * 1000 Millisekunden)
setInterval(keepAlive, 14 * 60 * 1000);

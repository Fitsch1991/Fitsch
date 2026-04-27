import express from 'express';
import ical from 'ical-generator';
import { supabase } from './supabaseClient.js';
import http from 'http';

const app = express();
const port = process.env.PORT || 3000;

app.get('/ping', (req, res) => {
    res.send('pong');
});

app.get('/api/ical/room/:roomId.ics', async (req, res) => {
    const { roomId } = req.params;

    const cal = ical({
        name: `Zimmer ${roomId} Belegung`,
        prodId: {
            company: 'Oberraut',
            product: 'Hotelverwaltung',
            language: 'DE'
        }
    });

    try {
        const { data: bookings, error } = await supabase
            .from('buchungen')
            .select('*')
            .eq('zimmer_id', Number(roomId))
            .is('deleted_at', null);

        if (error) throw error;

        bookings.forEach((booking) => {
            const updatedAt = booking.updated_at
                ? new Date(booking.updated_at)
                : new Date();

            cal.createEvent({
                id: `${booking.id}-${booking.zimmer_id}-${booking.updated_at}`,
                start: new Date(booking.check_in),
                end: new Date(booking.check_out),
                summary: `Belegt (${booking.anzahl_personen ?? ''} Personen)`,
                location: `Zimmer ${booking.zimmer_id}`,
                description: `Buchung von Gast-ID: ${booking.gast_id ?? ''}`,
                lastModified: updatedAt,
                stamp: updatedAt
            });
        });

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="zimmer-${roomId}.ics"`);
        res.send(cal.toString());

    } catch (error) {
        console.error(`⚠️ Fehler beim Abrufen der Buchungen für Zimmer ${roomId}:`, error.message);
        res.status(500).send('Interner Serverfehler');
    }
});

app.listen(port, () => {
    console.log(`📅 iCal-Export läuft auf Port ${port}`);
});

function keepAlive() {
    const url = `http://localhost:${port}/ping`;

    http.get(url, (res) => {
        console.log(`KeepAlive ping response: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error(`KeepAlive error: ${err.message}`);
    });
}

setInterval(keepAlive, 14 * 60 * 1000);

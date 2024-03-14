const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
const database = require('./database'); // Ensure this points to your actual database connection setup

app.get('/', async (req, res) => {
    try {
        let [rows] = await database.query('SELECT * FROM time_entries ORDER BY datum DESC, inklok_tijd DESC');

        // Correctly format datum as a string in YYYY-MM-DD format
        rows = rows.map(row => {
            let formattedDatum = '';
            if (row.datum instanceof Date) {
                // If datum is a Date object, format it to YYYY-MM-DD
                formattedDatum = row.datum.toISOString().split('T')[0];
            } else if (typeof row.datum === 'string') {
                // If datum is already a string, assume it's in the correct format
                formattedDatum = row.datum;
            }
            return { ...row, datum: formattedDatum };
        });

        res.render('index', { data: rows });
    } catch (err) {
        console.error(err);
        res.send('Error fetching data');
    }
});


app.post('/inklokken', async (req, res) => {
    const clientTime = new Date(req.body.clientTime);
    const datum = `${clientTime.getFullYear()}-${(clientTime.getMonth() + 1).toString().padStart(2, '0')}-${clientTime.getDate().toString().padStart(2, '0')}`;
    const inklok_tijd = `${clientTime.getHours().toString().padStart(2, '0')}:${clientTime.getMinutes().toString().padStart(2, '0')}:${clientTime.getSeconds().toString().padStart(2, '0')}`;

    try {
        await database.query('INSERT INTO time_entries (datum, inklok_tijd) VALUES (?, ?)', [datum, inklok_tijd]);
        console.log(`Clocked in with date: ${datum} and time: ${inklok_tijd}`);  // Logs only the date and time in the desired format.
        res.json({ success: true, datum, inklok_tijd });  // Sends back only the date and time in the desired format.
    } catch (err) {
        console.error("Error in /inklokken:", err.message);
        res.json({ success: false, message: 'Failed to clock in.' });
    }
});



app.post('/uitklokken', async (req, res) => {
    try {
        const [latestEntry] = await database.query('SELECT * FROM time_entries WHERE uitklok_tijd IS NULL ORDER BY datum DESC, inklok_tijd DESC LIMIT 1');

        if (latestEntry.length === 0) {
            return res.json({ success: false, message: 'No clock-in record found to clock out.' });
        }

        const clientTime = new Date(req.body.clientTime);
        const datum = `${clientTime.getFullYear()}-${(clientTime.getMonth() + 1).toString().padStart(2, '0')}-${clientTime.getDate().toString().padStart(2, '0')}`;
        const uitklokTime = `${clientTime.getHours().toString().padStart(2, '0')}:${clientTime.getMinutes().toString().padStart(2, '0')}:${clientTime.getSeconds().toString().padStart(2, '0')}`;
        //const uitklokTime = new Date().toISOString().split('T')[1].substring(0, 8); // UTC time without timezone
        //const clientTime = new Date(req.body.clientTime);
        //const datum = clientTime.toISOString().split('T')[0];
        const result = await database.query('UPDATE time_entries SET uitklok_tijd = ? WHERE entry_id = ?', [uitklokTime, latestEntry[0].entry_id]);
        console.log(`Clocked out at: ${uitklokTime} on ${datum}`);

        if (result.affectedRows === 0) {
            return res.json({ success: false, message: 'Failed to clock out. No entry was updated.' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Error updating the uitklok_tijd:", err);
        res.json({ success: false, message: `Failed to clock out. Error: ${err.message}` });
    }
});

app.post('/resetEntries', async (req, res) => {
    try {
        await database.query('DELETE FROM time_entries');
        await database.query('ALTER TABLE time_entries AUTO_INCREMENT = 1')
        console.log('All entries have been reset');
        res.json({ success: true, message: 'All entries have been reset.' });
    } catch (err) {
        console.error("Error resetting entries:", err.message);
        res.json({ success: false, message: `Failed to reset entries. Error: ${err.message}` });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { check, validationResult } = require('express-validator');

const app = express();

app.use(cors({
    origin: '*',
}));

app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('API de presentismo');
});

app.post('/submit-attendance', [
    check('employeeName').isString().notEmpty(),
    check('timestamp').isISO8601(),
    check('latitude').isFloat(),
    check('longitude').isFloat(),
    check('actionType').isString().notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { employeeName, timestamp, latitude, longitude, actionType } = req.body;

    try {
        const data = {
            parent: { database_id: process.env.NOTION_DATABASE_ID },
            properties: {
                'Nombre': {
                    select: { name: employeeName },  // Cambiado de title a select
                },
                'Fecha': {
                    date: { start: timestamp },
                },
                'Ubicacion': {
                    rich_text: [{ text: { content: `Latitud: ${latitude}, Longitud: ${longitude}` } }],
                },
                'Hora': {
                    rich_text: [{ text: { content: new Date().toLocaleTimeString() } }],
                },
                'Accion': {
                    select: { name: actionType }
                }
            }
        };

        const notionResponse = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify(data)
        });

        const notionData = await notionResponse.json();

        if (!notionResponse.ok) {
            console.error('Notion API error:', notionData);
            throw new Error(`Error from Notion: ${notionResponse.statusText}`);
        }

        res.status(200).json(notionData);
    } catch (error) {
        console.error('Error en el backend:', error);
        res.status(500).json({ message: 'Failed to record attendance.', error: error.message });
    }
});

// Escuchar en el puerto proporcionado por Render o en 3001 si se ejecuta localmente
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

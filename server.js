require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const cors = require('cors');
const { check, validationResult } = require('express-validator');

const app = express();

// Configuración básica de CORS
app.use(cors({
    origin: '*', 
}));

app.use(bodyParser.json());

// Ruta para la raíz (inicio) de la aplicación
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
        const geocodingUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=20&addressdetails=1`;
        const geocodingResponse = await fetch(geocodingUrl);

        // Verificar si el tipo de contenido es JSON
        if (!geocodingResponse.headers.get('content-type')?.includes('application/json')) {
            throw new Error('La respuesta no es JSON. Verifica el límite de uso o si la API está disponible.');
        }

        const geocodingData = await geocodingResponse.json();

        let locationName = 'Ubicación desconocida';
        if (geocodingData && geocodingData.display_name) {
            locationName = geocodingData.display_name;
        }

        const data = {
            parent: { database_id: process.env.NOTION_DATABASE_ID },
            properties: {
                'Nombre': {
                    title: [{ text: { content: employeeName } }],
                },
                'Fecha': {
                    date: { start: timestamp },
                },
                'ubicacion': {
                    rich_text: [{ text: { content: locationName } }],
                },
                'hora': {
                    rich_text: [{ text: { content: new Date().toLocaleTimeString() } }],
                },
                'accion': {
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
            console.error('Error en la API de Notion:', notionData);
            throw new Error(`Error de Notion: ${notionResponse.statusText}`);
        }

        res.status(200).json(notionData);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'No se pudo registrar la asistencia.', error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Servidor corriendo en https://localhost:3000');
});

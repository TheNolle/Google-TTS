import express from 'express'
import bodyParser from 'body-parser'
import path from 'path'
import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech'
import WebSocket from 'ws'
import http from 'http'


console.clear()


const app = express()
const PORT = 26000

const server = http.createServer(app)
const wss = new WebSocket.Server({ noServer: true })
const client = new TextToSpeechClient({ keyFilename: path.join(__dirname, '../credentials.json') })


wss.on('connection', (ws, request) => {
    console.log(`[${new Date().toISOString()}] Client connected from IP: ${request.socket.remoteAddress}`);
})


app.use(express.static(path.join(__dirname, '../public')))
app.use(bodyParser.json())


app.post('/generate', async (request, response) => {
    const timestampStart = Date.now()
    const ip = request.headers['x-forwarded-for'] || request.connection.remoteAddress
    console.log(`[${new Date().toISOString()}] Request to generate speech from IP: ${ip}`)

    const { text, voice: name } = request.body
    const languageCode = name.substring(0, 5)

    const byteSizeLimit = 5000
    const textChunks = []
    let startIdx = 0

    while (startIdx < text.length) {
        let endIdx = startIdx + byteSizeLimit
        if (Buffer.from(text.substring(startIdx, endIdx)).length > byteSizeLimit) while (Buffer.from(text.substring(startIdx, endIdx)).length > byteSizeLimit) endIdx--
        textChunks.push(text.substring(startIdx, endIdx))
        startIdx = endIdx
    }

    let audioData: Buffer[] = []
    let progress = 0
    const totalChunks = textChunks.length

    for (const chunk of textChunks) {
        const req: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
            input: { text: chunk },
            voice: { name, languageCode },
            audioConfig: { audioEncoding: 'MP3' },
        }

        try {
            const [audioResponse] = await client.synthesizeSpeech(req)
            audioData.push(audioResponse.audioContent as Buffer)

            progress++
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'progress',
                        data: `${((progress / totalChunks) * 100).toFixed(2)}%`
                    }))
                }
            })

            console.log(`[${new Date().toISOString()}] Speech generation progress: ${progress}/${totalChunks}`)
        } catch (error) {
            response.status(500).send('Failed to generate speech for a chunk')
            console.error(`[${new Date().toISOString()}] Failed to generate speech for a chunk:`, error)
            return
        }
    }

    response.set('Content-Type', 'audio/mp3')
    response.send(Buffer.concat(audioData))

    const timestampEnd = Date.now()
    const duration = (timestampEnd - timestampStart) / 1000
    console.log(`[${new Date().toISOString()}] Speech generation for IP: ${ip} completed in ${duration} seconds.`)
})

app.get('/voices', async (request: express.Request, response: express.Response) => {
    try {
        const ip = request.headers['x-forwarded-for'] || request.connection.remoteAddress
        console.log(`[${new Date().toISOString()}] Request to fetch voices from IP: ${ip}`)
        const [voiceList] = await client.listVoices({})
        const voices = voiceList.voices!.map(voice => ({ name: voice.name, lang: voice.languageCodes![0] }))
        response.json(voices)
        console.log(`[${new Date().toISOString()}] Voices fetched for IP: ${ip}`)
    } catch (error) {
        response.status(500).send('Failed to fetch voices')
        console.error(`[${new Date().toISOString()}] Failed to fetch voices:`, error)
    }
})


server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
    })
})


server.listen(PORT, () => {
    console.log(`TTS WebApp server listening on port ${PORT}!`)
    testGoogleCloudCredentials()
})

async function testGoogleCloudCredentials() {
    try {
        await client.listVoices({})
        console.log(`Successfully logged into Google Cloud Text-to-Speech for key file: ${path.join(__dirname, '../credentials.json')}`)
    } catch (error: any) {
        console.error('Failed to log into Google Cloud Text-to-Speech. Please check your credentials.')
        console.error(error.message)
    }
}

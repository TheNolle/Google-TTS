const form = document.getElementById('form')
const textArea = document.getElementById('text')
const audioPlayer = document.getElementById('audio')
const voiceDropdown = document.getElementById('voices')
const progressElement = document.getElementById('progress')
const ws = new WebSocket(`wss://${window.location.host}/ws`)

ws.onmessage = function (event) {
    const data = JSON.parse(event.data)
    if (data.type === 'progress') progressElement.textContent = `Generation Progress: ${data.data}`
}

form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const textValue = textArea.value.trim()
    const voiceName = voiceDropdown.value

    if (!textValue) return console.error('Text is missing!')

    try {
        progressElement.textContent = 'Starting generation...'
        const response = await fetch('/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: textValue, voice: voiceName })
        })

        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        audioPlayer.src = audioUrl
        audioPlayer.play()

    } catch (error) {
        console.error('Error generating speech:', error)
    }
})

document.addEventListener('DOMContentLoaded', populateVoiceDropdown)

function populateVoiceDropdown() {
    fetch('/voices').then(response => response.json()).then(data => {
        data.forEach(voice => {
            const option = document.createElement('option')
            option.value = voice.name
            option.textContent = `${voice.name} (${voice.lang})`
            voiceDropdown.appendChild(option)
        })
    }).catch(error => {
        console.error('Error fetching voices:', error)
    })
}

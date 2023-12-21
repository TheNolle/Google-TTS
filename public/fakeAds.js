const adsBanner = document.getElementById('ad-banner')

const ads = [
    'https://i.imgur.com/3CHncyq.png',
]

const getRandomAds = () => {
    return ads[Math.floor(Math.random() * ads.length)]
}

document.addEventListener('DOMContentLoaded', () => {
    const ads = getRandomAds()
    adsBanner.style.backgroundImage = `url(${ads})`
})
export function startLipSync(core:any){

const ctx = new AudioContext()

const analyser = ctx.createAnalyser()

const audio = new Audio()

audio.crossOrigin = "anonymous"

const source = ctx.createMediaElementSource(audio)

source.connect(analyser)

analyser.connect(ctx.destination)

analyser.fftSize = 256

const data = new Uint8Array(analyser.frequencyBinCount)

function animate(){

analyser.getByteFrequencyData(data)

let sum = 0

for(let i=0;i<data.length;i++){

sum += data[i]

}

const volume = sum / data.length / 255

core.setParameterValueById("ParamMouthOpenY", volume * 1.5)

requestAnimationFrame(animate)

}

animate()

}
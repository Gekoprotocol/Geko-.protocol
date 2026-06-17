
// Zero-dependency Audio Synthesizer for UI SFX
const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
const ctx = new AudioContextClass();

const playTone = (freq: number, type: OscillatorType, duration: number, delay = 0, vol = 0.1) => {
  if (ctx.state === 'suspended') ctx.resume();
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  
  gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
};

export const audioSynth = {
  playSuccess: () => {
    playTone(880, 'sine', 0.1, 0);
    playTone(1760, 'sine', 0.3, 0.1);
  },
  playError: () => {
    playTone(150, 'sawtooth', 0.3, 0, 0.15);
    playTone(100, 'sawtooth', 0.3, 0.1, 0.15);
  },
  playClick: () => {
    playTone(1200, 'triangle', 0.05, 0, 0.05);
  },
  playPing: () => {
    playTone(2000, 'sine', 0.5, 0, 0.05);
  },
  playBoot: () => {
    playTone(220, 'square', 0.5, 0, 0.05);
    playTone(440, 'square', 0.5, 0.2, 0.05);
    playTone(880, 'square', 1.0, 0.4, 0.05);
  }
};

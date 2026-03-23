export class TTSService {
  private synth: SpeechSynthesis;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  speak(text: string, voiceName?: string, rate = 1) {
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (voiceName) {
      const voice = this.getVoices().find((v) => v.name === voiceName);
      if (voice) utterance.voice = voice;
    }
    utterance.rate = rate;
    utterance.pitch = 1;
    this.synth.speak(utterance);
    return utterance;
  }

  pause() {
    this.synth.pause();
  }

  resume() {
    this.synth.resume();
  }

  stop() {
    this.synth.cancel();
  }

  get speaking() {
    return this.synth.speaking;
  }

  get paused() {
    return this.synth.paused;
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.synth.getVoices();
  }
}

export const ttsService = new TTSService();

"use client";

export class AudioManager {
  private audioContext?: AudioContext;
  private audioBuffer?: AudioBuffer;
  private initialized = false;
  private userInteracted = false;

  constructor() {
    this.init();
  }

  private async init() {
    if (typeof window === "undefined") return;

    // Listen for first user interaction to enable audio
    const enableAudio = () => {
      this.userInteracted = true;
      this.initializeAudioContext();

      // Remove listeners after first interaction
      document.removeEventListener("click", enableAudio);
      document.removeEventListener("touchstart", enableAudio);
      document.removeEventListener("keydown", enableAudio);
    };

    document.addEventListener("click", enableAudio);
    document.addEventListener("touchstart", enableAudio);
    document.addEventListener("keydown", enableAudio);

    // Also try to initialize immediately (might work in some browsers)
    this.initializeAudioContext();
  }

  private async initializeAudioContext() {
    if (this.initialized || typeof window === "undefined") return;

    try {
      // Create audio context
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // Create a simple notification beep sound
      await this.createNotificationSound();

      this.initialized = true;
      console.log("🎵 Audio context initialized successfully");
    } catch (error) {
      console.warn("🎵 Failed to initialize audio context:", error);
    }
  }

  private async createNotificationSound() {
    if (!this.audioContext) return;

    // Create a simple beep sound using Web Audio API
    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.3; // 300ms
    const frameCount = sampleRate * duration;

    const arrayBuffer = this.audioContext.createBuffer(
      1,
      frameCount,
      sampleRate
    );
    const channelData = arrayBuffer.getChannelData(0);

    // Generate a pleasant notification sound (two-tone beep)
    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate;
      const frequency1 = 800; // First tone
      const frequency2 = 1000; // Second tone

      let sample = 0;
      if (t < duration / 2) {
        // First tone
        sample = Math.sin(2 * Math.PI * frequency1 * t) * Math.exp(-t * 3);
      } else {
        // Second tone
        const t2 = t - duration / 2;
        sample = Math.sin(2 * Math.PI * frequency2 * t2) * Math.exp(-t2 * 3);
      }

      channelData[i] = sample * 0.3; // Volume control
    }

    this.audioBuffer = arrayBuffer;
    console.log("🎵 Notification sound created");
  }

  async playNotificationSound(): Promise<boolean> {
    if (!this.userInteracted) {
      console.warn("🎵 Cannot play sound - no user interaction yet");
      return false;
    }

    if (!this.initialized) {
      await this.initializeAudioContext();
    }

    if (!this.audioContext || !this.audioBuffer) {
      console.warn("🎵 Audio not ready");
      return false;
    }

    try {
      // Resume audio context if suspended
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      // Create source and connect to destination
      const source = this.audioContext.createBufferSource();
      source.buffer = this.audioBuffer;
      source.connect(this.audioContext.destination);

      // Play the sound
      source.start();

      return true;
    } catch (error) {
      return false;
    }
  }

  // Fallback method using HTML5 Audio
  async playFallbackSound(): Promise<boolean> {
    try {
      // Create a data URL for a simple beep
      const audioData = this.generateSimpleBeepDataUrl();
      const audio = new Audio(audioData);
      audio.volume = 0.3;

      await audio.play();
      console.log("🎵 Fallback notification sound played");
      return true;
    } catch (error) {
      console.warn("🎵 Fallback sound also failed:", error);
      return false;
    }
  }

  private generateSimpleBeepDataUrl(): string {
    // Generate a simple beep as a data URL
    // This is a basic implementation - in a real app you might want a more sophisticated sound
    return "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+LyvmghCjWH0fPTfzEGHm7A7+OZRQ0PVqzn77BdGgU+ltryxnkpBSl+zPLaizsIGGS57OGgTgwOUarm7rhkHgU2jdXzzn0vBSF1xe/eizELElyx5+epVhUIQ5zd8sFuIAowhM/z2oQ2Bhxqvu7mnEoODlOq5O+zYBoGPJPY88p9KwUme8rx3I4+CRZiturjpVITC0ml4u6+aSEKMYPR8duGOQcfcsLu45ZFDBFYr+ftrVoXCECY3PLEcSEELYDN8tiJOAcZZ7zs4Z9ODA9Vq+Xvs2IaBjuR2fPOgC4FInbH8N2QQAoTYLPn6qhWFgpFnt7ywW8hCjaGz/PahzoIHW/A7eSaRgwPVqzl77JeGgU7k9n0z4AuBSJ2yO/dkUELElyx5+uoVxYKRZ7e8sFwIQo2hs/z2oY6Bx1uwO7kmEYMDlaq5e+yXhoFO5LZ9M6ALgUidsjv3ZFBCxJctufqqVcWCkSe3fLBcCEKNoXP89qGOgcdccDu5ZhGDA5Wq+Xvsl0aBTuS2fTOgC4FInbI792RQQsRXLbm6qlXFgo=";
  }

  // Test if audio is working
  async testAudio(): Promise<boolean> {
    console.log("🧪 Testing audio system...");

    const webAudioWorked = await this.playNotificationSound();
    if (webAudioWorked) {
      return true;
    }

    console.log("🧪 Web Audio failed, trying fallback...");
    const fallbackWorked = await this.playFallbackSound();

    return fallbackWorked;
  }

  // Get audio status for debugging
  getStatus() {
    return {
      initialized: this.initialized,
      userInteracted: this.userInteracted,
      audioContextState: this.audioContext?.state,
      hasAudioBuffer: !!this.audioBuffer,
    };
  }
}

// Singleton instance
export const audioManager = new AudioManager();

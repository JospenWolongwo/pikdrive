"use client";

export class AudioManager {
  private audioContext?: AudioContext;
  private audioBuffer?: AudioBuffer;
  private initialized = false;
  private userInteracted = false;

  constructor() {
    // Only initialize on the client side
    if (typeof window !== "undefined") {
      this.init();
    }
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

  // Public method to ensure initialization on client side
  ensureInitialized() {
    if (typeof window !== "undefined" && !this.initialized) {
      this.init();
    }
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
    // Note: We no longer create synthetic beep sounds
    // All notification sounds now use WAV files from /sounds/ directory
    // This method is kept for compatibility but does nothing
    console.log("🎵 Using WAV files from /sounds/ directory for notifications");
  }

  async playNotificationSound(): Promise<boolean> {
    // We no longer play synthetic beep sounds
    // All notification sounds are handled by HTML5 Audio using WAV files
    console.log("🎵 Notification sounds are handled by HTML5 Audio with WAV files");
    return false; // Return false to trigger fallback to HTML5 Audio
  }

  // Fallback method - now only returns false to use HTML5 Audio with WAV files
  async playFallbackSound(): Promise<boolean> {
    // We no longer use synthetic beep sounds as fallback
    // All sounds should use WAV files from /sounds/ directory
    console.log("🎵 Fallback sounds should use WAV files from /sounds/ directory");
    return false;
  }

  // Test if audio is working - now tests HTML5 Audio with WAV files
  async testAudio(): Promise<boolean> {
    console.log("🧪 Testing audio system with WAV files...");
    
    // Since we no longer use synthetic sounds, we return false
    // The actual audio testing should be done with HTML5 Audio using WAV files
    console.log("🧪 Audio testing should be done with HTML5 Audio using WAV files from /sounds/");
    return false;
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

/**
 * asr.ts
 * 音声認識のダミー実装
 */

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
    // 将来的にWhisper APIやGCP Speech-to-Textなどを呼ぶ。
    // 今はダミー返却
    return "Dummy transcription.";
  }
  
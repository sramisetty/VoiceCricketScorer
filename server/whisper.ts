import OpenAI from "openai";
import { Readable } from "stream";

// The newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function transcribeAudio(audioBuffer: Buffer, filename: string = "audio.wav"): Promise<{ text: string, confidence: number }> {
  try {
    // Create a readable stream from the buffer
    const audioStream = new Readable({
      read() {
        this.push(audioBuffer);
        this.push(null);
      }
    });

    // Set the filename for the stream (required by OpenAI)
    (audioStream as any).path = filename;

    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: "whisper-1",
      language: "en",
      prompt: "Cricket scoring terms: runs, dot ball, four, six, wide, no ball, bowler, batsman, wicket, over, single, double, boundary, maximum",
      response_format: "verbose_json",
      temperature: 0.2 // Lower temperature for more consistent results
    });

    return {
      text: transcription.text || "",
      confidence: transcription.duration && transcription.duration > 0 ? 0.9 : 0.5
    };
  } catch (error) {
    console.error("Whisper transcription error:", error);
    throw new Error("Failed to transcribe audio");
  }
}

export function validateAudioFormat(buffer: Buffer): boolean {
  // Check for common audio format signatures
  const wavSignature = buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WAVE";
  const mp3Signature = buffer.slice(0, 3).toString() === "ID3" || 
                      (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0);
  const m4aSignature = buffer.slice(4, 8).toString() === "ftyp";
  
  return wavSignature || mp3Signature || m4aSignature;
}
import OpenAI from "openai";
import { Readable } from "stream";

// The newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

console.log("OpenAI API key loaded:", process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 8)}...` : "NOT SET");

// Check if this is an Azure OpenAI key (usually longer and different format)
const isAzureKey = process.env.OPENAI_API_KEY.length > 32 && !process.env.OPENAI_API_KEY.startsWith('sk-');

let openai: OpenAI;

if (isAzureKey) {
  // For Azure OpenAI, we need additional environment variables
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || "https://your-resource-name.openai.azure.com/";
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || "whisper-1";
  
  console.log("Using Azure OpenAI configuration");
  console.log("Azure endpoint:", azureEndpoint);
  console.log("Azure deployment:", azureDeployment);
  
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: `${azureEndpoint}openai/deployments/${azureDeployment}`,
    defaultQuery: { 'api-version': '2024-06-01' },
    defaultHeaders: {
      'api-key': process.env.OPENAI_API_KEY,
    },
  });
} else {
  // Standard OpenAI configuration
  console.log("Using standard OpenAI configuration");
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function transcribeAudio(audioBuffer: Buffer, filename: string = "audio.wav"): Promise<{ text: string, confidence: number }> {
  try {
    console.log(`Transcribing audio file: ${filename}, size: ${audioBuffer.length} bytes`);
    
    // Create a readable stream from the buffer with proper file metadata
    const audioStream = new Readable({
      read() {
        this.push(audioBuffer);
        this.push(null);
      }
    });

    // Set the filename for the stream (required by OpenAI)
    (audioStream as any).path = filename;

    // Add debug logging
    console.log("Calling OpenAI Whisper API...");
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: "whisper-1",
      language: "en",
      prompt: "Cricket scoring terms: runs, dot ball, four, six, wide, no ball, bowler, batsman, wicket, over, single, double, boundary, maximum",
      response_format: "verbose_json",
      temperature: 0.2 // Lower temperature for more consistent results
    });

    console.log("Whisper API response:", transcription);

    return {
      text: transcription.text || "",
      confidence: transcription.duration && transcription.duration > 0 ? 0.9 : 0.5
    };
  } catch (error) {
    console.error("Whisper transcription error:", error);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}

export function validateAudioFormat(buffer: Buffer): boolean {
  // Be more permissive for now to support WebM and other formats
  // OpenAI Whisper can handle many formats
  if (buffer.length < 100) {
    return false; // File too small
  }
  
  // Check for common audio format signatures
  const wavSignature = buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WAVE";
  const mp3Signature = buffer.slice(0, 3).toString() === "ID3" || 
                      (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0);
  const m4aSignature = buffer.slice(4, 8).toString() === "ftyp";
  const webmSignature = buffer.slice(0, 4).toString('hex') === '1a45dfa3'; // WebM signature
  
  // Log the file signature for debugging
  console.log('Audio format check:', {
    first4Bytes: buffer.slice(0, 4).toString('hex'),
    first8Bytes: buffer.slice(0, 8).toString(),
    wavSignature,
    mp3Signature,
    m4aSignature,
    webmSignature
  });
  
  // For now, accept most formats as Whisper is quite flexible
  return buffer.length > 100;
}
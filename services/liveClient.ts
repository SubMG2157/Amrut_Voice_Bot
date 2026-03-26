import { GoogleGenAI, LiveServerMessage, Modality, EndSensitivity } from '@google/genai';
import { Language, AgentGender } from '../types';
import { getSystemInstruction } from './conversationEngine';
import { base64ToBytes, createPcmBlob, decodeAudioData } from './audioUtils';
import { sanitizeTranscript } from './transcriptSanitizer';
import { log } from './logger';
import { retrieveTopSchemes } from './conversationEngine/retrieval';
import type { Scheme } from '../backend/knowledge/schemeCatalog.ts';

export interface LiveClientConfig {
  language: Language;
  /** User name used in greeting */
  patientName?: string;
  /** Agent persona: female = Priya (voice: Aoede), male = Rajesh (voice: Puck). */
  agentGender?: AgentGender;
  /** Scheme category hint for information flow. */
  departmentName?: string;
  /** Optional runtime schemes from backend for richer retrieval. */
  availableSchemes?: Scheme[];
  onTranscript: (text: string, source: 'user' | 'model', isFinal: boolean) => void;
  onVolumeUpdate: (inputVol: number, outputVol: number) => void;
  onClose: () => void;
  onError: (error: Error) => void;
}

export class LiveClient {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private analyzerInput: AnalyserNode | null = null;
  private analyzerOutput: AnalyserNode | null = null;
  private nextStartTime = 0;
  private session: any = null; // Type as 'any' or specific session type if available
  private config: LiveClientConfig;
  private stream: MediaStream | null = null;
  private volumeInterval: number | null = null;
  /** Outbound guard: do not send customer audio until agent has spoken first (or fallback timeout). */
  private allowSendAudio = false;
  private outboundGuardTimer: ReturnType<typeof setTimeout> | null = null;
  private firstAgentTurnReceived = false;
  /** Buffer transcript by turn so we emit one bubble per sentence/turn, not per token. */
  private agentBuffer = '';
  private customerBuffer = '';
  /** Response timeout: if customer speaks but agent doesn't respond within 8s, auto-disconnect */
  private responseTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private customerAudioSent = false;
  private lastAgentResponseTime = 0;
  private activeAudioNodes: AudioBufferSourceNode[] = [];
  /** Long idle after last input ASR chunk — fallback if server omits user turnComplete. */
  private userTranscriptFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly USER_TRANSCRIPT_IDLE_MS = 2200;
  private intentionalDisconnect = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 1;
  private reconnectInProgress = false;
  private lastAgentTranscript = '';
  private lastAgentTranscriptAt = 0;
  private greetingRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastLikelyUserSpeechAt = 0;
  private userTurnsCount = 0;
  private lastManualInterruptAt = 0;
  private greetingTriggerSent = false;
  private agentTranscriptFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveUserSpeechFrames = 0;
  private currentUtteranceHasRealSpeech = false;
  /** After user barge-in, ignore stale model chunks for interrupted turn. */
  private dropStaleModelUntil = 0;
  /** True during the first agent greeting; prevents accidental mic echo noise from stopping the greeting mid-way. */
  private greetingInProgress = false;

  constructor(config: LiveClientConfig) {
    this.config = config;
    
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Vite proxies /ws to backend, or if deployed matches the current origin
    const baseUrl = `${wsProto}//${window.location.host}`;

    this.ai = new GoogleGenAI({ 
      apiKey: 'backend-proxy-key', 
      httpOptions: { baseUrl }
    });
  }

  public async connect() {
    try {
      this.intentionalDisconnect = false;
      this.lastAgentTranscript = '';
      this.lastAgentTranscriptAt = 0;
      this.userTurnsCount = 0;
      this.greetingTriggerSent = false;
      // Initialize Audio Contexts
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // CRITICAL: Resume audio contexts immediately (browsers suspend them until user interaction)
      await this.inputAudioContext.resume();
      await this.outputAudioContext.resume();

      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.connect(this.outputAudioContext.destination);

      // Analyzers for visualization
      this.analyzerInput = this.inputAudioContext.createAnalyser();
      this.analyzerInput.fftSize = 256;
      this.analyzerOutput = this.outputAudioContext.createAnalyser();
      this.analyzerOutput.fftSize = 256;
      this.outputNode.connect(this.analyzerOutput);

      this.startVolumeMonitoring();

      // Get Microphone Stream – constraints for clearer speech (better ASR accuracy)
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: { ideal: 16000 },
          },
        });
      } catch (micError: any) {
        // Microphone permission denied or not available
        const errMsg = micError?.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow microphone access to make calls.'
          : 'Microphone not available. Please check your device and try again.';
        log(`Microphone error: ${errMsg}`);
        this.config.onError(new Error(errMsg));
        throw micError;
      }

      const enrichedSystemInstruction = getSystemInstruction(
        this.config.language,
        this.config.patientName,
        this.config.departmentName,
        this.config.agentGender,
        this.config.availableSchemes,
      );
      // Select voice: female agent = Aoede (Priya), male agent = Puck (Rajesh)
      const voiceName = this.config.agentGender === 'male' ? 'Puck' : 'Aoede';
      log(`Call connecting (user: ${this.config.patientName ?? '—'}, category: ${this.config.departmentName ?? 'general'}, agentVoice: ${voiceName})`);

      const sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log("Live Client: Connection Opened");
            this.allowSendAudio = false;
            this.firstAgentTurnReceived = false;
            // Enable sending after first agent speech, or after 5s fallback so call can continue
            this.outboundGuardTimer = setTimeout(() => {
              if (!this.firstAgentTurnReceived) {
                this.allowSendAudio = true;
                log('Outbound guard: fallback 5s — enabling customer audio');
              }
              this.outboundGuardTimer = null;
            }, 5000);
            this.startAudioInput(sessionPromise);
          },
          onmessage: (message: LiveServerMessage) => this.handleMessage(message),
          onclose: (e) => {
            console.log("Live Client: Connection Closed", e);
            log('Call disconnected');
            if (this.intentionalDisconnect) {
              this.config.onClose();
              return;
            }
            if (!this.reconnectInProgress && this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts += 1;
              this.reconnectInProgress = true;
              log('Connection dropped unexpectedly — reconnecting once...');
              setTimeout(async () => {
                try {
                  this.disconnect(false);
                  await this.connect();
                  log('Reconnected successfully');
                } catch {
                  this.config.onClose();
                } finally {
                  this.reconnectInProgress = false;
                }
              }, 500);
              return;
            }
            this.config.onClose();
          },
          onerror: (e) => {
            console.error("Live Client: Error", e);
            log(`Error: ${e?.message ?? 'Connection error'}`);
            this.config.onError(new Error("Connection error"));
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } }
          },
          systemInstruction: enrichedSystemInstruction,
          // Latency tuning: faster response without over-splitting long utterances.
          realtimeInputConfig: {
            automaticActivityDetection: {
              silenceDurationMs: 260,
              prefixPaddingMs: 16,
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
            },
          },
          temperature: 0.4,
          // Disable thinking for faster, more direct speech responses.
          thinkingConfig: { thinkingBudget: 0 },
        }
      });

      this.session = await sessionPromise;

      // Force agent to speak first immediately — send exactly once per session.
      try {
        this.greetingInProgress = true;
        const sendGreetingTrigger = () => {
          if (this.greetingTriggerSent) return;
          const payload = {
            turns: [{
              role: 'user',
              parts: [{ text: 'कॉल आता कनेक्ट झाला आहे. लगेच मराठीत स्वागत सुरू करा आणि वापरकर्ता बोलण्याची वाट पाहू नका.' }]
            }],
            turnComplete: true,
          };

          if (typeof this.session.sendClientContent === 'function') {
            this.session.sendClientContent(payload);
          } else if (typeof this.session.send === 'function') {
            this.session.send({ clientContent: payload });
          }
          this.greetingTriggerSent = true;
        };

        sendGreetingTrigger();
        log('Greeting trigger sent once — agent should speak first immediately');
      } catch (triggerErr: any) {
        console.warn('sendClientContent trigger failed:', triggerErr?.message);
      }

      log('Call connected');
    } catch (error: any) {
      console.error("Failed to connect:", error);
      log(`Connect failed: ${error?.message ?? error}`);
      this.config.onError(error);
      this.disconnect();
      throw error;
    }
  }

  private startAudioInput(sessionPromise: Promise<any>) {
    if (!this.inputAudioContext || !this.stream) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.inputSource.connect(this.analyzerInput!);

    // Smaller chunk lowers uplink buffering delay (~64ms at 16kHz).
    this.processor = this.inputAudioContext.createScriptProcessor(1024, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.allowSendAudio || !this.session) return;
      const inputData = e.inputBuffer.getChannelData(0);
      
      // We must NEVER drop silent frames. Gemini's VAD relies on the continuous stream 
      // of audio (including silence) to trigger the `endOfSpeech` event accurately.
      // However, we apply a noise gate (fill with 0) below a threshold so background 
      // mic noise doesn't incorrectly trigger the 'interrupted' event!
      
      const abs = Array.from(inputData).map(Math.abs);
      const peak = Math.max(...abs);
      const rms = Math.sqrt(abs.reduce((sum, v) => sum + v * v, 0) / Math.max(1, abs.length));
      const agentSpeakingNow = this.activeAudioNodes.length > 0;

      // Filter ambient mic hiss/fan noise and weak echo while agent is speaking.
      const likelyNoise = peak < 0.085 && rms < 0.018;
      // Suppress weak/medium echo while agent speaks; true user speech should exceed this.
      const weakEchoWhileAgentSpeaking = agentSpeakingNow && (peak < 0.2 || rms < 0.03);

      if (likelyNoise || weakEchoWhileAgentSpeaking) {
        inputData.fill(0);
        this.consecutiveUserSpeechFrames = 0;
      } else {
        this.consecutiveUserSpeechFrames += 1;
        this.currentUtteranceHasRealSpeech = true;
        // Mark likely user speech only after stable voice for a few frames
        // to avoid false positives from speaker leak/echo bursts.
        if (!agentSpeakingNow || this.consecutiveUserSpeechFrames >= 3) {
          this.lastLikelyUserSpeechAt = Date.now();
        }
        // Manual barge-in: require stable, strong speech while agent audio is playing.
        const stableUserBargeIn =
          agentSpeakingNow &&
          this.consecutiveUserSpeechFrames >= 3 &&
          peak >= 0.23 &&
          rms >= 0.035;
        if (stableUserBargeIn && Date.now() - this.lastManualInterruptAt > 900) {
          this.stopAudioPlayback();
          this.dropStaleModelUntil = Date.now() + 1400;
          this.agentBuffer = '';
          this.lastManualInterruptAt = Date.now();
          log('Manual barge-in applied');
        }
        if (!this.customerAudioSent) {
          this.customerAudioSent = true;
          this.startResponseTimeout();
        }
      }
      
      const pcmBlob = createPcmBlob(inputData);
      // Use 'audio' param per Gemini Live API spec; 'media' is for images.
      if (typeof this.session.sendRealtimeInput === 'function') {
        this.session.sendRealtimeInput({ audio: pcmBlob });
      } else if (typeof this.session.send === 'function') {
        this.session.send({ realtimeInput: { audio: pcmBlob } });
      }
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private startResponseTimeout() {
    // Clear any existing timeout
    if (this.responseTimeoutTimer) clearTimeout(this.responseTimeoutTimer);

    // Use generous timeout — Gemini can pause during streaming, don't kill the session
    const timeoutDuration = 30000; // 30 seconds

    this.responseTimeoutTimer = setTimeout(() => {
      const timeSinceLastResponse = Date.now() - this.lastAgentResponseTime;
      if (timeSinceLastResponse > timeoutDuration) {
        log(`WARN: Agent has not responded for ${timeoutDuration / 1000}s — connection may be stuck`);
        // Only warn, do NOT auto-disconnect. Let the user end the call manually if needed.
        // Gemini streaming can have natural pauses; killing the session causes a worse UX.
      }
    }, timeoutDuration);
  }

  private async handleMessage(message: LiveServerMessage) {
    if (message.serverContent?.modelTurn && !this.firstAgentTurnReceived) {
      this.firstAgentTurnReceived = true;
      // Reset audio clock so greeting starts cleanly
      this.nextStartTime = this.outputAudioContext?.currentTime ?? 0;
      if (this.outboundGuardTimer) {
        clearTimeout(this.outboundGuardTimer);
        this.outboundGuardTimer = null;
      }
      // Delay mic enable by 600ms so the agent's greeting audio doesn't echo back
      // into the mic and trigger a false interruption on hardware without good AEC
      setTimeout(() => {
        this.allowSendAudio = true;
        log('Outbound guard: agent spoke first — enabling customer audio');
      }, 600);
    }

    // Agent responded - reset response timeout
    if (message.serverContent?.modelTurn) {
      this.lastAgentResponseTime = Date.now();
      if (this.responseTimeoutTimer) {
        clearTimeout(this.responseTimeoutTimer);
        this.responseTimeoutTimer = null;
      }
      this.customerAudioSent = false; // Reset for next turn
    }

    if (message.serverContent?.interrupted) {
      // During initial greeting, ignore interruptions caused by mic echo/noise.
      if (this.greetingInProgress) {
        return;
      }
      const isLikelyRealUserBargeIn = Date.now() - this.lastLikelyUserSpeechAt < 1500;
      if (isLikelyRealUserBargeIn) {
        log('Agent interrupted by user');
        this.stopAudioPlayback();
        this.dropStaleModelUntil = Date.now() + 1400;
        // Drop partial agent text when user barges in to avoid half-sentence bubbles.
        this.agentBuffer = '';
        if (this.agentTranscriptFlushTimer) {
          clearTimeout(this.agentTranscriptFlushTimer);
          this.agentTranscriptFlushTimer = null;
        }
      } else {
        log('Ignored spurious interruption (likely noise/echo)');
      }
    }

    // Handle Audio Output: consume all inline audio parts, not just parts[0].
    const audioParts =
      message.serverContent?.modelTurn?.parts?.filter((p: any) => !!p?.inlineData?.data) ?? [];
    if (
      audioParts.length &&
      Date.now() >= this.dropStaleModelUntil &&
      this.outputAudioContext &&
      this.outputNode
    ) {
      // Ensure context is running (can get suspended on mobile/some browsers)
      if (this.outputAudioContext.state === 'suspended') {
        await this.outputAudioContext.resume();
      }
      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);

      for (const part of audioParts) {
        const base64Audio = part.inlineData.data as string;
        const audioBuffer = await decodeAudioData(
          base64ToBytes(base64Audio),
          this.outputAudioContext,
          24000,
          1
        );

        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputNode);
        
        this.activeAudioNodes.push(source);
        source.onended = () => {
          const idx = this.activeAudioNodes.indexOf(source);
          if (idx !== -1) {
            this.activeAudioNodes.splice(idx, 1);
          }
        };

        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
      }
    }

    // Buffer transcript by turn: emit exactly one bubble per turn (only on turnComplete, never per chunk)
    const outText = message.serverContent?.outputTranscription?.text;
    const inText = message.serverContent?.inputTranscription?.text;
    const turnComplete = !!message.serverContent?.turnComplete;

    if (inText) {
      // Join chunks with a space so words don't run together (e.g. "हो" + "बोलाना" → "हो बोलाना")
      this.customerBuffer = this.customerBuffer
        ? this.customerBuffer + ' ' + inText
        : inText;
      // If ASR produced actual language text, treat it as real speech even for softer voices.
      if (/[\p{Script=Devanagari}A-Za-z]/u.test(inText) && !/\[unclear\]/i.test(inText)) {
        this.currentUtteranceHasRealSpeech = true;
      }
      // One bubble per user turn: do not flush on short silence (that split one answer into many bubbles).
      // Primary flush is turnComplete; idle fallback covers missing turnComplete.
      if (this.userTranscriptFallbackTimer) clearTimeout(this.userTranscriptFallbackTimer);
      this.userTranscriptFallbackTimer = setTimeout(() => {
        this.userTranscriptFallbackTimer = null;
        this.flushCustomerTranscriptTurn();
      }, LiveClient.USER_TRANSCRIPT_IDLE_MS);
    }
    
    if (outText) {
      if (Date.now() < this.dropStaleModelUntil) {
        return;
      }
      this.agentBuffer += outText;
      // Some streams may miss turnComplete; flush after brief quiet period.
      if (this.agentTranscriptFlushTimer) clearTimeout(this.agentTranscriptFlushTimer);
      this.agentTranscriptFlushTimer = setTimeout(() => {
        if (this.agentBuffer.trim()) {
          this.flushAgentBuffer();
        }
        this.agentTranscriptFlushTimer = null;
      }, 1000);
    }
    
    if (turnComplete) {
      // When the greeting turn completes, allow interruptions for subsequent user turns.
      if (this.greetingInProgress) {
        this.greetingInProgress = false;
        this.allowSendAudio = true;
      }
      if (this.agentBuffer.trim()) {
        this.flushAgentBuffer();
      }
      if (this.agentTranscriptFlushTimer) {
        clearTimeout(this.agentTranscriptFlushTimer);
        this.agentTranscriptFlushTimer = null;
      }
      if (this.userTranscriptFallbackTimer) {
        clearTimeout(this.userTranscriptFallbackTimer);
        this.userTranscriptFallbackTimer = null;
      }
      this.flushCustomerTranscriptTurn();
    }
  }

  /** Emit one user bubble for the current buffered ASR (turn end or idle fallback). */
  private flushCustomerTranscriptTurn(): void {
    const raw = this.customerBuffer.trim();
    if (!raw) return;

    const isExplicitUnclear = /^\[?unclear\]?$/i.test(raw);
    if (isExplicitUnclear) {
      this.config.onTranscript('[unclear]', 'user', true);
      this.customerBuffer = '';
      this.currentUtteranceHasRealSpeech = false;
      return;
    }
    if (!this.currentUtteranceHasRealSpeech || raw.length < 2) {
      this.customerBuffer = '';
      this.currentUtteranceHasRealSpeech = false;
      return;
    }
    const custResult = sanitizeTranscript(raw, {
      preferArabic: false,
      dropIsolatedLatinWords: true,
      dropUnclear: false,
      applyTelephonyCorrections: true,
    });
    if (custResult.output) {
      this.config.onTranscript(custResult.output, 'user', true);
      this.userTurnsCount += 1;
      this.dropStaleModelUntil = 0;
      this.injectSchemeContextForQuery(custResult.output);
    }
    this.customerBuffer = '';
    this.currentUtteranceHasRealSpeech = false;
  }

  private flushAgentBuffer() {
    const normalized = this.agentBuffer.trim().replace(/\s+/g, ' ');
    if (!normalized) return;
    const now = Date.now();
    const isDuplicate = normalized === this.lastAgentTranscript && now - this.lastAgentTranscriptAt < 4500;
    const isGreetingLike = /नमस्कार!?\s*मी/.test(normalized) && normalized.includes('अमृत सरकारी योजना पोर्टल');
    const isDuplicateGreetingBeforeUser =
      isGreetingLike &&
      this.userTurnsCount === 0 &&
      this.lastAgentTranscript.includes('अमृत सरकारी योजना पोर्टल') &&
      now - this.lastAgentTranscriptAt < 15000;
    if (!isDuplicate && !isDuplicateGreetingBeforeUser) {
      this.config.onTranscript(normalized, 'model', true);
      this.lastAgentTranscript = normalized;
      this.lastAgentTranscriptAt = now;
    }
    this.agentBuffer = '';
  }

  private startVolumeMonitoring() {
    this.volumeInterval = window.setInterval(() => {
      if (!this.analyzerInput || !this.analyzerOutput) return;

      const inputData = new Uint8Array(this.analyzerInput.frequencyBinCount);
      this.analyzerInput.getByteFrequencyData(inputData);
      const inputVol = inputData.reduce((a, b) => a + b) / inputData.length;

      const outputData = new Uint8Array(this.analyzerOutput.frequencyBinCount);
      this.analyzerOutput.getByteFrequencyData(outputData);
      const outputVol = outputData.reduce((a, b) => a + b) / outputData.length;

      this.config.onVolumeUpdate(inputVol, outputVol);
    }, 50);
  }

  private injectSchemeContextForQuery(query: string) {
    if (!this.session || !this.config.availableSchemes?.length) return;
    const tokenCount = query.trim().split(/\s+/).filter(Boolean).length;

    // For longer queries, keep the injected context smaller to reduce model turnaround time.
    const topLimit = tokenCount >= 14 ? 4 : 8;
    const top = retrieveTopSchemes(this.config.availableSchemes, { query, limit: topLimit });
    if (!top.length) return;

    // AMRUT "divisions/initiatives" are NOT individual schemes.
    // In your KB file they may still appear as normal scheme entries, so we
    // tag them at prompt-injection time to prevent eligibility/documents flow.
    const AMRUT_DIVISION_NAME_MR = [
      'अमृत पेठ',
      'अमृत विद्या',
      'अमृत महाराष्ट्र',
      'अमृत मानसमित्र',
      'अमृत ड्रोन मिशन',
      'अमृत पर्यटन',
      'अमृत उद्यम मिशन',
      'अमृत वर्ग',
      'अमृत पेठ थेट बाजारपेठ',
    ];
    const isAmrutDivision = (nameMr: string | undefined) =>
      !!nameMr && AMRUT_DIVISION_NAME_MR.some((p) => nameMr.trim().startsWith(p));

    // Intent flags so we only inject the fields the user is likely to request.
    const wantsDocs = /कागदपत्रे|documents|डॉक्युमेंट्स|डॉक्युमेन्ट्स|docs|required\s+documents/i.test(query);
    const wantsContact = /हेल्पलाइन|phone|contact|ईमेल|email|वेबसाइट|website|संपर्क|वेब/i.test(query);
    const wantsDates = /डेडलाइन|deadline|अंतिम|last\s*date|शेवट|तारीख|date/i.test(query);
    const wantsProcess = /अर्ज\s*प्रक्रिया|process|how\s+to\s+apply|कसा\s+अर्ज|apply/i.test(query);

    const shouldQuickAcknowledge = tokenCount >= 10 || query.length >= 55;
    const acknowledgeHint = shouldQuickAcknowledge
      ? 'Start your very next reply with a short acknowledgement in the user language (max 4-6 words), then continue with the actual answer.'
      : '';

    const shortlist = top
      .map((s) => {
        // Pass full documents list (catalog already caps count); do not slice — model was inventing a short generic list.
        const division = isAmrutDivision(s.nameMr);

        const docsRaw = division ? [] : (s.documentsRequired || []).filter(Boolean);
        const docs = division
          ? 'N/A (AMRUT division/initiative; not a single scheme)'
          : wantsDocs
            ? (docsRaw.length ? docsRaw.join(' | ') : 'N/A')
            : (docsRaw.length ? 'Docs available (list only if user asks कागदपत्रे).' : 'N/A');

        const phone = division ? 'N/A' : (wantsContact ? (s.helplineNumber || 'N/A') : 'N/A');
        const start = division ? 'N/A' : (wantsDates ? (s.schemeStartDate || 'N/A') : 'N/A');
        const end = division ? 'N/A' : (wantsDates ? (s.applicationDeadline || 'N/A') : 'N/A');

        // Keep descriptions compact; big injected context increases model latency.
        const descLimit = s.id === 'amrut-organization' ? 6000 : division ? 2000 : 80;
        const process = division
          ? 'N/A'
          : wantsProcess
            ? (s.applicationProcess ? s.applicationProcess.slice(0, 600) : 'N/A')
            : 'N/A';
        return `- [${s.id}] ${s.nameMr}
  desc: ${(s.description || '').slice(0, descLimit)}
  phone: ${phone}
  start_date: ${start}
  end_date: ${end}
  docs (complete list; use all when user asks for documents): ${docs}
  process (short): ${process}`;
      })
      .join('\n');

    const contextText = `Internal context for next response only. User query: "${query}". Top matching schemes (may include AMRUT divisions/initiatives):\n${shortlist}\nUse only relevant facts and avoid saying data is unavailable unless no match applies.
If a matched item is an AMRUT division/initiative (its docs line says "not a single scheme"), do NOT follow the scheme eligibility/documents flow. Instead explain it as a division/initiative under AMRUT and ask which specific scheme/program the user wants.
If user asks phone/contact/date for a true scheme, answer from these fields directly. If user asks required documents (कागदपत्रे), list every item in the docs line for the matched scheme in order—do not shorten to only आधार/उत्पन्न/रहिवासी when more items are listed.
If user asks application process, use the process (short) field above.
${acknowledgeHint}`.trim();
    try {
      const payload = {
        turns: [{ role: 'user', parts: [{ text: contextText }] }],
        turnComplete: false,
      };
      if (typeof this.session.sendClientContent === 'function') {
        this.session.sendClientContent(payload);
      } else if (typeof this.session.send === 'function') {
        this.session.send({ clientContent: payload });
      }
    } catch {
      // Context injection is best-effort.
    }
  }

  public disconnect(isIntentional = true) {
    this.intentionalDisconnect = isIntentional;
    if (this.session) {
      // Session cleanup
    }

    this.stopAudioPlayback();

    if (this.inputSource) this.inputSource.disconnect();
    if (this.processor) this.processor.disconnect();
    if (this.outputNode) this.outputNode.disconnect();

    this.inputAudioContext?.close();
    this.outputAudioContext?.close();

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    if (this.volumeInterval) clearInterval(this.volumeInterval);
    if (this.outboundGuardTimer) clearTimeout(this.outboundGuardTimer);
    if (this.greetingRetryTimer) clearTimeout(this.greetingRetryTimer);
    if (this.responseTimeoutTimer) clearTimeout(this.responseTimeoutTimer);
    if (this.userTranscriptFallbackTimer) clearTimeout(this.userTranscriptFallbackTimer);
    if (this.agentTranscriptFlushTimer) clearTimeout(this.agentTranscriptFlushTimer);

    this.allowSendAudio = false;
    this.outboundGuardTimer = null;
    this.greetingRetryTimer = null;
    this.responseTimeoutTimer = null;
    this.userTranscriptFallbackTimer = null;
    this.agentTranscriptFlushTimer = null;
    this.inputAudioContext = null;
    this.outputAudioContext = null;
    this.session = null;
    this.nextStartTime = 0;
  }

  private stopAudioPlayback() {
    this.activeAudioNodes.forEach(node => {
      try { node.stop(); } catch (e) {}
    });
    this.activeAudioNodes = [];
    if (this.outputAudioContext) {
      this.nextStartTime = this.outputAudioContext.currentTime;
    }
  }
}

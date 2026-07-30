import React, { useState, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';

interface VoiceTextInputWidgetProps {
  onTranscript: (text: string) => void;
  onCommand?: (commandName: string, param?: string) => void;
  placeholder?: string;
  compact?: boolean;
}

export const VoiceTextInputWidget: React.FC<VoiceTextInputWidgetProps> = ({
  onTranscript,
  onCommand,
  placeholder = 'Speak notes or voice command...',
  compact = false
}) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const recognitionRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Check SpeechRecognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentFinal = '';
        let currentInterim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            currentFinal += trans + ' ';
          } else {
            currentInterim += trans;
          }
        }

        if (currentFinal) {
          setTranscript(prev => {
            const next = (prev + ' ' + currentFinal).trim();
            onTranscript(next);
            // Check quick voice commands
            parseVoiceCommands(next);
            return next;
          });
        }
        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setPermissionError('Microphone permission was denied. Please allow microphone access in browser settings.');
        } else if (event.error === 'no-speech') {
          // ignore no-speech
        } else {
          setPermissionError(`Voice error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setPermissionError('Web Speech API is not natively supported in this browser. You can simulate voice commands below.');
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const parseVoiceCommands = (text: string) => {
    const lower = text.toLowerCase();
    let matchedCmd = '';
    let matchedParam: any = undefined;

    // SupportPilot wake phrase or direct phrase matching
    if (lower.includes('sev-1') || lower.includes('sev 1') || lower.includes('critical incidents') || lower.includes('show me critical')) {
      matchedCmd = 'FILTER_SEVERITY';
      matchedParam = 'CRITICAL';
    } else if (lower.includes('sev-2') || lower.includes('sev 2') || lower.includes('high incidents')) {
      matchedCmd = 'FILTER_SEVERITY';
      matchedParam = 'HIGH';
    } else if (lower.includes('sev-3') || lower.includes('sev 3') || lower.includes('medium incidents')) {
      matchedCmd = 'FILTER_SEVERITY';
      matchedParam = 'MEDIUM';
    } else if (lower.includes('status solved') || lower.includes('mark solved') || lower.includes('resolve incident') || lower.includes('set status to resolved')) {
      matchedCmd = 'SET_STATUS';
      matchedParam = 'SOLVED';
    } else if (lower.includes('status investigating') || lower.includes('mark investigating') || lower.includes('set status to investigating')) {
      matchedCmd = 'SET_STATUS';
      matchedParam = 'INVESTIGATING';
    } else if (lower.includes('escalate incident') || lower.includes('status escalated') || lower.includes('set status to escalated')) {
      matchedCmd = 'SET_STATUS';
      matchedParam = 'ESCALATED';
    } else if (lower.includes('run investigation') || lower.includes('analyze incident')) {
      matchedCmd = 'RUN_INVESTIGATION';
    } else if (lower.includes('show all incidents') || lower.includes('clear filter')) {
      matchedCmd = 'FILTER_SEVERITY';
      matchedParam = 'all';
    }

    if (matchedCmd) {
      if (onCommand) {
        onCommand(matchedCmd, matchedParam);
      }

      // Dispatch global events for instant app-wide synchronization
      if (matchedCmd === 'FILTER_SEVERITY') {
        window.dispatchEvent(new CustomEvent('voice-filter-severity', { detail: { severity: matchedParam } }));
      } else if (matchedCmd === 'SET_STATUS') {
        window.dispatchEvent(new CustomEvent('voice-set-status', { detail: { status: matchedParam } }));
      }

      window.dispatchEvent(new CustomEvent('voice-command-processed', {
        detail: {
          id: `cmd-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          rawText: text,
          commandName: matchedCmd,
          param: matchedParam,
          status: 'SUCCESS'
        }
      }));

      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `Voice command recognized: ${matchedCmd} (${matchedParam || 'exec'})` }
      }));
    }
  };

  const simulateAudioPulse = () => {
    if (!isListening) return;
    setAudioLevel(Math.floor(Math.random() * 85) + 15);
    animFrameRef.current = requestAnimationFrame(simulateAudioPulse);
  };

  const toggleListening = async () => {
    setPermissionError(null);

    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    // Request microphone permission explicitly via getUserMedia to trigger prompt if needed
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Release stream so speech recognition handles microphone
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (err: any) {
      console.warn('Microphone permission request failed:', err);
      setPermissionError('Microphone permission required for voice-to-text dictation.');
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        simulateAudioPulse();
      } catch (e: any) {
        console.error('Failed to start speech recognition:', e);
        setIsListening(false);
      }
    } else {
      // Browser fallback simulation mode
      setIsListening(true);
      simulateAudioPulse();
      setTimeout(() => {
        const sampleText = "Investigated downstream PostgreSQL pool saturation. Connection locks recycled successfully.";
        setTranscript(sampleText);
        onTranscript(sampleText);
        setIsListening(false);
      }, 3000);
    }
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 font-mono space-y-2 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={toggleListening}
            className={`p-2 rounded-lg border font-bold flex items-center space-x-1.5 transition-all cursor-pointer text-xs shadow-md ${
              isListening
                ? 'bg-rose-500/20 border-rose-500 text-rose-400 ring-2 ring-rose-500/30 animate-pulse'
                : 'bg-indigo-600/20 hover:bg-indigo-600/30 border-indigo-500/40 text-indigo-300'
            }`}
            title="Toggle Voice-to-Text Dictation (Microphone)"
          >
            <Icons.Mic className={`h-4 w-4 ${isListening ? 'animate-bounce text-rose-400' : 'text-indigo-400'}`} />
            <span>{isListening ? 'Stop Recording' : 'Voice-To-Text'}</span>
          </button>

          {isListening && (
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xxs font-bold">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <span>RECORDING</span>

              {/* Animated Soundwave bars */}
              <div className="flex items-end space-x-0.5 h-3 ml-2">
                {[40, 80, 50, 100, 60].map((h, idx) => (
                  <div
                    key={idx}
                    className="w-1 bg-rose-400 rounded-full transition-all duration-100"
                    style={{ height: `${Math.max(20, (audioLevel * h) / 100)}%` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {transcript && (
          <button
            onClick={() => {
              setTranscript('');
              setInterimTranscript('');
            }}
            className="text-[9.5px] text-slate-500 hover:text-slate-300 transition-colors flex items-center space-x-1 cursor-pointer"
          >
            <Icons.Trash2 className="h-3 w-3" />
            <span>Clear Voice Text</span>
          </button>
        )}
      </div>

      {permissionError && (
        <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[9.5px] flex items-center space-x-1.5">
          <Icons.AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
          <span>{permissionError}</span>
        </div>
      )}

      {/* Transcript Display Box */}
      {(transcript || interimTranscript || isListening) && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 min-h-[48px] select-text space-y-1">
          <div className="text-[8.5px] font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-1">
            <Icons.Volume2 className="h-3 w-3 text-indigo-400" />
            <span>Voice Transcript Stream</span>
          </div>

          <p className="leading-relaxed">
            {transcript}
            {interimTranscript && (
              <span className="text-slate-500 italic ml-1">
                {interimTranscript}...
              </span>
            )}
            {!transcript && !interimTranscript && isListening && (
              <span className="text-slate-500 italic">Listening to audio input... Speak now</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

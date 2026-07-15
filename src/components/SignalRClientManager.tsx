import React, { useEffect, useRef } from 'react';

interface SignalRClientManagerProps {
  onAlert: (message: string) => void;
  onAddAuditLog: (operator: string, action: string, module: string, status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL', payload: string) => void;
}

export default function SignalRClientManager({ onAlert, onAddAuditLog }: SignalRClientManagerProps) {
  const lastProcessedIndexRef = useRef<number>(-1);
  const isFirstLoadRef = useRef<boolean>(true);

  useEffect(() => {
    const pollSignalRLogs = async () => {
      try {
        const response = await fetch('/api/aspnet/signalr-logs');
        if (!response.ok) return;
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return;
        }

        const logs: string[] = await response.json();

        if (logs.length === 0) return;

        // If it's the very first fetch on mount, seed our pointer to current length so we don't spam old historical toast popups
        if (isFirstLoadRef.current) {
          lastProcessedIndexRef.current = logs.length - 1;
          isFirstLoadRef.current = false;
          onAddAuditLog(
            "SignalR Client",
            "Establish Connection",
            "SignalR Service",
            "SUCCESS",
            `Connected client manager to ASP.NET Hub: /hubs/incidents. Listening on group 'Tenant-Global'.`
          );
          return;
        }

        // Process any new logs that came in
        if (logs.length > lastProcessedIndexRef.current + 1) {
          for (let i = lastProcessedIndexRef.current + 1; i < logs.length; i++) {
            const logLine = logs[i];
            
            // Match custom SignalR broadcast patterns
            const isIncidentUpdate = logLine.includes("Action 'CREATED'") || logLine.includes("Action 'RESOLVED'") || logLine.includes("IncidentUpdated");
            const isSystemAlert = logLine.includes("warning message globally") || logLine.includes("Action 'CRITICAL_ALERT'") || logLine.includes("SystemAlert");

            if (isIncidentUpdate) {
              onAlert(`SignalR [IncidentUpdated]: ${extractMessage(logLine)}`);
            } else if (isSystemAlert) {
              onAlert(`SignalR [SystemAlert]: ${extractMessage(logLine)}`);
            }
          }
          lastProcessedIndexRef.current = logs.length - 1;
        }
      } catch (error) {
        console.error("SignalR Client Connection lost. Retrying backend handshake...", error);
      }
    };

    // Helper to scrub and extract a clean human readable body from raw SignalR server logs
    const extractMessage = (line: string): string => {
      if (line.includes("Body: '")) {
        const match = line.match(/Body:\s*'([^']+)'/);
        if (match) return match[1];
      }
      if (line.includes("Action '")) {
        const actMatch = line.match(/Action\s*'([^']+)'/);
        const resMatch = line.match(/Resource ID:\s*([^\s,]+)/);
        const action = actMatch ? actMatch[1] : "UPDATED";
        const id = resMatch ? resMatch[1] : "Resource";
        return `Incident ${id} has been transitioned to: ${action}`;
      }
      return line.replace(/\[[^\]]+\]/g, '').trim();
    };

    pollSignalRLogs();
    const timer = setInterval(pollSignalRLogs, 2500);

    return () => clearInterval(timer);
  }, [onAlert, onAddAuditLog]);

  return null; // Silent background client
}

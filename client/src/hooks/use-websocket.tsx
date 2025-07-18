import { useEffect, useState, useCallback } from 'react';
import type { LiveMatchData } from '@shared/schema';

interface WebSocketMessage {
  type: 'match_started' | 'ball_update' | 'ball_undone';
  data: LiveMatchData;
}

export function useWebSocket(matchId: number | null) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [liveData, setLiveData] = useState<LiveMatchData | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (!matchId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'join_match', matchId }));
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        setLiveData(message.data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setTimeout(connect, 3000); // Reconnect after 3 seconds
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setSocket(ws);
  }, [matchId]);

  useEffect(() => {
    connect();

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [connect]);

  return { socket, liveData, isConnected };
}

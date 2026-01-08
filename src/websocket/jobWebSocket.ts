import { Client, IMessage } from '@stomp/stompjs';
import { supabase } from '../auth/supabase';

export type JobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

export interface JobUpdate {
  jobId: string;
  status: JobStatus;
  resultRef?: string;
}

type JobUpdateCallback = (update: JobUpdate) => void;

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:8080/ws-job-updates';

class JobWebSocketService {
  private client: Client | null = null;
  private callbacks: Set<JobUpdateCallback> = new Set();
  private isConnected = false;
  private userId: string | null = null;

  async connect(): Promise<void> {
    if (this.isConnected && this.client?.active) {
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      console.warn('No user session, cannot connect to WebSocket');
      return;
    }

    this.userId = session.user.id;
    const accessToken = session.access_token;

    this.client = new Client({
      brokerURL: `${WS_URL}?token=${accessToken}`,
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: (msg) => {
        if (__DEV__) {
          console.log('[STOMP]', msg);
        }
      },
      onConnect: () => {
        this.isConnected = true;
        console.log('WebSocket connected');
        this.subscribeToUserTopic();
      },
      onDisconnect: () => {
        this.isConnected = false;
        console.log('WebSocket disconnected');
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame.headers['message']);
      },
    });

    this.client.activate();
  }

  private subscribeToUserTopic(): void {
    if (!this.client || !this.userId) return;

    this.client.subscribe(`/topic/user/${this.userId}`, (message: IMessage) => {
      try {
        const update: JobUpdate = JSON.parse(message.body);
        this.notifyCallbacks(update);
      } catch (error) {
        console.error('Failed to parse job update:', error);
      }
    });
  }

  private notifyCallbacks(update: JobUpdate): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(update);
      } catch (error) {
        console.error('Error in job update callback:', error);
      }
    });
  }

  subscribe(callback: JobUpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  disconnect(): void {
    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    this.isConnected = false;
    this.userId = null;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }
}

export const jobWebSocketService = new JobWebSocketService();

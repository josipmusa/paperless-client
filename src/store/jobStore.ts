import { create } from 'zustand';
import { JobStatus, JobUpdate, jobWebSocketService } from '../websocket/jobWebSocket';

export interface Job {
  id: string;
  status: JobStatus;
  resultRef?: string;
}

interface JobState {
  currentJob: Job | null;
  setCurrentJob: (job: Job | null) => void;
  updateJobStatus: (update: JobUpdate) => void;
  clearCurrentJob: () => void;
}

export const useJobStore = create<JobState>((set, get) => ({
  currentJob: null,

  setCurrentJob: (job) => set({ currentJob: job }),

  updateJobStatus: (update) => {
    const { currentJob } = get();
    if (currentJob && currentJob.id === update.jobId) {
      set({
        currentJob: {
          ...currentJob,
          status: update.status,
          resultRef: update.resultRef,
        },
      });
    }
  },

  clearCurrentJob: () => set({ currentJob: null }),
}));

let unsubscribe: (() => void) | null = null;

export const initializeJobWebSocket = async (): Promise<void> => {
  if (unsubscribe) {
    unsubscribe();
  }

  await jobWebSocketService.connect();

  unsubscribe = jobWebSocketService.subscribe((update) => {
    useJobStore.getState().updateJobStatus(update);
  });
};

export const disconnectJobWebSocket = (): void => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  jobWebSocketService.disconnect();
};

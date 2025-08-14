export interface Config {
  discord: {
    token: string;
    musicChannelId: string;
  };
  music: {
    defaultVolume: number;
    maxQueueSize: number;
  };
  logging: {
    level: string;
  };
}

export interface Track {
  title: string;
  url: string;
  duration: number;
  thumbnail?: string;
  requestedBy: string;
}

export interface QueueItem extends Track {
  id: string;
  addedAt: Date;
}
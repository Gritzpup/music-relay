import { QueueItem } from '../types';

export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatQueue(queue: QueueItem[], currentTrack?: QueueItem): string {
  if (!currentTrack && queue.length === 0) {
    return '📃 The queue is empty';
  }

  let response = '';
  
  if (currentTrack) {
    response += `🎵 **Now Playing:**\n${currentTrack.title} - [${formatDuration(currentTrack.duration)}]\n\n`;
  }
  
  if (queue.length > 0) {
    response += `📃 **Queue (${queue.length} tracks):**\n`;
    queue.slice(0, 10).forEach((track, index) => {
      response += `${index + 1}. ${track.title} - [${formatDuration(track.duration)}]\n`;
    });
    
    if (queue.length > 10) {
      response += `\n... and ${queue.length - 10} more tracks`;
    }
  }
  
  return response;
}
import { expireReservations } from '../services/claims';

let expiryInterval: NodeJS.Timeout | null = null;

export function startExpiryWorker() {
  console.log('Starting simple expiry checker (runs every 1 minute)');
  
  expiryInterval = setInterval(async () => {
    try {
      console.log('Running expiry job...');
      await expireReservations();
      console.log('Expiry job completed');
    } catch (error) {
      console.error('Expiry job failed:', error);
    }
  }, 60 * 1000);
  
  return expiryInterval;
}

export async function scheduleExpiryCheck() {
  console.log('Expiry check scheduled to run every minute');
}

export function stopExpiryWorker() {
  if (expiryInterval) {
    clearInterval(expiryInterval);
    expiryInterval = null;
    console.log('Expiry worker stopped');
  }
}

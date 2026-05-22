// src/notifications/whatsapp-notifications.ts
import axios from 'axios';

export async function sendWhatsApp(to: string, message: string) {
  return axios.post('https://api.africastalking.com/whatsapp/message', {
    to, message
  }, {
    headers: { 'apiKey': process.env.WHATSAPP_TOKEN }
  });
}

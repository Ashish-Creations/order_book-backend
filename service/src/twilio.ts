import twilio from "twilio";
import { config } from "dotenv";

config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export const sendWhatsAppMessage = async (to: string, message: string) => {
  try {
    const msg = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER!,
      to: to,
      body: message,
    });

    console.log(
      "✅ WhatsApp message sent. SID:",
      msg.sid,
      "Status:",
      msg.status
    );
    return msg;
  } catch (error: any) {
    console.error(
      "❌ Failed to send WhatsApp message:",
      error.message || error
    );
    throw error;
  }
};

import twilio from "twilio";
import { config } from "dotenv";

config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export const sendWhatsAppMessage = async (to: string, message: string) => {
  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER!,
    to: `${to}`,
    body: message,
  });
};

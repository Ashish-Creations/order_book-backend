import express from "express";
import { config } from "dotenv";
import bodyParser from "body-parser";
import twilio from "twilio";
import cron from "node-cron";
import { db } from "./firabase";

config();
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Endpoint to handle incoming WhatsApp messages
app.post("/webhook", (req, res) => {
  const { Body, From } = req.body;
  console.log(`Received: ${Body} from ${From}`);

  // Example response
  client.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to: From,
    body: `Got your message: "${Body}"!`
  });

  res.sendStatus(200);
});

// Function to send a WhatsApp message
export const sendWhatsAppMessage = async (to: string, message: string) => {
  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to: `whatsapp:${to}`,
    body: message,
  });
};

cron.schedule("0 9 * * *", async () => {
  const snapshot = await db.collection("orders").get();
  
  snapshot.forEach(async (doc) => {
    const order = doc.data();
    
    if (order.status < 9) {
      await sendWhatsAppMessage("+1234567890", `Reminder: Order #${doc.id} is at Step ${order.status}. Update required.`);
    }
  });
});

app.listen(3000, () => console.log("Server running on port 3000"));

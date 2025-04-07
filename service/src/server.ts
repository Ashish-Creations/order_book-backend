import express from "express";
import { config } from "dotenv";
import bodyParser from "body-parser";
import twilio from "twilio";
import cron from "node-cron";
import { db } from "./firebase";
import { sendWhatsAppMessage } from "./twilio";

config();
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json()); // Recommended for JSON payloads too

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

// Endpoint to handle incoming WhatsApp messages
app.post("/webhook", async (req, res) => {
  const { Body, From } = req.body;
  console.log(`Received: ${Body} from ${From}`);

  // Example response
  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER!,
    to: From,
    body: `Got your message: "${Body}"!`,
  });

  res.sendStatus(200);
});

// Daily 9 AM cron job to send reminders
cron.schedule("0 9 * * *", async () => {
  const snapshot = await db.collection("orders").get();

  snapshot.forEach(async (doc: { data: () => any; id: any; }) => {
    const order = doc.data();

    if (order.status < 9) {
      await sendWhatsAppMessage(order.clientName, `Reminder: Order #${doc.id} is at Step ${order.status}. Update required.`);
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

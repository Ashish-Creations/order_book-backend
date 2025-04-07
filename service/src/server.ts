import express from "express";
import { config } from "dotenv";
import bodyParser from "body-parser";
import twilio from "twilio";
import cron from "node-cron";
import { db } from "./firebase";
import { sendWhatsAppMessage } from "./twilio";
import { addOrder, updateOrderStep, getOrderStatus } from "./orders";

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

  try {
    const message = Body.trim();

    // 🟢 Create new order
    if (message.startsWith("New Order")) {
      const match = message.match(/#(\d+), Client:\s*(.*), Product:\s*(.*)/i);
      if (match) {
        const orderId = match[1];
        const clientName = match[2].trim();
        const product = match[3].trim();

        await addOrder(orderId, From, product); // store phone number as customer
        await sendWhatsAppMessage(From, `✅ Order #${orderId} for "${product}" has been added.`);
      } else {
        await sendWhatsAppMessage(From, "⚠️ Couldn't parse the order. Please use: New Order: #ID, Client: Name, Product: Item");
      }
    }

    // 🟡 Update order step
    else if (message.startsWith("Update Order")) {
      const match = message.match(/#(\d+), Step:\s*(\d+)/i);
      if (match) {
        const orderId = match[1];
        const step = parseInt(match[2]);

        await updateOrderStep(orderId, step);
        await sendWhatsAppMessage(From, `✅ Order #${orderId} updated to Step ${step}.`);
      } else {
        await sendWhatsAppMessage(From, "⚠️ Couldn't parse the update. Please use: Update Order: #ID, Step: Number");
      }
    }

    // 🔵 Check order status
    else if (message.startsWith("Status")) {
      const match = message.match(/#(\d+)/);
      if (match) {
        const orderId = match[1];
        const order = await getOrderStatus(orderId);

        if (order) {
          await sendWhatsAppMessage(From, `📦 Order #${orderId}\nProduct: ${order.product}\nCurrent Step: ${order.status}`);
        } else {
          await sendWhatsAppMessage(From, `❌ No order found with ID #${orderId}`);
        }
      } else {
        await sendWhatsAppMessage(From, "⚠️ Couldn't find an order ID. Please use: Status #ID");
      }
    }

    // ❓ Unknown message
    else {
      await sendWhatsAppMessage(From, `🤖 I didn't understand that.\nYou can try:\n• New Order: #123, Client: Name, Product: Item\n• Update Order: #123, Step: 4\n• Status #123`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    await sendWhatsAppMessage(From, "⚠️ Something went wrong while processing your request.");
    res.sendStatus(500);
  }
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

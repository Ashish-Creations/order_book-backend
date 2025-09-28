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

// Add CORS middleware
app.use((req, res, next) => {
  // res.header("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "http://localhost:3000");
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

// Function to generate next order number
const generateOrderNumber = async () => {
  try {
    const snapshot = await db.collection("orders").get();
    const orderCount = snapshot.size;
    const currentYear = new Date().getFullYear();
    const nextNumber = orderCount + 1;
    return `${currentYear}-${nextNumber.toString().padStart(4, "0")}`;
  } catch (err) {
    console.error("Error generating order number:", err);
    // Fallback to timestamp-based number
    const currentYear = new Date().getFullYear();
    const timestamp = Date.now();
    return `${currentYear}-${timestamp.toString().slice(-4)}`;
  }
};

// Employees object
const employees = {
  "0009": "Ashish Shah",
};

// Function to generate current summary of all stage data
const generateStageSummary = (formData: any, currentStage: number) => {
  const stageNames = [
    "Inquiry",
    "Requirements Analysis",
    "Proposal",
    "Development Planning",
    "Packaging & Dispatch",
    "Completion",
  ];

  let summary = "Current Summary:\n";

  for (let stage = 1; stage <= currentStage; stage++) {
    const stageName = stageNames[stage - 1];
    summary += `Stage ${stage}: ${stageName}\n`;

    // Get all fields for this stage
    const stageFields = Object.keys(formData).filter((key) =>
      key.startsWith(`stage${stage}_`)
    );

    if (stageFields.length > 0) {
      stageFields.forEach((fieldKey) => {
        const fieldName = fieldKey.replace(`stage${stage}_`, "");
        const value = formData[fieldKey];
        if (value && value.trim() !== "") {
          // Format field name for display
          const displayName = fieldName
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase());
          summary += `  - ${displayName}: ${value}\n`;
        }
      });
    }
    summary += "\n";
  }

  return summary;
};

// Function to get stage name by stage number
const getStageName = (stageNumber: number) => {
  const stageNames = [
    "Inquiry",
    "Requirements Analysis",
    "Proposal",
    "Development Planning",
    "Delivery",
    "Completion",
  ];
  return stageNames[stageNumber - 1] || "Unknown Stage";
};

// Function to send daily pending orders notification
const sendDailyPendingOrdersNotification = async () => {
  try {
    console.log("Running daily pending orders notification...");

    // Get all orders from database
    const snapshot = await db.collection("orders").get();
    const orders = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter orders by status
    const inProgressOrders = orders.filter(
      (order: any) => order.status === "in-progress"
    );
    const paymentPendingOrders = orders.filter(
      (order: any) => order.status === "payment-pending"
    );

    // Build message
    let message = "📋 *Daily Pending Orders Report*\n\n";

    if (inProgressOrders.length > 0) {
      message += "🔄 *In-progress Orders:*\n";
      inProgressOrders.forEach((order: any) => {
        const stageName = getStageName(order.currentStage);
        message += `• ${
          order.companyName || "Unknown Company"
        } - ${stageName}\n`;
      });
      message += "\n";
    } else {
      message += "🔄 *In-progress Orders:* None\n\n";
    }

    if (paymentPendingOrders.length > 0) {
      message += "💰 *Payment Pending Orders:*\n";
      paymentPendingOrders.forEach((order: any) => {
        const stageName = getStageName(order.currentStage);
        message += `• ${
          order.companyName || "Unknown Company"
        } - ${stageName}\n`;
      });
    } else {
      message += "💰 *Payment Pending Orders:* None\n";
    }

    // Send WhatsApp message
    const whatsappNumber =
      process.env.WHATSAPP_RECIPIENT_NUMBER || "+17828826459";
    await sendWhatsAppMessage(`whatsapp:${whatsappNumber}`, message);
    console.log("Daily pending orders notification sent successfully");
  } catch (err) {
    console.error("Error sending daily pending orders notification:", err);
  }
};

// Schedule daily notification at 9 AM IST (3:30 AM UTC)
// IST is UTC+5:30, so 9 AM IST = 3:30 AM UTC
cron.schedule("30 3 * * *", sendDailyPendingOrdersNotification, {
  timezone: "UTC",
});

console.log("Daily notification scheduled for 9 AM IST (3:30 AM UTC)");

// Endpoint to get next order number
app.get("/next-order-number", async (req, res) => {
  try {
    const orderNumber = await generateOrderNumber();
    res.status(200).json({ success: true, orderNumber });
  } catch (err) {
    console.error("/next-order-number error:", err);
    res.status(500).json({ error: "Failed to generate order number" });
  }
});

// Remove the /webhook endpoint and the cron job for reminders

//test message endpoint

app.post("/test-message", async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res
        .status(400)
        .json({ error: "Please provide 'to' and 'message' in the body." });
    }
    console.log("Sending test message to:", to);
    await sendWhatsAppMessage(to, message);
    res
      .status(200)
      .json({ success: true, message: "Message sent via WhatsApp!" });
  } catch (err) {
    console.error("Error sending test message:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.get("/test-db", async (req, res) => {
  try {
    // Write test data
    const testRef = db.collection("test").doc("connection-check");
    await testRef.set({
      timestamp: new Date(),
      message: "Database connection successful",
    });

    // Read back the data
    const doc = await testRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Test document not found" });
    }

    res.status(200).json({ success: true, data: doc.data() });
  } catch (err) {
    console.error("Firestore test error:", err);
    res.status(500).json({ error: "Failed to connect to Firestore" });
  }
});

app.post("/complete-order", async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: "Missing orderId" });
    // Fetch order details
    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (!orderDoc.exists)
      return res.status(404).json({ error: "Order not found" });
    const order = orderDoc.data();
    if (!order) return res.status(404).json({ error: "Order data missing" });
    // Mark as completed
    await db.collection("orders").doc(orderId).update({
      status: "completed",
      currentStage: 6,
      lastUpdated: new Date().toISOString(),
      updatedAt: new Date(),
    });
    // Send detailed WhatsApp message
    const employeeCode =
      order.formData?.[`stage${order.currentStage}_employeeCode`] || "0009";
    const employeeName =
      employees[employeeCode as keyof typeof employees] || "Unknown Employee";
    const stageName = getStageName(order.currentStage);

    const message = `${orderId}\n${
      order.companyName || order.clientName
    }\nStage ${
      order.currentStage
    } updated\n${employeeName} updated ${stageName}\n\n${generateStageSummary(
      order.formData || {},
      order.currentStage
    )}`;

    const whatsappNumber =
      process.env.WHATSAPP_RECIPIENT_NUMBER || "+17828826459";
    await sendWhatsAppMessage(`whatsapp:${whatsappNumber}`, message);
    res.status(200).json({
      success: true,
      message: "Order completed and WhatsApp message sent!",
    });
  } catch (err) {
    console.error("/complete-order error:", err);
    res.status(500).json({ error: "Failed to complete order" });
  }
});

// Add RESTful endpoints for order creation and update
app.post("/orders", async (req, res) => {
  try {
    const {
      orderId,
      companyName = "",
      product = "",
      orderNumber,
      ...rest
    } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }
    const currentStage = rest.currentStage || 1;
    const status = currentStage === 6 ? "payment-pending" : "in-progress";
    const now = new Date();

    // Process savedStages to include employee codes
    let processedSavedStages = [];
    if (rest.savedStages && Array.isArray(rest.savedStages)) {
      processedSavedStages = rest.savedStages.map((stage: any) => {
        if (typeof stage === "number") {
          // Convert old format to new format
          return { [stage]: "0009" }; // Default to Ashish Shah
        }
        return stage;
      });
    }

    const orderData = {
      orderNumber: orderNumber || orderId,
      companyName,
      product,
      status,
      currentStage,
      dateInitiated: now.toISOString(),
      lastUpdated: now.toISOString(),
      updatedAt: now,
      savedStages: processedSavedStages,
      ...rest,
    };
    console.log("Creating order with data:", orderData); // Debug log
    await db.collection("orders").doc(orderId).set(orderData);
    res.status(201).json({ success: true, message: "Order created!" });
  } catch (err) {
    console.error("/orders POST error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Migration endpoint to add dateInitiated to existing orders
app.post("/migrate-dates", async (req, res) => {
  try {
    const snapshot = await db.collection("orders").get();
    const batch = db.batch();
    let updatedCount = 0;

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (!data.dateInitiated) {
        // Use updatedAt if available, otherwise use current time
        const dateInitiated = data.updatedAt
          ? new Date(data.updatedAt).toISOString()
          : new Date().toISOString();
        batch.update(doc.ref, {
          dateInitiated,
          lastUpdated: data.lastUpdated || dateInitiated,
        });
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`Updated ${updatedCount} orders with dateInitiated field`);
    }

    res.status(200).json({
      success: true,
      message: `Migration completed. Updated ${updatedCount} orders.`,
    });
  } catch (err) {
    console.error("Migration error:", err);
    res.status(500).json({ error: "Failed to migrate dates" });
  }
});

app.put("/orders/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const updateData = req.body;
    if (!orderId)
      return res.status(400).json({ error: "Missing orderId in params" });

    // Calculate status based on current stage
    const currentStage = updateData.currentStage || 1;
    updateData.status = currentStage === 6 ? "payment-pending" : "in-progress";
    updateData.lastUpdated = new Date().toISOString();
    updateData.updatedAt = new Date();

    // Process savedStages to include employee codes
    if (updateData.savedStages && Array.isArray(updateData.savedStages)) {
      updateData.savedStages = updateData.savedStages.map((stage: any) => {
        if (typeof stage === "number") {
          // Convert old format to new format
          return { [stage]: "0009" }; // Default to Ashish Shah
        }
        return stage;
      });
    }

    await db.collection("orders").doc(orderId).update(updateData);

    // Send WhatsApp notification for stage update
    if (updateData.formData) {
      const employeeCode =
        updateData.formData[`stage${currentStage}_employeeCode`] || "0009";
      const employeeName =
        employees[employeeCode as keyof typeof employees] || "Unknown Employee";
      const stageName = getStageName(currentStage);
      const companyName = updateData.companyName || "Unknown Company";

      const message = `${orderId}\n${companyName}\nStage ${currentStage} updated\n${employeeName} updated ${stageName}\n\n${generateStageSummary(
        updateData.formData,
        currentStage
      )}`;

      const whatsappNumber =
        process.env.WHATSAPP_RECIPIENT_NUMBER || "+17828826459";
      await sendWhatsAppMessage(`whatsapp:${whatsappNumber}`, message);
    }

    res.status(200).json({ success: true, message: "Order updated!" });
  } catch (err) {
    console.error("/orders PUT error:", err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

// Add GET endpoint to fetch all orders
app.get("/orders", async (req, res) => {
  try {
    const snapshot = await db.collection("orders").get();
    const orders = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    console.log("Sample order data:", orders[0]); // Debug log
    console.log(
      "All order fields:",
      orders[0] ? Object.keys(orders[0]) : "No orders"
    ); // Debug log
    console.log(
      "Date fields check:",
      orders[0]
        ? {
            dateInitiated: (orders[0] as any).dateInitiated,
            lastUpdated: (orders[0] as any).lastUpdated,
            updatedAt: (orders[0] as any).updatedAt,
          }
        : "No orders"
    ); // Debug log
    res.status(200).json({ success: true, orders });
  } catch (err) {
    console.error("/orders GET error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Add GET endpoint to fetch a specific order by ID
app.get("/orders/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ error: "Missing orderId" });

    const doc = await db.collection("orders").doc(orderId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Order not found" });
    }

    const orderData = doc.data();
    res
      .status(200)
      .json({ success: true, order: { id: doc.id, ...orderData } });
  } catch (err) {
    console.error("/orders/:orderId GET error:", err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// Manual endpoint to test daily notification
app.post("/test-daily-notification", async (req, res) => {
  try {
    await sendDailyPendingOrdersNotification();
    res
      .status(200)
      .json({ success: true, message: "Daily notification test sent!" });
  } catch (err) {
    console.error("Test daily notification error:", err);
    res.status(500).json({ error: "Failed to send test notification" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

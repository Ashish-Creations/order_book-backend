import { db } from "./firebase";

// Add a new order
export const addOrder = async (orderId: string, clientName: string, product: string) => {
  await db.collection("orders").doc(orderId).set({
    clientName,
    product,
    status: 1,
    updatedAt: new Date(),
  });
};

// Update order status
export const updateOrderStep = async (orderId: string, step: number) => {
  await db.collection("orders").doc(orderId).update({
    status: step,
    updatedAt: new Date(),
  });
};

// Get order status
export const getOrderStatus = async (orderId: string) => {
  const doc = await db.collection("orders").doc(orderId).get();
  return doc.exists ? doc.data() : null;
};

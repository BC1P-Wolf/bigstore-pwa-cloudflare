import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  increment 
} from 'firebase/firestore';
import { db, rtdb } from './firebase';
import { 
  ref as dbRef, 
  update as rtdbUpdate, 
  push as rtdbPush, 
  query as rtdbQuery, 
  orderByChild, 
  equalTo, 
  get as rtdbGet 
} from 'firebase/database';

/**
 * Calcula o percentual de desconto aplicável de acordo com as faixas de quantityPromotions
 * @param {Array<{ quantity: number, discountPercent: number }>} quantityPromotions
 * @param {number} quantity
 * @returns {number} Percentual de desconto (ex: 10 para 10%)
 */
export function calculateDiscount(quantityPromotions = [], quantity = 1) {
  if (!quantityPromotions || !Array.isArray(quantityPromotions) || quantityPromotions.length === 0) {
    return 0;
  }

  // Ordena decrescente pela quantidade requerida
  const sortedPromos = [...quantityPromotions].sort((a, b) => b.quantity - a.quantity);
  
  for (const promo of sortedPromos) {
    if (quantity >= promo.quantity) {
      return Number(promo.discountPercent) || 0;
    }
  }

  return 0;
}

/**
 * Calcula o valor final considerando descontos promocionais
 * @param {number} unitPrice
 * @param {number} quantity
 * @param {Array} quantityPromotions
 * @returns {{ unitPrice: number, discountPercent: number, subtotal: number, total: number }}
 */
export function calculateItemTotal(unitPrice, quantity, quantityPromotions = []) {
  const discountPercent = calculateDiscount(quantityPromotions, quantity);
  const subtotal = unitPrice * quantity;
  const discountAmount = subtotal * (discountPercent / 100);
  const total = Math.max(0, subtotal - discountAmount);

  return {
    unitPrice,
    discountPercent,
    subtotal,
    total: Number(total.toFixed(2))
  };
}

/**
 * Cria ordens individuais granulares para cada produto do carrinho no Realtime Database (RTDB)
 * (Regra: Alta performance via WebSockets, eliminando leituras e gravações diárias no Firestore)
 * @param {Object} params
 * @param {Array} params.cartItems
 * @param {Object} params.customer
 * @param {string} params.paymentId
 * @returns {Promise<Array<string>>} Lista dos IDs das ordens criadas
 */
export async function createGranularOrders({ cartItems, customer, paymentId }) {
  if (!cartItems || cartItems.length === 0) {
    throw new Error("O carrinho está vazio.");
  }

  const createdOrderIds = [];
  const nowIso = new Date().toISOString();
  const rtdbUpdates = {};

  for (const item of cartItems) {
    const orderKey = rtdbPush(dbRef(rtdb, 'orders')).key;
    const calculation = calculateItemTotal(item.price, item.quantity, item.quantityPromotions);

    createdOrderIds.push(orderKey);
    rtdbUpdates[`orders/${orderKey}`] = {
      id: orderKey,
      customerId: customer.uid,
      customerEmail: customer.email || "",
      customerName: customer.displayName || "Cliente",
      productId: item.id,
      productName: item.name,
      productImage: item.imageUrl || item.imagePath || "",
      category: item.category || "product",
      customLink: item.customLink || null, // Obrigatório se categoria for 'service'
      quantity: item.quantity,
      unitPrice: item.price,
      discountPercent: calculation.discountPercent,
      totalPrice: calculation.total,
      total: calculation.total,
      paymentId: paymentId,
      paymentStatus: "pending",
      status: "Na Fila", // Status inicial após confirmação
      assignedOperatorId: null,
      assignedOperatorName: null,
      createdAt: nowIso,
      updatedAt: nowIso
    };
  }

  // Grava diretamente no Realtime Database (zero consumo de cota no Firestore)
  await rtdbUpdate(dbRef(rtdb), rtdbUpdates);

  return createdOrderIds;
}

/**
 * Atualiza status dos pedidos vinculados ao pagamento aprovado
 * E calcula a comissão de 2% do programa de indicação para o usuário que indicou!
 * @param {string} paymentId
 */
export async function confirmOrdersPayment(paymentId) {
  if (!paymentId) return;

  // 1. Busca os pedidos correspondentes diretamente no RTDB
  let totalOrderSum = 0;
  let customerId = null;
  let customerName = "";

  try {
    const ordersQuery = rtdbQuery(dbRef(rtdb, 'orders'), orderByChild('paymentId'), equalTo(paymentId));
    const snap = await rtdbGet(ordersQuery);
    if (!snap.exists()) return;

    const ordersVal = snap.val();
    const orderEntries = Object.entries(ordersVal);
    const rtdbUpdates = {};
    const nowIso = new Date().toISOString();

    for (const [orderId, orderData] of orderEntries) {
      totalOrderSum += Number(orderData.totalPrice || orderData.total || 0);
      if (!customerId && orderData.customerId) {
        customerId = orderData.customerId;
        customerName = orderData.customerName || "Cliente";
      }

      rtdbUpdates[`orders/${orderId}/paymentStatus`] = "approved";
      rtdbUpdates[`orders/${orderId}/status`] = "Na Fila";
      rtdbUpdates[`orders/${orderId}/updatedAt`] = nowIso;
    }

    await rtdbUpdate(dbRef(rtdb), rtdbUpdates);
  } catch (rtdbErr) {
    console.warn("Aviso ao atualizar status no RTDB:", rtdbErr);
    return;
  }

  // 2. Processamento da comissão de 2% do Programa de Indicação (Firestore users / commissions)
  if (customerId && totalOrderSum > 0) {
    try {
      const customerDocSnap = await getDoc(doc(db, "users", customerId));
      if (customerDocSnap.exists()) {
        const customerData = customerDocSnap.data();
        const invitedBy = customerData.invitedBy;

        if (invitedBy && invitedBy !== "system") {
          // Localizar o indicador pelo UID ou código de indicação
          let referrerDocRef = null;
          const directRefSnap = await getDoc(doc(db, "users", invitedBy));
          if (directRefSnap.exists()) {
            referrerDocRef = directRefSnap.ref;
          } else {
            const userQ = query(collection(db, "users"), where("referralCode", "==", invitedBy));
            const userSnap = await getDocs(userQ);
            if (!userSnap.empty) {
              referrerDocRef = userSnap.docs[0].ref;
            }
          }

          if (referrerDocRef) {
            const commissionAmount = Number((totalOrderSum * 0.02).toFixed(2));
            
            // Credita 2% no saldo de indicações do indicador
            await updateDoc(referrerDocRef, {
              referralEarnings: increment(commissionAmount),
              updatedAt: serverTimestamp()
            });

            // Registra no histórico de comissões
            await addDoc(collection(db, "commissions"), {
              referrerId: referrerDocRef.id,
              customerId,
              customerName,
              paymentId,
              orderTotal: totalOrderSum,
              commissionRate: 0.02,
              commissionAmount,
              createdAt: serverTimestamp()
            });
            console.log(`Comissão de 2% (R$ ${commissionAmount}) creditada com sucesso.`);
          }
        }
      }
    } catch (commErr) {
      console.warn("Aviso ao processar comissão de indicação:", commErr);
    }
  }
}

/**
 * Busca pedidos granulares de um cliente no Realtime Database (RTDB)
 * @param {string} customerId
 * @returns {Promise<Array>}
 */
export async function getCustomerOrders(customerId) {
  if (!customerId) return [];

  try {
    const ordersQuery = rtdbQuery(dbRef(rtdb, 'orders'), orderByChild('customerId'), equalTo(customerId));
    const snap = await rtdbGet(ordersQuery);
    if (!snap.exists()) return [];

    const val = snap.val();
    return Object.entries(val)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err) {
    console.warn("Erro ao buscar pedidos no RTDB:", err);
    return [];
  }
}

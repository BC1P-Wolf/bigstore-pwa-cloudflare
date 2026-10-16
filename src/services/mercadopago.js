/**
 * Mercado Pago Pix Integration Service
 * Integração robusta com a API do Mercado Pago usando a chave cadastrada em settings/financial.
 * Suporta modo de teste e criação de pedidos granulares no Realtime Database (RTDB).
 */

import { ref as dbRef, get, remove, query as rtdbQuery, orderByChild, equalTo, limitToFirst } from "firebase/database";
import { auth, rtdb } from "./firebase";
import { fetchDashboardApi } from "./apiConfig";

/**
 * Cria cobrança Pix real conectada ao Mercado Pago e persiste pedidos no RTDB via servidor.
 */
export async function createPixPayment({ amount, cartItems = [], payerEmail, payerName }) {
  const customerId = auth.currentUser?.uid || "guest";
  const customerEmail = payerEmail || auth.currentUser?.email || "cliente@vendario.com";
  const customerName = payerName || auth.currentUser?.displayName || "Cliente Vendário";

  let idToken = "";
  try {
    if (auth.currentUser) {
      idToken = await auth.currentUser.getIdToken();
    }
  } catch {}

  const res = await fetchDashboardApi("/api/payments/pix", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({
      customerId,
      customerEmail,
      customerName,
      cartItems,
      amount,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.error ||
        "Não foi possível gerar a cobrança Pix no Mercado Pago. Verifique se a chave de produção (APP_USR-...) está configurada no painel."
    );
  }

  try {
    const prev = JSON.parse(localStorage.getItem('vendario_pwa_created_orders') || '[]');
    const next = Array.from(new Set([...prev, ...(data.orderIds || [])]));
    localStorage.setItem('vendario_pwa_created_orders', JSON.stringify(next));
  } catch {}

  return {
    id: data.paymentId,
    status: "pending",
    qr_code: data.qr_code,
    qr_code_base64: data.qr_code_base64,
    expiration: data.expiration,
    amount: data.amount,
    orderIds: data.orderIds || [],
    isTestMode: false,
    sellerNickname: data.sellerNickname || "",
  };
}

/**
 * Solicita ao servidor a verificação ativa do status do pagamento diretamente na API oficial do Mercado Pago.
 * Garante confirmação automática em segundos mesmo que o webhook ainda esteja em trânsito.
 */
export async function verifyPixPaymentOnServer(paymentId) {
  if (!paymentId) return { approved: false };
  try {
    const res = await fetchDashboardApi(`/api/webhooks/mercadopago?id=${encodeURIComponent(paymentId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { id: paymentId } }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return { approved: false };
}

/**
 * Consulta status de pagamento
 */
export async function checkPixPaymentStatus(paymentId) {
  try {
    const ordersRef = dbRef(rtdb, "orders");
    const q = rtdbQuery(ordersRef, orderByChild("paymentId"), equalTo(paymentId), limitToFirst(10));
    const snap = await get(q);
    if (snap.exists()) {
      const orders = Object.values(snap.val());
      const approved = orders.some((o) => {
        const ps = String(o.paymentStatus || "").trim().toLowerCase();
        const st = String(o.status || "").trim().toLowerCase();
        return ps === "approved" || st === "na fila" || st === "pending" || st === "em progresso" || st === "in_progress";
      });
      return { status: approved ? "approved" : "pending", approved };
    }
  } catch {}
  return { status: "pending", approved: false };
}

/**
 * Obtém o timestamp exato de expiração do pagamento no Mercado Pago (em milissegundos).
 * Padrão Mercado Pago Pix: 15 minutos (900.000 ms) caso não haja campo explícito.
 */
export function getMercadoPagoExpirationTime(order) {
  if (!order) return 0;
  if (order.expiresAt) {
    const t = new Date(order.expiresAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (order.paymentExpiration) {
    const t = new Date(order.paymentExpiration).getTime();
    if (!isNaN(t)) return t;
  }
  if (order.date_of_expiration) {
    const t = new Date(order.date_of_expiration).getTime();
    if (!isNaN(t)) return t;
  }
  if (order.createdAt) {
    const created = new Date(order.createdAt).getTime();
    if (!isNaN(created)) return created + 15 * 60 * 1000;
  }
  return 0;
}

/**
 * Verifica se a cobrança Pix do pedido expirou no Mercado Pago.
 * Apenas pedidos que estão com status pendente de pagamento são elegíveis para expiração.
 */
export function isOrderPaymentExpired(order) {
  if (!order) return false;
  const ps = String(order.paymentStatus || "").trim().toLowerCase();
  const st = String(order.status || "").trim().toLowerCase();

  // Se já foi aprovado ou já está na fila / em atendimento / concluído, NUNCA expira
  if (
    ps === "approved" ||
    st === "na fila" ||
    st === "pending" ||
    st === "em progresso" ||
    st === "in_progress" ||
    st === "concluído" ||
    st === "concluido" ||
    st === "completed"
  ) {
    return false;
  }

  const isPending =
    ps === "pending" ||
    st === "aguardando pagamento" ||
    st === "pending_payment";

  if (!isPending) return false;

  const expirationMs = getMercadoPagoExpirationTime(order);
  if (!expirationMs) return false;

  return Date.now() >= expirationMs;
}

/**
 * Exclui totalmente o pedido e seus registros associados (RTDB, mensagens, chats e caches locais).
 */
export async function deleteOrderTotally(orderId) {
  if (!orderId) return;

  // 1. Remove diretamente do Realtime Database (RTDB) com 0 invocações de Cloud Functions
  let removedFromRtdb = false;
  try {
    await remove(dbRef(rtdb, `orders/${orderId}`));
    await remove(dbRef(rtdb, `order_chats/${orderId}`)).catch(() => {});
    removedFromRtdb = true;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[deleteOrderTotally] Falha ao remover nós no RTDB:", err);
    }
  }

  // 2. Fallback via API backend apenas se a remoção direta no RTDB falhar
  if (!removedFromRtdb) {
    try {
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => "") : "";
      await fetchDashboardApi(`/api/orders/${orderId}`, {
        method: "DELETE",
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      }).catch(() => {});
    } catch {}
  }

  // 3. Limpa referências locais no dispositivo
  try {
    const prev = JSON.parse(localStorage.getItem("vendario_pwa_created_orders") || "[]");
    const next = prev.filter((id) => id !== orderId);
    localStorage.setItem("vendario_pwa_created_orders", JSON.stringify(next));
  } catch {}

  // 4. Limpa caches de pedidos no localStorage para evitar recarregamento fantasma
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("vendario_pwa_orders_")) {
        const cached = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(cached)) {
          const filtered = cached.filter((o) => o.id !== orderId && o.paymentId !== orderId);
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      }
    }
  } catch {}
}

/**
 * Exclui totalmente todos os pedidos vinculados a um paymentId do Mercado Pago (somente se não aprovados).
 */
export async function deleteOrdersByPaymentId(paymentId) {
  if (!paymentId) return;
  try {
    const ordersRef = dbRef(rtdb, "orders");
    const q = rtdbQuery(ordersRef, orderByChild("paymentId"), equalTo(paymentId), limitToFirst(10));
    const snap = await get(q);
    if (snap.exists()) {
      const orders = snap.val();
      const keysToDelete = Object.entries(orders)
        .filter(([, o]) => isOrderPaymentExpired(o) || String(o?.paymentStatus || "").toLowerCase() === "pending")
        .map(([k]) => k);
      await Promise.all(keysToDelete.map((k) => deleteOrderTotally(k)));
    }
  } catch (err) {
    console.warn("[deleteOrdersByPaymentId] Erro ao buscar pedidos por paymentId:", err);
  }
}

/**
 * Varre a lista de pedidos, detecta os expirados pelo time do Mercado Pago e exclui todos totalmente.
 * Retorna apenas os pedidos válidos e não expirados.
 */
export async function purgeExpiredOrders(ordersList = []) {
  if (!Array.isArray(ordersList) || ordersList.length === 0) return [];

  const valid = [];
  const expired = [];

  for (const order of ordersList) {
    if (isOrderPaymentExpired(order)) {
      expired.push(order);
    } else {
      valid.push(order);
    }
  }

  if (expired.length > 0) {
    await Promise.all(expired.map((exp) => deleteOrderTotally(exp.id)));
  }

  return valid;
}

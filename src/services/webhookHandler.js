/**
 * Mercado Pago Webhook / IPN Handler
 * Processa notificações de pagamento do Mercado Pago e atualiza os pedidos no Firestore.
 */

import { confirmOrdersPayment } from './orderService';

/**
 * Processa payload recebido via webhook do Mercado Pago (ou simulador de IPN)
 * @param {Object} webhookBody
 * @param {string} webhookBody.type - ex: "payment"
 * @param {Object} webhookBody.data - ex: { id: "12345678" }
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function handleMercadoPagoWebhook(webhookBody) {
  try {
    const paymentId = webhookBody?.data?.id || webhookBody?.id;

    if (!paymentId) {
      return { success: false, message: "ID do pagamento não informado." };
    }

    // Se o evento for de pagamento aprovado
    if (webhookBody.action === "payment.updated" || webhookBody.type === "payment" || !webhookBody.type) {
      await confirmOrdersPayment(paymentId.toString());
      return { 
        success: true, 
        message: `Pagamento #${paymentId} confirmado e pedidos avançados para 'Na Fila'.` 
      };
    }

    return { success: true, message: "Notificação recebida com sucesso." };
  } catch (error) {
    console.error("Erro ao processar webhook do Mercado Pago:", error);
    return { success: false, message: error.message };
  }
}

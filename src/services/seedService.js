import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { ref as dbRef, get as rtdbGet, set as rtdbSet } from 'firebase/database';
import { db, rtdb } from './firebase';

/**
 * Seeder inicial para garantir que o Realtime Database e Firestore possuam as configurações:
 * - Realtime Database: settings/platform (toggles e company)
 * - Firestore: invitations e products
 */
export async function seedInitialDataIfEmpty() {
  try {
    // 1. Verificar e criar settings/platform no Realtime Database
    try {
      const rtdbPlatformRef = dbRef(rtdb, 'settings/platform');
      const rtdbSnap = await rtdbGet(rtdbPlatformRef);
      if (!rtdbSnap.exists()) {
        await rtdbSet(rtdbPlatformRef, {
          toggles: {
            platform: true,
            maintenance: false,
            email: true,
            newClients: true,
            receipt: true,
            transfer: true,
            warning: false
          },
          company: {
            platformName: "Vendário",
            email: "suporte@vendario.com.br",
            phone: "+55 (11) 99999-8888",
            address: "Av. Paulista, 1000 - São Paulo, SP"
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        console.log('Seed: Realtime Database settings/platform inicializado.');
      }
    } catch (rtdbErr) {
      console.warn('Aviso ao seedar Realtime Database:', rtdbErr);
    }

    // 2. Verificar e criar convites padrão na coleção invitations
    const vipInviteRef = doc(db, 'invitations', 'VIP2026');
    const vipSnap = await getDoc(vipInviteRef);

    if (!vipSnap.exists()) {
      await setDoc(vipInviteRef, {
        id: "VIP2026",
        code: "VIP2026",
        status: "active",
        createdBy: "system",
        creatorName: "Administrador Vendário",
        usedCount: 0,
        maxUses: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await setDoc(doc(db, 'invitations', 'VENDARIO'), {
        id: "VENDARIO",
        code: "VENDARIO",
        status: "active",
        createdBy: "system",
        creatorName: "Administrador Vendário",
        usedCount: 0,
        maxUses: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await setDoc(doc(db, 'invitations', 'AMIGO2'), {
        id: "AMIGO2",
        code: "AMIGO2",
        status: "active",
        createdBy: "system",
        creatorName: "Administrador Vendário",
        usedCount: 0,
        maxUses: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('Seed: Convites iniciais (VIP2026, VENDARIO, AMIGO2) criados.');
    }

    // 3. Verificar produtos na coleção products
    const productsSnap = await getDocs(collection(db, 'products'));
    if (productsSnap.empty) {
      const initialProducts = [
        {
          id: 'serv-insta-01',
          name: 'Engajamento & Seguidores Reais Instagram',
          description: 'Serviço de engajamento premium brasileiro de alta retenção para perfis ativos.',
          category: 'service',
          imagePath: 'products/serv-insta.jpg',
          imageUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60',
          minOrderQuantity: 1,
          price: 39.90,
          quantityPromotions: [
            { quantity: 2, discountPercent: 10 },
            { quantity: 5, discountPercent: 20 },
            { quantity: 10, discountPercent: 30 }
          ]
        },
        {
          id: 'serv-tg-02',
          name: 'Impulsionamento de Canal Telegram / YouTube',
          description: 'Aumento de audiência e membros verificados com entrega monitorada.',
          category: 'service',
          imagePath: 'products/serv-telegram.jpg',
          imageUrl: 'https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=500&auto=format&fit=crop&q=60',
          minOrderQuantity: 1,
          price: 49.90,
          quantityPromotions: [
            { quantity: 3, discountPercent: 15 },
            { quantity: 6, discountPercent: 25 }
          ]
        },
        {
          id: 'prod-gift-03',
          name: 'Gift Card Digital VIP Vendário R$ 100',
          description: 'Saldo recarregável para uso em serviços e produtos parceiros com cashback.',
          category: 'product',
          imagePath: 'products/gift-card.jpg',
          imageUrl: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=500&auto=format&fit=crop&q=60',
          minOrderQuantity: 1,
          price: 100.00,
          quantityPromotions: [
            { quantity: 5, discountPercent: 5 },
            { quantity: 10, discountPercent: 12 }
          ]
        },
        {
          id: 'serv-seo-04',
          name: 'Otimização SEO & Tráfego Segmentado',
          description: 'Campanha de tráfego orgânico voltado para páginas de captura e e-commerce.',
          category: 'service',
          imagePath: 'products/serv-seo.jpg',
          imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&auto=format&fit=crop&q=60',
          minOrderQuantity: 1,
          price: 89.00,
          quantityPromotions: [
            { quantity: 2, discountPercent: 10 },
            { quantity: 4, discountPercent: 25 }
          ]
        }
      ];

      for (const prod of initialProducts) {
        await setDoc(doc(db, 'products', prod.id), {
          ...prod,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      console.log('Seed: Produtos e serviços iniciais criados no Firestore.');
    }
  } catch (err) {
    console.warn('Seed ignorado ou sem permissão direta:', err);
  }
}

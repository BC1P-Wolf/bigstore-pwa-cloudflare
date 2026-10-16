/**
 * Detecção Automática e Resiliente de Domínio da API (Dashboard Backend)
 *
 * Suporta automaticamente:
 * - Subdomínios customizados (ex: mobile.vendario.net -> https://dashboard.vendario.net)
 * - Domínios padrão do Firebase Hosting (ex: mobile-vendario.web.app -> https://dashboard-vendario.web.app)
 * - Ambiente de desenvolvimento local (localhost -> http://localhost:3001)
 * - Failover transparente entre domínio customizado e domínio .web.app caso DNS/SSL esteja propagando.
 */

const FIREBASE_DEFAULT_DASHBOARD = "https://dashboard-vendario.web.app";
const CUSTOM_DEFAULT_DASHBOARD = "https://dashboard.vendario.net";
const CUSTOM_DEFAULT_PWA = "https://mobile.vendario.net";

let resolvedApiBase = null;

/**
 * Retorna a origem pública oficial da PWA (https://mobile.vendario.net)
 * para geração de links de convite e compartilhamento no WhatsApp,
 * evitando expor domínios internos .web.app / .firebaseapp.com.
 */
export function getPwaPublicOrigin() {
  if (process.env.REACT_APP_PWA_URL) {
    return process.env.REACT_APP_PWA_URL.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname.toLowerCase().trim();
    if (host === "localhost" || host === "127.0.0.1") {
      return window.location.origin;
    }
    if (!host.endsWith(".web.app") && !host.endsWith(".firebaseapp.com") && !host.endsWith(".pages.dev")) {
      const rootDomain = host.replace(/^(dashboard|painel|admin|mobile|pwa|app|loja|www)\./i, "");
      return `https://mobile.${rootDomain}`;
    }
  }
  return CUSTOM_DEFAULT_PWA;
}

/**
 * Retorna a lista ordenada de URLs candidatas para o backend do Dashboard
 * com base no hostname atual onde a PWA está rodando.
 */
export function getDashboardApiCandidates() {
  const candidates = [];

  if (process.env.REACT_APP_API_URL) {
    candidates.push(process.env.REACT_APP_API_URL.replace(/\/$/, ""));
  }

  if (typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname.toLowerCase().trim();

    if (host === "localhost" || host === "127.0.0.1") {
      candidates.push("http://localhost:3001");
      candidates.push(CUSTOM_DEFAULT_DASHBOARD);
      candidates.push(FIREBASE_DEFAULT_DASHBOARD);
    } else if (host.endsWith(".web.app") || host.endsWith(".firebaseapp.com") || host.endsWith(".pages.dev")) {
      // Prioriza o domínio oficial com failover transparente para .web.app
      candidates.push(CUSTOM_DEFAULT_DASHBOARD);
      candidates.push(FIREBASE_DEFAULT_DASHBOARD);
    } else {
      // Rodando em domínio/subdomínio próprio (ex: mobile.vendario.net, vendario.net)
      const rootDomain = host.replace(/^(mobile|pwa|app|loja|www)\./i, "");
      const derivedDashboard = rootDomain.startsWith("dashboard.")
        ? `https://${rootDomain}`
        : `https://dashboard.${rootDomain}`;

      candidates.push(derivedDashboard);
      candidates.push(FIREBASE_DEFAULT_DASHBOARD);
    }
  } else {
    candidates.push(CUSTOM_DEFAULT_DASHBOARD);
    candidates.push(FIREBASE_DEFAULT_DASHBOARD);
  }

  return Array.from(new Set(candidates));
}

/**
 * Retorna a URL base principal da API do Dashboard.
 */
export function getDashboardApiUrl() {
  if (resolvedApiBase) return resolvedApiBase;
  const candidates = getDashboardApiCandidates();
  return candidates[0] || CUSTOM_DEFAULT_DASHBOARD;
}

/**
 * Executa fetch para a API do Dashboard com detecção automática de domínio
 * e failover automático caso um domínio esteja em propagação de DNS/SSL.
 */
export async function fetchDashboardApi(path, options = {}) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const candidates = getDashboardApiCandidates();

  // Se já descobrimos um domínio funcional nesta sessão, coloca-o em primeiro lugar
  const orderedBases = resolvedApiBase
    ? [resolvedApiBase, ...candidates.filter((c) => c !== resolvedApiBase)]
    : candidates;

  let lastError = null;

  for (const base of orderedBases) {
    try {
      const response = await fetch(`${base}${cleanPath}`, options);
      resolvedApiBase = base;
      return response;
    } catch (networkErr) {
      lastError = networkErr;
      // Continua para o próximo domínio candidato (ex: failover de dashboard.vendario.net para dashboard-vendario.web.app)
    }
  }

  throw lastError || new Error("Não foi possível conectar ao servidor do Vendário.");
}

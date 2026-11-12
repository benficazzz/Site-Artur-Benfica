/* =========================================================
   CONFIGURAÇÃO DO FIREBASE (valores públicos, não são senha)
   Console do Firebase > Configurações do projeto > Seus apps > App da Web
   A loja só sai do MODO DEMONSTRAÇÃO quando LOJA_ATIVA = true
   (depois que o servidor e o Mercado Pago estiverem publicados).
   ========================================================= */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBFb0wFFU4q2YNRlW2aEHpVJ4_lnyKLwIU",
  authDomain: "estudio-benfica.firebaseapp.com",
  projectId: "estudio-benfica",
  storageBucket: "estudio-benfica.firebasestorage.app",
  messagingSenderId: "586450045742",
  appId: "1:586450045742:web:012c6a94f8e83c28ec08bf",
};

// Endereço do servidor de pagamento (Cloudflare Worker). Preencha depois de publicar o Worker.
window.LOJA_API = "";

// Conta de serviço usada pelo servidor para ler o banco e entregar os originais do Drive
window.LOJA_SERVIDOR_EMAIL = "loja-servidor@estudio-benfica.iam.gserviceaccount.com";

// Troque para true quando o pagamento estiver pronto
window.LOJA_ATIVA = false; // true + LOJA_API preenchido = pagamento online ligado

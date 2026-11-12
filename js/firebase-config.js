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

// Endereço das funções do servidor (região São Paulo)
window.LOJA_API = "https://southamerica-east1-estudio-benfica.cloudfunctions.net";

// Troque para true quando o pagamento estiver pronto
window.LOJA_ATIVA = false;

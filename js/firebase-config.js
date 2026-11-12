/* =========================================================
   CONFIGURAÇÃO DO FIREBASE (valores públicos, não são senha)
   Console do Firebase > Configurações do projeto > Seus apps > App da Web
   Enquanto apiKey estiver vazia, a loja roda em MODO DEMONSTRAÇÃO.
   ========================================================= */
window.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "estudio-benfica.firebaseapp.com",
  projectId: "estudio-benfica",
  storageBucket: "estudio-benfica.firebasestorage.app",
  appId: "",
};

// Endereço das funções do servidor (região São Paulo)
window.LOJA_API = "https://southamerica-east1-estudio-benfica.cloudfunctions.net";

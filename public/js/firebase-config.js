// Importando as funções necessárias do SDK do Firebase v9+
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configurações do seu projeto (Substitua pelos dados do seu Console Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyBykpNLImAeud_nhDW6olHBTs2LGQv0EGs",
  authDomain: "meu-dinheiro-5087b.firebaseapp.com",
  projectId: "meu-dinheiro-5087b",
  storageBucket: "meu-dinheiro-5087b.firebasestorage.app",
  messagingSenderId: "771291420193",
  appId: "1:771291420193:web:062c819b6c719d38503560"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa os serviços e exporta para uso nos outros arquivos
export const auth = getAuth(app);
export const db = getFirestore(app);
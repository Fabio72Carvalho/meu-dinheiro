import { auth } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Função para Cadastrar Novo Usuário
export const cadastrarUsuario = async (email, senha) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        return userCredential.user;
    } catch (error) {
        console.error("Erro ao cadastrar:", error.code);
        throw error;
    }
};

// Função para Login
export const fazerLogin = async (email, senha) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, senha);
        return userCredential.user;
    } catch (error) {
        console.error("Erro ao logar:", error.code);
        throw error;
    }
};

// Função para Logout
export const fazerLogout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
};

// Monitorar o estado do usuário (Logado ou não)
export const observarAutenticacao = (callback) => {
    onAuthStateChanged(auth, callback);
};
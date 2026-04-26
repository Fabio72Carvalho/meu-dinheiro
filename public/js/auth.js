import { auth } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    getAuth
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Função para Cadastrar Novo Usuário
export const cadastrarUsuario = async (nome, email, senha) => {
    const auth = getAuth();
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        // Atualiza o perfil com o nome digitado
        await updateProfile(userCredential.user, {
            displayName: nome, photoURL: ""
        });
        return userCredential.user;
    } catch (error) {
        if (error instanceof Error) {
            console.error("Erro ao cadastrar: " + error.message);
        } else {
            console.error("Erro ao cadastrar: " + String(error));
        }
        throw error;
    }
};

// Função para Login
export const fazerLogin = async (email, senha) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, senha);
        return userCredential.user;
    } catch (error) {
        if (error instanceof Error) {
            console.error("Erro ao logar: " + error.message);
        } else {
            console.error("Erro ao logar: " + String(error));
        }
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

/**
 * Atualiza o nome de exibição do usuário logado
 * @param {string} novoNome 
 */
export const atualizarNomeUsuario = async (novoNome) => {
    const auth = getAuth();
    if (auth.currentUser) {
        try {
            await updateProfile(auth.currentUser, {
                displayName: novoNome, photoURL: ""
            });
            return true;
        } catch (error) {
            console.error("Erro ao atualizar nome:", error);
            throw error;
        }
    }
};
// Importando a instância do banco de dados do seu arquivo de configuração
import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Salva uma nova conta no Firestore vinculada ao usuário logado
 * @param {string} userId - ID do usuário autenticado
 * @param {Object} dadosConta - Objeto contendo nome e saldoAtual
 */
export const salvarConta = async (userId, dadosConta) => {
    try {
        const docRef = await addDoc(collection(db, "contas"), {
            nome: dadosConta.nome,
            saldoAtual: Number(dadosConta.saldoAtual),
            userId: userId, // Princípio de Segurança: Vincular sempre ao usuário
            createdAt: serverTimestamp() // Boa prática: saber quando foi criado
        });
        console.log("Conta criada com ID: ", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Erro ao adicionar conta: ", e);
        throw e;
    }
};
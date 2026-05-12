// Importando a instância do banco de dados do seu arquivo de configuração
import { db } from './firebase-config.js';
import { 
    collection,
    query,
    where,
    onSnapshot,
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

// Função para escutar as contas do usuário logado em tempo real
export const escutarContas = (userId, callback) => {
    // Filtro de segurança: busca apenas documentos onde o userId é igual ao do usuário atual
    const q = query(collection(db, "contas"), where("userId", "==", userId));

    // O onSnapshot mantém uma conexão aberta. 
    // Ele retorna uma função de "unsubscribe" para fecharmos a conexão quando necessário.
    return onSnapshot(q, (querySnapshot) => {
        const contas = [];
        querySnapshot.forEach((doc) => {
            contas.push({ id: doc.id, ...doc.data() });
        });
        callback(contas);
    }, (error) => {
        console.error("Erro ao buscar contas: ", error);
    });
};


/**
 * Salva uma nova categoria no Firestore
 */
export const salvarCategoria = async (userId, nome) => {
    try {
        const docRef = await addDoc(collection(db, "categorias"), {
            nome: nome,
            userId: userId,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (e) {
        console.error("Erro ao adicionar categoria: ", e);
        throw e;
    }
};

/**
 * Escuta as categorias do usuário em tempo real
 */
export const escutarCategorias = (userId, callback) => {
    const q = query(collection(db, "categorias"), where("userId", "==", userId));
    return onSnapshot(q, (querySnapshot) => {
        const categorias = [];
        querySnapshot.forEach((doc) => {
            categorias.push({ id: doc.id, ...doc.data() });
        });
        callback(categorias);
    });
};
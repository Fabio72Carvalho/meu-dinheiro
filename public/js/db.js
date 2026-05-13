// Importando a instância do banco de dados do seu arquivo de configuração
import { db } from './firebase-config.js';
import { 
    collection,
    query,
    where,
    onSnapshot,
    addDoc, 
    doc,
    runTransaction,
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

/**
 * Salva uma nova transação e atualiza o saldo da conta de forma atômica usando runTransaction
 * @param {Object} dados - Objeto contendo os dados da transação (contaId, tipo, valor, categoriaId, descricao)
 * @param {string} userId - ID do usuário autenticado
 * @returns {Promise<void>} - Retorna uma promessa que resolve quando a transação é concluída
 */
// js/db.js

export async function salvarTransacao(dados, userId) {
    const transacaoRef = doc(collection(db, "transacoes"));
    const contaOrigemRef = doc(db, "contas", dados.contaId);

    // ❌ NÃO coloque a contaDestinoRef aqui fora, 
    // pois se dados.contaDestinoId for undefined, o app quebra.

    try {
        await runTransaction(db, async (transaction) => {
            const snapOrigem = await transaction.get(contaOrigemRef);
            if (!snapOrigem.exists()) throw "Conta de origem não encontrada!";

            const saldoOrigem = snapOrigem.data().saldoAtual || 0;

            if (dados.tipo === 'transferencia') {
                // ✅ AGORA SIM: Criamos a referência apenas quando necessário
                if (!dados.contaDestinoId) throw "Selecione uma conta de destino!";
                
                const contaDestinoRef = doc(db, "contas", dados.contaDestinoId);
                const snapDestino = await transaction.get(contaDestinoRef);
                
                if (!snapDestino.exists()) throw "Conta de destino não encontrada!";

                const saldoDestino = snapDestino.data().saldoAtual || 0;

                // Atualiza ambos os saldos
                transaction.update(contaOrigemRef, { saldoAtual: saldoOrigem - dados.valor });
                transaction.update(contaDestinoRef, { saldoAtual: saldoDestino + dados.valor });

            } else {
                // Lógica normal para Receita ou Despesa
                const novoSaldo = dados.tipo === 'receita' 
                    ? saldoOrigem + dados.valor 
                    : saldoOrigem - dados.valor;
                
                transaction.update(contaOrigemRef, { saldoAtual: novoSaldo });
            }

            // Salva o registro da transação
            transaction.set(transacaoRef, {
                ...dados,
                userId: userId,
                dataCriacao: serverTimestamp()
            });
        });
    } catch (e) {
        console.error("Erro na transação:", e);
        throw e;
    }
}
// Importando a instância do banco de dados do seu arquivo de configuração
import { db } from './firebase-config.js';
import {
    collection,
    query,
    orderBy,
    where,
    onSnapshot,
    addDoc,
    doc,
    runTransaction,
    serverTimestamp,
    Timestamp
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
    try {
        const transacaoRef = doc(collection(db, "transacoes"));
        const contaOrigemRef = doc(db, "contas", dados.contaId);
        await runTransaction(db, async (transaction) => {

            const snapOrigem = await transaction.get(contaOrigemRef);
            if (!snapOrigem.exists()) throw "Conta de origem não encontrada!";
            const saldoOrigem = snapOrigem.data().saldoAtual || 0;

            if (dados.tipo === 'transferencia') {
                const contaDestinoRef = doc(db, "contas", dados.contaDestinoId);
                const snapDestino = await transaction.get(contaDestinoRef);
                if (!snapDestino.exists()) throw "Conta de destino não encontrada!";

                const saldoDestino = snapDestino.data().saldoAtual || 0;
                const contaDestinoNome = snapDestino.data().nome; // Pegamos o nome atualizado do banco
                // 1. Registro de SAÍDA (Conta Origem)
                const transacaoSaidaRef = doc(collection(db, "transacoes"));
                transaction.set(transacaoSaidaRef, {
                    ...dados,
                    data: Timestamp.fromDate(dados.data),
                    descricao: `Transf. para ${contaDestinoNome}: ${dados.descricao}`,
                    tipo: 'despesa', // Tratamos como saída para a conta origem
                    contaNome: dados.contaNome, // Nome capturado no select do app.js
                    userId: userId,
                    dataCriacao: serverTimestamp()
                });
                // 2. Registro de ENTRADA (Conta Destino)
                const transacaoEntradaRef = doc(collection(db, "transacoes"));
                transaction.set(transacaoEntradaRef, {
                    ...dados,
                    data: Timestamp.fromDate(dados.data),
                    descricao: `Transf. de ${dados.contaNome}: ${dados.descricao}`,
                    tipo: 'receita', // Tratamos como entrada para a conta destino
                    contaId: dados.contaDestinoId, // Invertemos o ID para a conta destino
                    contaNome: contaDestinoNome,   // Nome da conta destino
                    userId: userId,
                    dataCriacao: serverTimestamp()
                });
                // 3. Atualiza os saldos das duas contas
                transaction.update(contaOrigemRef, { saldoAtual: saldoOrigem - dados.valor });
                transaction.update(contaDestinoRef, { saldoAtual: saldoDestino + dados.valor });
            } else {
                // Lógica normal para Receita ou Despesa
                const novoSaldo = dados.tipo === 'receita'
                    ? saldoOrigem + dados.valor
                    : saldoOrigem - dados.valor;

                transaction.update(contaOrigemRef, { saldoAtual: novoSaldo });
                // Salva o registro da transação
                transaction.set(transacaoRef, {
                    ...dados,
                    data: Timestamp.fromDate(dados.data),
                    userId: userId,
                    dataCriacao: serverTimestamp()
                });
            }
        });
    } catch (e) {
        console.error("Erro na transação:", e);
        throw e;
    }
}

// escutarTransacoes.js
// REVIEW ver se ainda será necessária essa função:
export function escutarTransacoes(userId, callback) {
    const q = query(
        collection(db, "transacoes"),
        where("userId", "==", userId),
        orderBy("data", "asc") // Ordena por data, do mais antigo para o mais recente
    );

    return onSnapshot(q, (snapshot) => {
        const transacoes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(transacoes);
    });
}

// js/db.js

export function escutarTransacoesPorMes(userId, mes, ano, callback) {
    // 1. Calcular o primeiro e o último segundo do mês selecionado
    const dataInicio = new Date(ano, mes, 1, 0, 0, 0); // Meses em JavaScript são 0-indexados
    const dataFim = new Date(ano, mes + 1, 0, 23, 59, 59); // O dia 0 do próximo mês é o último dia do mês atual

    const q = query(
        collection(db, "transacoes"),
        where("userId", "==", userId),
        where("data", ">=", Timestamp.fromDate(dataInicio)),
        where("data", "<=", Timestamp.fromDate(dataFim)),
        orderBy("data") // Ordena por data, do mais antigo para o mais recente
    );

    return onSnapshot(q, (snapshot) => {
        const transacoes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(transacoes);
    });
}
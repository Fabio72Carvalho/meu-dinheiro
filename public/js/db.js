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
    setDoc,
    getDocs,
    writeBatch,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Salva uma nova conta e inicializa seu histórico na coleção de saldos anuais
 */
export const salvarConta = async (userId, dadosConta) => {
    try {
        const saldoInicial = Number(dadosConta.saldoInicial || dadosConta.saldoAtual || 0);

        // 1. Salva a conta com o saldo baseline fixo
        const docRef = await addDoc(collection(db, "contas"), {
            nome: dadosConta.nome,
            saldoInicial: saldoInicial,
            userId: userId,
            createdAt: serverTimestamp()
        });

        // 2. Cria o primeiro documento de consolidação na coleção de saldos anuais
        const anoAtual = new Date().getFullYear();
        const mesesMarcadores = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

        const dadosSaldos = {
            userId: userId,
            contaId: docRef.id,
            ano: anoAtual,
            saldoAtualHoje: saldoInicial // Este campo alimentará a barra lateral cronologicamente
        };

        // Todos os meses do ano inicial herdam o saldo que a conta começou
        mesesMarcadores.forEach(m => dadosSaldos[m] = saldoInicial);

        await setDoc(doc(db, "saldos_anuais", `${docRef.id}_${anoAtual}`), dadosSaldos);

        return docRef.id;
    } catch (e) {
        console.error("Erro ao adicionar conta: ", e);
        throw e;
    }
};

/**
 * Escuta todos os registros de saldos consolidados do usuário em tempo real
 */
export function escutarSaldosAnuais(userId, callback) {
    const q = query(collection(db, "saldos_anuais"), where("userId", "==", userId));
    return onSnapshot(q, (snapshot) => {
        const saldos = snapshot.docs.map(doc => doc.data());
        callback(saldos);
    });
}

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
 * Salva a transação e dispara o efeito cascata controlado nos saldos mensais/anuais
 */
export async function salvarTransacao(userId, transacao) {
    try {
        const transacaoData = {
            userId: userId,
            contaId: transacao.contaId,
            contaNome: transacao.contaNome,
            categoriaId: transacao.categoriaId,
            categoriaNome: transacao.categoriaNome,
            data: transacao.data,
            valor: Number(transacao.valor),
            tipo: transacao.tipo,
            descricao: transacao.descricao,
            nota: transacao.nota || "",
            recorrente: transacao.recorrente || false,
            parcelaAtual: transacao.parcelaAtual || 1,
            totalParcelas: transacao.totalParcelas || 1,
            idGrupoParcela: transacao.idGrupoParcela || ""
        };

        console.log("userId:", transacaoData.userId);

        // Grava a transação
        const docTransacaoRef = await addDoc(collection(db, "transacoes"), transacaoData);

        // Propaga o impacto matemático para o mês correspondente e meses/anos futuros
        const dataJS = transacao.data.toDate ? transacao.data.toDate() : new Date(transacao.data);
        await propagarImpactoSaldosAnuais(userId, transacao.contaId, dataJS, transacao.valor, transacao.tipo);

        return docTransacaoRef.id;
    } catch (e) {
        console.error("Erro ao salvar transação:", e);
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

/**
 * Função interna que varre os anos consolidados da conta e aplica o impacto em cascata (NoSQL Batch)
 */
async function propagarImpactoSaldosAnuais(userId, contaId, dataJS, valor, tipo) {
    const anoTransacao = dataJS.getFullYear();
    const mesTransacaoIndex = dataJS.getMonth(); // 0 a 11
    const agora = new Date();
    const mesesMarcadores = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

    const impacto = tipo === 'receita' ? Number(valor) : -Number(valor);

    // Busca apenas as consolidações daquela conta específica
    const q = query(
        collection(db, "saldos_anuais"),
        where("userId", "==", userId),
        where("contaId", "==", contaId)
    );
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    let anoTransacaoExistia = false;

    snapshot.forEach((docSnap) => {
        const dados = docSnap.data();
        const anoDoc = Number(dados.ano);
        let alterou = false;

        if (anoDoc === anoTransacao) {
            anoTransacaoExistia = true;
            // Atualiza o fechamento do mês afetado até dezembro do mesmo ano
            for (let i = mesTransacaoIndex; i < 12; i++) {
                dados[mesesMarcadores[i]] = (dados[mesesMarcadores[i]] || 0) + impacto;
            }
            // Se o lançamento for retroativo ou de hoje, ele altera o saldo real de hoje
            if (dataJS <= agora) {
                dados.saldoAtualHoje = (dados.saldoAtualHoje || 0) + impacto;
            }
            alterou = true;
        } else if (anoDoc > anoTransacao) {
            // Se mexemos num ano passado, o impacto flui alterando todos os meses dos anos posteriores
            for (let i = 0; i < 12; i++) {
                dados[mesesMarcadores[i]] = (dados[mesesMarcadores[i]] || 0) + impacto;
            }
            dados.saldoAtualHoje = (dados.saldoAtualHoje || 0) + impacto;
            alterou = true;
        }

        if (alterou) {
            batch.set(doc(db, "saldos_anuais", docSnap.id), {
                ...dados,
                userId: userId // 🚨 Blindando o userId para a regra de atualização
            }, { merge: true });
        }
    });

    // Se o usuário inseriu uma transação de um ano que ainda não tinha registros de fechamento, cria o documento
    if (!anoTransacaoExistia) {
        const dadosNovos = {
            userId,
            contaId,
            ano: anoTransacao,
            saldoAtualHoje: dataJS <= agora ? impacto : 0
        };

        let maiorAnoAnterior = -1;
        let saldoBase = 0;
        snapshot.forEach(d => {
            const a = Number(d.data().ano);
            if (a < anoTransacao && a > maiorAnoAnterior) {
                maiorAnoAnterior = a;
                saldoBase = d.data()['dez'] || 0;
            }
        });

        mesesMarcadores.forEach((m, idx) => {
            if (idx >= mesTransacaoIndex) {
                dadosNovos[m] = saldoBase + impacto;
            } else {
                dadosNovos[m] = saldoBase;
            }
        });

        dadosNovos.saldoAtualHoje += saldoBase;
        batch.set(doc(db, "saldos_anuais", `${contaId}_${anoTransacao}`), {
            ...dadosNovos,
            userId: userId // Força a presença do userId exigido pela regra de 'create'
        });
    }

    await batch.commit();
}
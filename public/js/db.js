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
    getDoc,
    getDocs,
    writeBatch,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const mesesNomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * Motor de Cálculo de Fluxo de Caixa (Resolve Cenários 1, 2, 3 e 4)
 * Pode receber um batch externo (para transações atômicas) ou rodar sozinho.
 */
export async function propagarImpactoSaldosAnuais(userId, contaId, dataJS, deltaValor, batchExterno = null) {
    const anoTransacao = dataJS.getFullYear();
    const mesTransacao = dataJS.getMonth(); // 0 a 11
    
    // Data atual do mundo real para garantir que o saldoAtual seja sincronizado
    const dataAtual = new Date();
    const anoAtual = dataAtual.getFullYear();
    const mesAtual = dataAtual.getMonth();

    // 1. Buscar a conta para obter o saldoInicial absoluto (A âncora do passado)
    const contaRef = doc(db, 'contas', contaId);
    const contaSnap = await getDoc(contaRef);
    if (!contaSnap.exists()) throw new Error("Conta não encontrada");
    const saldoInicial = Number(contaSnap.data().saldoInicial || 0);

    // 2. Buscar TODOS os saldos_anuais da conta
    const saldosRef = collection(db, 'saldos_anuais');
    const q = query(saldosRef, where("userId", "==", userId), where("contaId", "==", contaId));
    const snapshot = await getDocs(q);
    
    const mapAnos = {};
    let minAnoExistente = anoAtual;
    let maxAnoExistente = anoAtual;

    snapshot.forEach(docSnap => {
        const dados = docSnap.data();
        const ano = Number(dados.ano);
        mapAnos[ano] = { id: docSnap.id, data: dados };
        if (ano < minAnoExistente) minAnoExistente = ano;
        if (ano > maxAnoExistente) maxAnoExistente = ano;
    });

    if (snapshot.empty) {
        minAnoExistente = Math.min(anoTransacao, anoAtual);
        maxAnoExistente = Math.max(anoTransacao, anoAtual);
    }

    // 3. Define a "Janela de Propagação" (Não deixa buracos)
    // Começa do ano da transação OU do ano mais antigo que existe, o que vier primeiro.
    const startAno = Math.min(anoTransacao, minAnoExistente, anoAtual);
    const endAno = Math.max(anoTransacao, maxAnoExistente, anoAtual);

    let ultimoSaldoConhecido = saldoInicial;
    const batch = batchExterno || writeBatch(db);

    // 4. Caminhar pelo tempo construindo/atualizando a história
    for (let ano = startAno; ano <= endAno; ano++) {
        if (mapAnos[ano]) {
            // Cenario de ANO EXISTENTE: Apenas adicionamos o impacto financeiro (delta)
            const anoData = mapAnos[ano].data;
            for (let mes = 0; mes <= 11; mes++) {
                // Só aplica o delta da transação em diante
                if ((ano === anoTransacao && mes >= mesTransacao) || ano > anoTransacao) {
                    anoData[mesesNomes[mes]] = Number(anoData[mesesNomes[mes]]) + deltaValor;
                }
                ultimoSaldoConhecido = Number(anoData[mesesNomes[mes]]); // Guarda para o próximo ano
            }
            const docRef = doc(db, 'saldos_anuais', mapAnos[ano].id);
            batch.update(docRef, anoData);
            
        } else {
            // Cenário de ANO FALTANTE (Cria anos passados ou futuros conforme Cenários 2 e 4)
            const novoAnoData = { ano, userId, contaId };
            
            for (let mes = 0; mes <= 11; mes++) {
                // Chegou no exato mês da transação? O saldo incorpora o impacto.
                if (ano === anoTransacao && mes === mesTransacao) {
                    ultimoSaldoConhecido += deltaValor;
                }
                novoAnoData[mesesNomes[mes]] = ultimoSaldoConhecido;
            }
            
            const docRef = doc(db, 'saldos_anuais', `${contaId}_${ano}`);
            batch.set(docRef, novoAnoData);
            mapAnos[ano] = { id: docRef.id, data: novoAnoData };
        }
    }

    // 5. O Grande Truque: Sincronizar o "saldoAtual" da Coleção Contas
    // O seu app.js deve exibir o saldoAtual da vida real. Lemos o valor recalculado do mês atual.
    let novoSaldoAtual = saldoInicial;
    if (mapAnos[anoAtual]) {
        novoSaldoAtual = mapAnos[anoAtual].data[mesesNomes[mesAtual]];
    }
    batch.update(contaRef, { saldoAtual: novoSaldoAtual });

    // 6. Comita se for dono do batch
    if (!batchExterno) {
        await batch.commit();
    }
}

/**
 * Salva uma nova conta e inicializa seu histórico na coleção de saldos anuais
 */
export const salvarConta = async (userId, dadosConta) => {
    // Garante que o valor venha como número
    const saldo = Number(dadosConta.saldoInicial || 0);
    
    // Inicia um lote de gravações (tudo ou nada)
    const batch = writeBatch(db);
    const contaRef = doc(collection(db, "contas")); // Gera um ID automático
    
    // 1. Prepara e salva a conta
    const contaCompleta = {
        ...dadosConta,
        userId,
        saldoAtual: saldo
    };
    batch.set(contaRef, contaCompleta);
    
    // 2. Cria imediatamente o saldo_anual do ANO ATUAL
    const anoAtual = new Date().getFullYear();
    const docSaldoRef = doc(db, 'saldos_anuais', `${contaRef.id}_${anoAtual}`);
    const saldoAno = { ano: anoAtual, userId, contaId: contaRef.id };
    
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    meses.forEach(mes => saldoAno[mes] = saldo); // Todos os meses nascem com o saldo inicial
    
    batch.set(docSaldoRef, saldoAno);
    
    // Dispara a gravação simultânea
    await batch.commit();
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
export const salvarTransacao = async (userId, dadosTransacao) => {
    // 1. Inicia o "caminhão" de entregas (Batch). Tudo o que for gravado aqui, só vai pro banco no commit final.
    const batch = writeBatch(db);

    // ==========================================
    // CENÁRIO A: É UMA TRANSFERÊNCIA
    // ==========================================
    if (dadosTransacao.tipo === 'transferencia') {
        
        const valorNumber = Number(dadosTransacao.valor);
        const dataJS = new Date(dadosTransacao.data); // Garanta que seja um objeto Date do JS
        
        // --- A.1) Saída da Conta de Origem ---
        const transacaoSaidaRef = doc(collection(db, "transacoes"));
        const dadosSaida = {
            ...dadosTransacao,
            userId,
            tipo: 'despesa', // Transforma em saída
            // (aqui você mantém como já fazia: ajustando descrição/categoria se precisar)
        };
        batch.set(transacaoSaidaRef, dadosSaida);
        
        // Propaga o impacto negativo (-) na conta de Origem
        await propagarImpactoSaldosAnuais(userId, dadosTransacao.contaId, dataJS, -valorNumber, batch);


        // --- A.2) Entrada na Conta de Destino ---
        const transacaoEntradaRef = doc(collection(db, "transacoes"));
        const dadosEntrada = {
            ...dadosTransacao,
            userId,
            tipo: 'receita', // Transforma em entrada
            contaId: dadosTransacao.contaDestinoId // Salva na conta destino
        };
        batch.set(transacaoEntradaRef, dadosEntrada);

        // Propaga o impacto positivo (+) na conta de Destino
        await propagarImpactoSaldosAnuais(userId, dadosTransacao.contaDestinoId, dataJS, valorNumber, batch);

    } 
    // ==========================================
    // CENÁRIO B: RECEITA OU DESPESA NORMAL
    // ==========================================
    else {
        
        // 1. Prepara a gravação da transação
        const transacaoRef = doc(collection(db, "transacoes"));
        batch.set(transacaoRef, { ...dadosTransacao, userId });
        
        // 2. Calcula o Delta (impacto financeiro)
        const valor = Number(dadosTransacao.valor);
        const deltaValor = dadosTransacao.tipo === 'receita' ? valor : -valor;
        const dataJS = new Date(dadosTransacao.data); 
        
        // 3. Aciona o Algoritmo Mestre passando o batch
        await propagarImpactoSaldosAnuais(
            userId, 
            dadosTransacao.contaId, 
            dataJS, 
            deltaValor, 
            batch 
        );
    }

    // ==========================================
    // O GRANDE FINAL (COMMIT ATÔMICO)
    // ==========================================
    // Salva a transação, atualiza todos os meses passados/futuros e o saldo atual da conta DE UMA SÓ VEZ!
    await batch.commit();
};

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

// REVIEW
/**
 * Função interna que varre os anos consolidados da conta e aplica o impacto em cascata (NoSQL Batch)
 */
// async function propagarImpactoSaldosAnuais(userId, contaId, dataJS, valor, tipo) {
//     const anoTransacao = dataJS.getFullYear();
//     const mesTransacaoIndex = dataJS.getMonth(); // 0 a 11
//     const agora = new Date();
//     const mesesMarcadores = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

//     const impacto = tipo === 'receita' ? Number(valor) : -Number(valor);

//     // Busca apenas as consolidações daquela conta específica
//     const q = query(
//         collection(db, "saldos_anuais"),
//         where("userId", "==", userId),
//         where("contaId", "==", contaId)
//     );
//     const snapshot = await getDocs(q);

//     const batch = writeBatch(db);
//     let anoTransacaoExistia = false;

//     snapshot.forEach((docSnap) => {
//         const dados = docSnap.data();
//         const anoDoc = Number(dados.ano);
//         let alterou = false;

//         if (anoDoc === anoTransacao) {
//             anoTransacaoExistia = true;
//             // Atualiza o fechamento do mês afetado até dezembro do mesmo ano
//             for (let i = mesTransacaoIndex; i < 12; i++) {
//                 dados[mesesMarcadores[i]] = (dados[mesesMarcadores[i]] || 0) + impacto;
//             }
//             // Se o lançamento for retroativo ou de hoje, ele altera o saldo real de hoje
//             if (dataJS <= agora) {
//                 dados.saldoAtualHoje = (dados.saldoAtualHoje || 0) + impacto;
//             }
//             alterou = true;
//         } else if (anoDoc > anoTransacao) {
//             // Se mexemos num ano passado, o impacto flui alterando todos os meses dos anos posteriores
//             for (let i = 0; i < 12; i++) {
//                 dados[mesesMarcadores[i]] = (dados[mesesMarcadores[i]] || 0) + impacto;
//             }
//             dados.saldoAtualHoje = (dados.saldoAtualHoje || 0) + impacto;
//             alterou = true;
//         }

//         if (alterou) {
//             batch.set(doc(db, "saldos_anuais", docSnap.id), {
//                 ...dados,
//                 userId: userId // 🚨 Blindando o userId para a regra de atualização
//             }, { merge: true });
//         }
//     });

//     // Se o usuário inseriu uma transação de um ano que ainda não tinha registros de fechamento, cria o documento
//     if (!anoTransacaoExistia) {
//         const dadosNovos = {
//             userId,
//             contaId,
//             ano: anoTransacao,
//             saldoAtualHoje: dataJS <= agora ? impacto : 0
//         };

//         let maiorAnoAnterior = -1;
//         let saldoBase = 0;
//         snapshot.forEach(d => {
//             const a = Number(d.data().ano);
//             if (a < anoTransacao && a > maiorAnoAnterior) {
//                 maiorAnoAnterior = a;
//                 saldoBase = d.data()['dez'] || 0;
//             }
//         });

//         mesesMarcadores.forEach((m, idx) => {
//             if (idx >= mesTransacaoIndex) {
//                 dadosNovos[m] = saldoBase + impacto;
//             } else {
//                 dadosNovos[m] = saldoBase;
//             }
//         });

//         dadosNovos.saldoAtualHoje += saldoBase;
//         batch.set(doc(db, "saldos_anuais", `${contaId}_${anoTransacao}`), {
//             ...dadosNovos,
//             userId: userId // Força a presença do userId exigido pela regra de 'create'
//         });
//     }

//     await batch.commit();
// }
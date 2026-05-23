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
    Timestamp,
    deleteDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// REVIEW
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
                    let saldoSomado = Number(anoData[mesesNomes[mes]]) + deltaValor;
                    anoData[mesesNomes[mes]] = Math.round(saldoSomado * 100) / 100; // Arredonda para evitar imprecisão de float;
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
                    ultimoSaldoConhecido = Math.round(ultimoSaldoConhecido * 100) / 100;
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
        
        // Gera um ID único para amarrar as duas transações
        const idGrupoTransferencia = `transf_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        // --- A.1) Saída da Conta de Origem ---
        const transacaoSaidaRef = doc(collection(db, "transacoes"));
        const dadosSaida = {
            ...dadosTransacao,
            userId,
            tipo: 'despesa',
            idGrupoTransferencia // -> Salva o elo de ligação
        };
        batch.set(transacaoSaidaRef, dadosSaida);
        await propagarImpactoSaldosAnuais(userId, dadosTransacao.contaId, dataJS, -valorNumber, batch);
        
        // --- A.2) Entrada na Conta de Destino ---
        const transacaoEntradaRef = doc(collection(db, "transacoes"));
        const dadosEntrada = {
            ...dadosTransacao,
            userId,
            tipo: 'receita', // Transforma em entrada
            contaId: dadosTransacao.contaDestinoId, // Salva na conta destino
            idGrupoTransferencia // -> Salva o elo de ligação
        };
        batch.set(transacaoEntradaRef, dadosEntrada);
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

/**
 * Exclui uma transação (e sua irmã, caso seja transferência) e estorna os saldos.
 */
export const excluirTransacao = async (userId, transacao) => {
    try {
        const batch = writeBatch(db);

        // Verifica se é uma transação atrelada a uma transferência
        if (transacao.idGrupoTransferencia) {
            
            // 1. Busca todas as transações com este ID de Grupo (a Saída e a Entrada)
            const q = query(
                collection(db, "transacoes"), 
                where("userId", "==", userId),
                where("idGrupoTransferencia", "==", transacao.idGrupoTransferencia)
            );
            const snapshot = await getDocs(q);

            // 2. Itera sobre as irmãs revertendo o impacto de cada uma
            for (const docSnap of snapshot.docs) {
                const tIrma = docSnap.data();
                const dataIrmaJS = tIrma.data.toDate(); // Converte Timestamp para Date
                
                // Lógica de estorno: Se era receita(+), vira negativo(-). Se era despesa(-), vira positivo(+).
                const deltaEstorno = tIrma.tipo === 'receita' ? -Number(tIrma.valor) : Number(tIrma.valor);
                
                // Aplica o estorno nos saldos
                await propagarImpactoSaldosAnuais(userId, tIrma.contaId, dataIrmaJS, deltaEstorno, batch);
                
                // Marca o documento para ser deletado
                batch.delete(docSnap.ref);
            }

        } else {
            // É uma transação normal (Receita ou Despesa Simples)
            const dataJS = transacao.data.toDate();
            const deltaEstorno = transacao.tipo === 'receita' ? -Number(transacao.valor) : Number(transacao.valor);
            
            await propagarImpactoSaldosAnuais(userId, transacao.contaId, dataJS, deltaEstorno, batch);
            
            const docRef = doc(db, "transacoes", transacao.id);
            batch.delete(docRef);
        }

        // Commita tudo de uma vez (Apaga os documentos e corrige os saldos anuais)
        await batch.commit();
        console.log("Exclusão e estorno realizados com sucesso!");

    } catch (e) {
        console.error("Erro ao excluir transação: ", e);
        throw e;
    }
};

/**
 * Edita uma transação revertendo a antiga e salvando a nova.
 */
export const editarTransacao = async (userId, transacaoAntiga, dadosNovos) => {
    try {
        // ATENÇÃO: Aqui não usamos o batch interno, executamos sequencialmente.
        // Por que? Porque o estorno vai modificar os "saldos_anuais" no banco. 
        // O salvarTransacao precisa ler o banco ATUALIZADO para aplicar o novo valor por cima.
        
        // 1. Exclui a antiga (e a irmã dela, se houver) e estorna todos os saldos
        await excluirTransacao(userId, transacaoAntiga);

        // 2. Salva a nova transação como se fosse inédita (aplicando os novos impactos)
        await salvarTransacao(userId, dadosNovos);

        console.log("Transação editada com sucesso!");
    } catch (e) {
        console.error("Erro ao editar transação: ", e);
        throw e;
    }
};
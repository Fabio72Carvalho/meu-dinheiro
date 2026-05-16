/**
 * Procura um elemento no DOM e garante que ele existe.
 * @param {string} id - O ID do elemento.
 * @returns {HTMLElement}
 */
export const getRequiredElement = (id) => {
    const el = document.getElementById(id);
    if (!el) {
        throw new Error(`Erro: Elemento com ID #${id} não encontrado!`);
    }
    return el;
};

/**
 * Alterna a visibilidade entre a tela de login e a tela principal do App
 * @param {boolean} usuarioLogado 
 */
export const alternarTelas = (usuarioLogado) => {
    const viewLogin = document.getElementById('view-login');
    const viewMain = document.getElementById('view-main');

    if (usuarioLogado) {
        // Usuário entrou: esconde login, mostra app
        if (viewLogin) viewLogin.style.display = 'none';
        if (viewMain) viewMain.style.display = 'flex'; // Usamos flex para manter o layout do CSS
    } else {
        // Usuário saiu: mostra login, esconde app
        if (viewLogin) viewLogin.style.display = 'block';
        if (viewMain) viewMain.style.display = 'none';
    }
};

// Função para renderizar as contas na interface
export const renderizarContas = (contas, idsSelecionados = []) => {
    const container = document.getElementById('lista-contas');
    if (!container) return;
    container.innerHTML = '';

    if (contas.length === 0) {
        container.innerHTML = '<p class="empty-msg">Nenhuma conta cadastrada.</p>';
        return;
    }

    contas.forEach(conta => {
        const div = document.createElement('div');
        div.className = 'side-bar-item';
        
        // Mudança aqui: Verifica se o ID atual está dentro do array idsSelecionados
        const IsChecked = idsSelecionados.includes(conta.id) ? 'checked' : '';

        div.innerHTML = `
            <div class="conta-info">
                <input type="checkbox" class="filtro-conta-chk" data-id="${conta.id}" ${IsChecked}>    
                <span class="conta-nome">${conta.nome}</span>
            </div>
            <span class="conta-saldo">R$ ${conta.saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        `;
        container.appendChild(div);
    });
};

/**
 * Renderiza as categorias na barra lateral
 */
export const renderizarCategorias = (categorias, idsSelecionados = []) => {
    const container = document.getElementById('lista-categorias');
    if (!container) return;
    container.innerHTML = '';

    if (categorias.length === 0) {
        container.innerHTML = '<li class="empty-text">Nenhuma categoria...</li>';
        return;
    }

    categorias.forEach(cat => {
        const li = document.createElement('li');
        li.className = 'sidebar-item';
        
        // Mudança aqui: Verifica se o ID está no array
        const IsChecked = idsSelecionados.includes(cat.id) ? 'checked' : '';

        li.innerHTML = `
        <div class="sidebar-item-main">
            <input type="checkbox" class="filtro-categoria-chk" data-id="${cat.id}" ${IsChecked}>
            <span class="item-nome">${cat.nome}</span>
        </div>
    `;
        container.appendChild(li);
    });
};

// Função para atualizar os dropdowns do formulário de transação
export function atualizarSelects(contas, categorias) {
    const selectConta = document.getElementById('select-conta');
    const selectDestino = document.getElementById('select-conta-destino');
    const selectCategoria = document.getElementById('select-categoria');

    if (!selectConta || !selectDestino || !selectCategoria) return;

    // Limpar e preencher selects de conta (Origem e Destino)
    const optionsContas = '<option value="">Selecione a Conta</option>' +
        contas.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

    selectConta.innerHTML = optionsContas;
    selectDestino.innerHTML = optionsContas.replace("Selecione a Conta", "Conta de Destino");

    // Preencher categorias
    selectCategoria.innerHTML = '<option value="">Selecione a Categoria</option>' +
        categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
}

// Função para alternar campos dependendo do tipo
// js/ui.js

export function tratarMudancaTipo(tipo) {
    const groupDestino = document.getElementById('group-conta-destino');
    const groupCategoria = document.getElementById('group-categoria'); // Agora pegamos o grupo
    const selectCategoria = document.getElementById('select-categoria');

    if (tipo === 'transferencia') {
        // Mostra destino, esconde categoria
        groupDestino.style.display = 'block';
        groupCategoria.style.display = 'none';

        // Remove a obrigatoriedade da categoria para não travar o envio
        selectCategoria.required = false;
    } else {
        // Esconde destino, mostra categoria
        groupDestino.style.display = 'none';
        groupCategoria.style.display = 'block';

        // Volta a ser obrigatório para Receita e Despesa
        selectCategoria.required = true;
    }
}

// Exibe a tela principal do App e esconde o Login
export function mostrarTelaApp(user) {
    const viewLogin = document.getElementById('view-login');
    const viewMain = document.getElementById('view-main');
    const userDisplay = document.getElementById('user-display-name');

    if (viewLogin) viewLogin.style.display = 'none';
    if (viewMain) viewMain.style.display = 'block'; // Ou 'flex', dependendo do seu layout

    // Atualiza o nome do usuário na barra superior (Diretriz de UI)
    if (userDisplay) {
        userDisplay.textContent = user.displayName || user.email;
    }
}

// Exibe a tela de Login e esconde o App (usado no Logout ou falha de auth)
export function mostrarTelaLogin() {
    const viewLogin = document.getElementById('view-login');
    const viewMain = document.getElementById('view-main');

    if (viewMain) viewMain.style.display = 'none';
    if (viewLogin) viewLogin.style.display = 'flex'; // Usamos flex porque o container de login geralmente é centralizado
}

// js/ui.js
export function renderizarTransacoes(transacoes) {
    const listaCorpo = document.getElementById('lista-transacoes');
    if (!listaCorpo) return;

    listaCorpo.innerHTML = ''; // Limpa a lista antes de renderizar

    if (transacoes.length === 0) {
        listaCorpo.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhuma transação encontrada.</td></tr>';
        return;
    }

    transacoes.forEach(t => {
        const data = t.data.toDate().toLocaleDateString('pt-BR'); // Formata a data para o formato brasileiro
        // Formatar valor e cor
        const valorFormatado = t.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const classeCor = t.tipo === 'receita' ? 'texto-receita' : (t.tipo === 'despesa' ? 'texto-despesa' : 'texto-transferencia');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${data}</td>
            <td>${t.descricao}</td>
            <td>${t.contaNome || 'Conta'}</td>
            <td class="${classeCor}">${valorFormatado}</td>
        `;
        listaCorpo.appendChild(tr);
    });
}

// js/ui.js
export function atualizarMesExibido(mes, ano) {
    const nomesMeses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const labelMes = document.getElementById('current-month-display');
    if (labelMes) {
        labelMes.textContent = `${nomesMeses[mes]} de ${ano}`;
    }
}
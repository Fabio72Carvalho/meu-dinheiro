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
export const renderizarContas = (contas) => {
    const container = document.getElementById('lista-contas'); // Verifique se este ID existe no seu index.html
    if (!container) return;

    // Limpa a lista antes de renderizar para não duplicar itens [cite: 2128]
    container.innerHTML = '';

    if (contas.length === 0) {
        container.innerHTML = '<p class="empty-msg">Nenhuma conta cadastrada.</p>';
        return;
    }

    contas.forEach(conta => {
        const div = document.createElement('div');
        div.className = 'conta-card'; // Use suas classes de CSS aqui
        div.innerHTML = `
            <div class="conta-info">
                <span class="conta-nome">${conta.nome}</span>
                <span class="conta-saldo">R$ ${conta.saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
        `;
        container.appendChild(div);
    });
};

/**
 * Renderiza as categorias na barra lateral
 */
export const renderizarCategorias = (categorias) => {
    const container = document.getElementById('lista-categorias');
    if (!container) return;

    container.innerHTML = '';

    if (categorias.length === 0) {
        container.innerHTML = '<li class="empty-text">Nenhuma categoria...</li>';
        return;
    }

    categorias.forEach(cat => {
        const li = document.createElement('li');
        li.className = 'sidebar-item'; // Classe que você já usa no CSS
        li.textContent = cat.nome;
        container.appendChild(li);
    });
};
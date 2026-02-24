/**
 * js/marketing.js - Lógica do Painel de Comunicação
 */

const Marketing = {
    async init() {
        console.log("Iniciando Módulo de Marketing...");
        this.renderKanban();
        this.setupEventListeners();
    },

    renderKanban() {
        const posts = Store.getData().marketing_posts || [];
        const columns = document.querySelectorAll('.kanban-cards-area');

        columns.forEach(col => {
            const status = col.getAttribute('data-status');
            const colPosts = posts.filter(p => p.status === status);

            // Atualizar badge de contagem no header da coluna
            const badge = col.parentElement.querySelector('.count-badge');
            if (badge) badge.innerText = colPosts.length;

            col.innerHTML = '';
            colPosts.forEach(post => {
                const client = Store.getData().clientes.find(c => c.id === post.clienteId);
                const card = document.createElement('div');
                card.className = 'glass-card kanban-card fade-in';
                card.draggable = true;
                card.setAttribute('data-id', post.id);

                card.innerHTML = `
                    <div class="kanban-card-tag" style="background: ${this.getBadgeColor(post.plataforma)};">
                        ${post.plataforma}
                    </div>
                    <h4 style="font-size: 0.9rem; margin: 0.5rem 0;">${post.titulo}</h4>
                    <p style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.3;">
                        <i class="fa-solid fa-user-tie"></i> ${client ? client.razaoSocial : 'Sem Cliente'}
                    </p>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem;">
                        <span style="font-size: 0.7rem; opacity: 0.6;"><i class="fa-regular fa-calendar"></i> ${post.dataPrevista || 'S/D'}</span>
                        <div class="kanban-card-actions">
                            <button class="action-btn-mini" onclick="Marketing.editPost(${post.id})"><i class="fa-solid fa-pen"></i></button>
                        </div>
                    </div>
                `;

                card.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', post.id);
                    card.style.opacity = '0.4';
                });

                card.addEventListener('dragend', () => {
                    card.style.opacity = '1';
                });

                col.appendChild(card);
            });

            // Drop zone logic
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                col.style.background = 'rgba(255,255,255,0.05)';
            });

            col.addEventListener('dragleave', () => {
                col.style.background = 'transparent';
            });

            col.addEventListener('drop', async (e) => {
                e.preventDefault();
                col.style.background = 'transparent';
                const postId = parseInt(e.dataTransfer.getData('text/plain'));
                const newStatus = status;
                await Store.updateMarketingPostStatus(postId, newStatus);
                this.renderKanban();
            });
        });
    },

    getBadgeColor(platform) {
        switch (platform.toLowerCase()) {
            case 'instagram': return '#E1306C';
            case 'facebook': return '#1877F2';
            case 'whatsapp': return '#25D366';
            case 'linkedin': return '#0A66C2';
            default: return 'var(--primary)';
        }
    },

    setupEventListeners() {
        const btnNew = document.getElementById('btn-new-marketing-post');
        if (btnNew) {
            btnNew.onclick = () => this.openPostModal();
        }
    },

    openPostModal(id = null) {
        // Implementar modal de criação de post futuramente ou via alert/prompt para MVP
        alert("Criar/Editar Post será implementado no próximo passo da UI.");
    },

    editPost(id) {
        this.openPostModal(id);
    }
};

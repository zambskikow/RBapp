/**
 * js/marketing.js - Lógica do Módulo de Gestão de Marketing Profissional
 */

const Marketing = {
    currentTab: 'mk-tab-dashboard',
    currentDate: new Date(),

    async init() {
        console.log("Iniciando Módulo de Marketing Profissional...");
        this.setupEventListeners();
        this.renderCurrentTab();
    },

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('[data-marketing-tab]').forEach(btn => {
            btn.onclick = (e) => {
                const target = e.currentTarget.getAttribute('data-marketing-tab');
                this.switchTab(target);
            };
        });

        // Botões de Modal
        const btnNewPost = document.getElementById('btn-new-marketing-post');
        if (btnNewPost) btnNewPost.onclick = () => this.openPostModal();

        const btnNewCamp = document.getElementById('btn-mk-new-campanha');
        if (btnNewCamp) btnNewCamp.onclick = () => this.openCampanhaModal();

        // Filtros Kanban
        const filterPlat = document.getElementById('mk-kanban-filter-plataforma');
        if (filterPlat) filterPlat.onchange = () => this.renderKanban();

        const filterResp = document.getElementById('mk-kanban-filter-responsavel');
        if (filterResp) filterResp.onchange = () => this.renderKanban();

        const btnRefresh = document.getElementById('btn-mk-refresh-kanban');
        if (btnRefresh) btnRefresh.onclick = () => this.renderKanban();

        // Calendário Controles
        const btnPrev = document.getElementById('btn-mk-prev-month');
        if (btnPrev) btnPrev.onclick = () => { this.currentDate.setMonth(this.currentDate.getMonth() - 1); this.renderCalendar(); };

        const btnNext = document.getElementById('btn-mk-next-month');
        if (btnNext) btnNext.onclick = () => { this.currentDate.setMonth(this.currentDate.getMonth() + 1); this.renderCalendar(); };

        const btnToday = document.getElementById('btn-mk-today');
        if (btnToday) btnToday.onclick = () => { this.currentDate = new Date(); this.renderCalendar(); };

        const btnAddEquipe = document.getElementById('btn-mk-add-equipe');
        if (btnAddEquipe) btnAddEquipe.onclick = () => this.openEquipeModal();
    },

    openEquipeModal() {
        const modal = document.getElementById('modal-marketing-equipe');
        const form = document.getElementById('form-marketing-equipe');
        if (form) form.reset();

        // Popular select de funcionários no modal
        const select = document.getElementById('mk-equipe-funcionario');
        if (select) {
            select.innerHTML = '<option value="">Selecione um funcionário...</option>';
            const funcs = Store.getData().funcionarios || [];
            funcs.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.innerText = f.nome;
                select.appendChild(opt);
            });
        }

        modal.classList.add('active');
    },

    closeEquipeModal() {
        document.getElementById('modal-marketing-equipe').classList.remove('active');
    },

    async saveEquipeMember() {
        const funcId = document.getElementById('mk-equipe-funcionario').value;
        const funcao = document.getElementById('mk-equipe-funcao').value;

        if (!funcId) {
            alert("Por favor, selecione um funcionário.");
            return;
        }

        const btn = document.querySelector('#modal-marketing-equipe .btn-primary');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...';
        btn.disabled = true;

        try {
            const res = await Store.addMarketingEquipeMember({
                funcionario_id: parseInt(funcId),
                funcao: funcao,
                permissoes: ['marketing']
            });

            if (res) {
                if (window.confetti) window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                this.closeEquipeModal();
                this.renderEquipe();
            } else {
                alert("Erro ao adicionar membro à equipe.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro de conexão.");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    switchTab(tabId) {
        this.currentTab = tabId;
        document.querySelectorAll('.marketing-tab-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.marketing-tabs .modal-tab-btn').forEach(btn => btn.classList.remove('active'));

        const targetEl = document.getElementById(tabId);
        if (targetEl) targetEl.style.display = 'block';

        const activeBtn = document.querySelector(`[data-marketing-tab="${tabId}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        this.renderCurrentTab();
    },

    renderCurrentTab() {
        switch (this.currentTab) {
            case 'mk-tab-dashboard': this.renderDashboard(); break;
            case 'mk-tab-kanban': this.renderKanban(); break;
            case 'mk-tab-calendario': this.renderCalendar(); break;
            case 'mk-tab-campanhas': this.renderCampanhas(); break;
            case 'mk-tab-equipe': this.renderEquipe(); break;
        }
    },

    // --- 1. DASHBOARD ---
    renderDashboard() {
        const posts = Store.getData().marketing_posts || [];
        const metrics = Store.getData().marketing_metricas || [];

        // KPIs
        const totalPublicados = posts.filter(p => p.status === 'Publicado').length;
        const totalAgendados = posts.filter(p => p.status === 'Agendado').length;

        document.getElementById('mk-kpi-publicados').innerText = totalPublicados;
        document.getElementById('mk-kpi-agendados').innerText = totalAgendados;

        if (metrics.length > 0) {
            document.getElementById('mk-kpi-engajamento').innerText = (metrics[0].engajamento || 0) + '%';
            document.getElementById('mk-kpi-leads').innerText = metrics[0].leads_whatsapp || 0;
        }

        this.renderCharts();
    },

    renderCharts() {
        const ctxFollowers = document.getElementById('mk-followers-chart');
        if (ctxFollowers) {
            if (window.mkFollowersChart) window.mkFollowersChart.destroy();
            window.mkFollowersChart = new Chart(ctxFollowers, {
                type: 'line',
                data: {
                    labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
                    datasets: [{
                        label: 'Seguidores',
                        data: [1200, 1250, 1310, 1380],
                        borderColor: '#4F46E5',
                        tension: 0.4,
                        fill: true,
                        backgroundColor: 'rgba(79, 70, 229, 0.1)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        const ctxPlatform = document.getElementById('mk-platform-chart');
        if (ctxPlatform) {
            if (window.mkPlatformChart) window.mkPlatformChart.destroy();
            window.mkPlatformChart = new Chart(ctxPlatform, {
                type: 'doughnut',
                data: {
                    labels: ['Instagram', 'Facebook', 'WhatsApp', 'LinkedIn'],
                    datasets: [{
                        data: [45, 25, 20, 10],
                        backgroundColor: ['#E1306C', '#1877F2', '#25D366', '#0A66C2']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    },

    // --- 2. KANBAN ---
    renderKanban() {
        const posts = Store.getData().marketing_posts || [];
        const platFilter = document.getElementById('mk-kanban-filter-plataforma').value;
        const respFilter = document.getElementById('mk-kanban-filter-responsavel').value;

        const columns = document.querySelectorAll('#mk-tab-kanban .kanban-cards-area');

        // Popular select de responsáveis se estiver vazio (apenas uma vez ou quando mudar equipe)
        const selectResp = document.getElementById('mk-kanban-filter-responsavel');
        if (selectResp.options.length <= 1) {
            const funcs = Store.getData().funcionarios || [];
            funcs.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.innerText = f.nome;
                selectResp.appendChild(opt);
            });
        }

        columns.forEach(col => {
            const status = col.getAttribute('data-status');
            let colPosts = posts.filter(p => p.status === status);

            // Aplicar Filtros
            if (platFilter !== 'All') colPosts = colPosts.filter(p => p.plataforma === platFilter);
            if (respFilter !== 'All') colPosts = colPosts.filter(p => p.responsavel_id == respFilter);

            // Atualizar badge
            const badge = col.parentElement.querySelector('.count-badge');
            if (badge) badge.innerText = colPosts.length;

            col.innerHTML = '';
            colPosts.forEach(post => {
                const card = this.createCard(post);
                col.appendChild(card);
            });

            // Re-bind drop events
            this.setupDropEvents(col, status);
        });
    },

    createCard(post) {
        const card = document.createElement('div');
        card.className = 'glass-card kanban-card fade-in';
        card.draggable = true;
        card.setAttribute('data-id', post.id);

        const priorityClass = post.prioridade === 'Alta' ? 'status-danger' : (post.prioridade === 'Baixa' ? 'status-info' : 'status-warning');

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                 <div class="kanban-card-tag" style="background: ${this.getBadgeColor(post.plataforma)}; font-size:0.6rem;">
                    ${post.plataforma}
                </div>
                <span class="table-badge ${priorityClass}" style="font-size:0.55rem; padding: 2px 6px;">${post.prioridade || 'Normal'}</span>
            </div>
            <h4 style="font-size: 0.85rem; margin: 0.3rem 0; font-weight:600; line-height:1.2;">${post.titulo}</h4>
            <p style="font-size: 0.7rem; color: var(--text-muted); line-height: 1.3; margin-top:0.5rem;">
                <i class="fa-solid fa-clapperboard"></i> ${post.tipo || 'Post'}
            </p>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top:0.5rem;">
                <span style="font-size: 0.65rem; opacity: 0.6;"><i class="fa-solid fa-calendar-day"></i> ${post.data_prevista ? post.data_prevista.split('-').reverse().join('/') : 'S/D'}</span>
                <div class="kanban-card-actions">
                    <button class="action-btn-mini" onclick="Marketing.editPost(${post.id})" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="action-btn-mini" onclick="Marketing.showPostDetails(${post.id})" title="Ver Detalhes"><i class="fa-solid fa-circle-info"></i></button>
                </div>
            </div>
        `;

        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', post.id);
            card.classList.add('dragging');
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });

        return card;
    },

    setupDropEvents(col, status) {
        col.addEventListener('dragover', (e) => { e.preventDefault(); col.style.background = 'rgba(255,255,255,0.05)'; });
        col.addEventListener('dragleave', () => { col.style.background = 'transparent'; });
        col.addEventListener('drop', async (e) => {
            e.preventDefault();
            col.style.background = 'transparent';
            const postId = parseInt(e.dataTransfer.getData('text/plain'));
            await Store.updateMarketingPostStatus(postId, status);
            this.renderKanban();
        });
    },

    // --- 3. CALENDÁRIO ---
    renderCalendar() {
        const grid = document.getElementById('mk-calendar-grid');
        const title = document.getElementById('mk-calendar-month-year');
        if (!grid) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        title.innerText = `${monthNames[month]} ${year}`;

        grid.innerHTML = '';
        // Header dias
        ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(d => {
            const h = document.createElement('div');
            h.className = 'calendar-day-header';
            h.innerText = d;
            grid.appendChild(h);
        });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Empty slots
        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day empty';
            grid.appendChild(empty);
        }

        const posts = Store.getData().marketing_posts || [];

        for (let day = 1; day <= daysInMonth; day++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.innerHTML = `<span class="day-number">${day}</span>`;

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayPosts = posts.filter(p => p.data_prevista === dateStr);

            dayPosts.forEach(p => {
                const item = document.createElement('div');
                item.className = 'calendar-event';
                item.style.borderLeft = `3px solid ${this.getBadgeColor(p.plataforma)}`;
                item.innerHTML = `<i class="fa-solid fa-circle" style="font-size:0.4rem; margin-right:4px;"></i> ${p.titulo}`;
                item.onclick = () => this.editPost(p.id);
                dayEl.appendChild(item);
            });

            grid.appendChild(dayEl);
        }
    },

    // --- 4. CAMPANHAS ---
    renderCampanhas() {
        const camps = Store.getData().marketing_campanhas || [];
        const tbody = document.querySelector('#mk-campanhas-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        camps.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${c.nome}</strong></td>
                <td>${c.objetivo}</td>
                <td><span class="table-badge primary">${c.plataforma}</span></td>
                <td>R$ ${c.orcamento ? c.orcamento.toLocaleString() : '0,00'}</td>
                <td>${c.periodo_inicio ? c.periodo_inicio.split('-').reverse().join('/') : ''}</td>
                <td><span style="color:var(--success); font-weight:700;">${c.metricas?.roi || '0'}x</span></td>
                <td><span class="table-badge warning">${c.status}</span></td>
                <td>
                    <button class="action-btn-mini" onclick="Marketing.editCampanha(${c.id})"><i class="fa-solid fa-pen"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    // --- 5. EQUIPE ---
    renderEquipe() {
        const equipe = Store.getData().marketing_equipe || [];
        const tbody = document.querySelector('#mk-equipe-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        equipe.forEach(m => {
            const func = Store.getData().funcionarios.find(f => f.id === m.funcionario_id);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${func ? func.nome : 'Desconhecido'}</strong></td>
                <td>${m.funcao}</td>
                <td>12 tarefas</td>
                <td>95%</td>
                <td>
                    <button class="action-btn-mini"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn-mini" style="color:var(--danger);"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    // --- MODAIS E SALVAMENTO ---
    openPostModal(id = null) {
        const modal = document.getElementById('modal-marketing-post');
        const form = document.getElementById('form-marketing-post');
        form.reset();
        document.getElementById('mk-post-id').value = '';

        // Popular responsáveis no modal
        const select = document.getElementById('mk-post-responsavel');
        select.innerHTML = '<option value="">Selecione...</option>';
        Store.getData().funcionarios.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.innerText = f.nome;
            select.appendChild(opt);
        });

        if (id) {
            const post = Store.getData().marketing_posts.find(p => p.id === id);
            if (post) {
                document.getElementById('mk-post-id').value = post.id;
                document.getElementById('mk-post-titulo').value = post.titulo;
                document.getElementById('mk-post-plataforma').value = post.plataforma;
                document.getElementById('mk-post-tipo').value = post.tipo || 'Post';
                document.getElementById('mk-post-data').value = post.data_prevista || '';
                document.getElementById('mk-post-responsavel').value = post.responsavel_id || '';
                document.getElementById('mk-post-copy').value = post.copy || '';
                if (post.prioridade) {
                    const rad = document.querySelector(`input[name="mk-prioridade"][value="${post.prioridade}"]`);
                    if (rad) rad.checked = true;
                }
            }
        }

        modal.classList.add('active');
    },

    closePostModal() {
        document.getElementById('modal-marketing-post').classList.remove('active');
    },

    async savePost() {
        const id = document.getElementById('mk-post-id').value;
        const postData = {
            titulo: document.getElementById('mk-post-titulo').value,
            plataforma: document.getElementById('mk-post-plataforma').value,
            tipo: document.getElementById('mk-post-tipo').value,
            data_prevista: document.getElementById('mk-post-data').value,
            responsavel_id: document.getElementById('mk-post-responsavel').value ? parseInt(document.getElementById('mk-post-responsavel').value) : null,
            copy: document.getElementById('mk-post-copy').value,
            prioridade: document.querySelector('input[name="mk-prioridade"]:checked').value
        };

        if (!postData.titulo) {
            alert("O título do post é obrigatório.");
            return;
        }

        const btn = document.querySelector('#modal-marketing-post .btn-primary');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...';
        btn.disabled = true;

        try {
            if (id) postData.id = parseInt(id);
            const saved = await Store.saveMarketingPost(postData);
            if (saved) {
                if (window.confetti) window.confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
                this.closePostModal();
                this.renderCurrentTab();
            } else {
                alert("Erro ao salvar o conteúdo. Verifique o servidor.");
            }
        } catch (e) {
            console.error("Erro no salvamento do post:", e);
            alert("Erro crítico ao salvar.");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    openCampanhaModal(id = null) {
        const modal = document.getElementById('modal-marketing-campanha');
        document.getElementById('form-marketing-campanha').reset();
        document.getElementById('mk-camp-id').value = '';
        modal.classList.add('active');
    },

    closeCampanhaModal() {
        document.getElementById('modal-marketing-campanha').classList.remove('active');
    },

    async saveCampanha() {
        const campData = {
            nome: document.getElementById('mk-camp-nome').value,
            objetivo: document.getElementById('mk-camp-objetivo').value,
            periodo_inicio: document.getElementById('mk-camp-inicio').value,
            periodo_fim: document.getElementById('mk-camp-fim').value,
            orcamento: parseFloat(document.getElementById('mk-camp-orcamento').value) || 0,
            plataforma: 'Meta Ads',
            status: 'Planejamento'
        };

        if (!campData.nome) {
            alert("O nome da campanha é obrigatório.");
            return;
        }

        const btn = document.querySelector('#modal-marketing-campanha .btn-primary');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...';
        btn.disabled = true;

        try {
            const saved = await Store.saveMarketingCampanha(campData);
            if (saved) {
                if (window.confetti) window.confetti({ particleCount: 100, spread: 50, origin: { y: 0.6 } });
                this.closeCampanhaModal();
                this.renderCampanhas();
            } else {
                alert("Erro ao salvar campanha.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro de conexão.");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    editPost(id) { this.openPostModal(id); },
    editCampanha(id) { this.openCampanhaModal(id); },

    getBadgeColor(platform) {
        if (!platform) return 'var(--primary)';
        switch (platform.toLowerCase()) {
            case 'instagram': return '#E1306C';
            case 'facebook': return '#1877F2';
            case 'whatsapp': return '#25D366';
            case 'linkedin': return '#0A66C2';
            case 'youtube': return '#FF0000';
            default: return 'var(--primary)';
        }
    },

    showPostDetails(id) {
        const post = Store.getData().marketing_posts.find(p => p.id === id);
        if (post) {
            alert(`Visualizando Detalhes estilo Notion:\n\nTítulo: ${post.titulo}\nStatus: ${post.status}\n\nCopy:\n${post.copy || 'Sem legenda.'}`);
        }
    }
};

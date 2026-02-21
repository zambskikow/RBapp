// js/app.js - Main UI Controller

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

let currentSemaforoChart = null;
let currentOperacionalUser = 'All';
let currentCompetencia = '2026-02';
let LOGGED_USER = null; // Replaced hardcoded string

async function initApp() {
    // Await API Hydration First!
    const loaded = await Store.loadFromStorage();
    if (!loaded) {
        console.warn("API Offline or database empty.");
    }

    // Check initial state
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Check local storage for session
    const storedSession = localStorage.getItem('fiscalapp_session');
    if (storedSession) {
        // Find user
        const auth = Store.getData().funcionarios.find(f => f.id === parseInt(storedSession));
        if (auth) {
            LOGGED_USER = auth;
            document.getElementById('login-overlay').style.display = 'none';
            document.getElementById('main-app-container').style.display = 'flex';

            // Apply User info to sidebar
            document.querySelector('.sidebar .user-name').textContent = auth.nome;
            document.querySelector('.sidebar .user-role').textContent = auth.permissao;

            // Trigger renders since we now have contextual access
            loadSetoresSelects();
            renderDashboard();
            renderOperacional();
            renderClientes();
            renderEquipe();
            renderRotinas();
            renderMensagens();
            renderAuditoria();
            updateMensagensBadges();
        }
    }

    // Setup everything else but don't render until logged in
    setupNavigation();

    // 2. Set Format Dates
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Populate Competencia Filter
    const compFilter = document.getElementById('competencia-filter');
    compFilter.innerHTML = '';
    Store.getData().meses.forEach(m => {
        compFilter.innerHTML += `<option value="${m.id}">${m.mes}</option>`;
    });

    // Set default values based on the store's active month
    const activeMonth = Store.getData().meses.find(m => m.ativo) || Store.getData().meses[0];
    if (activeMonth) {
        currentCompetencia = activeMonth.id;
        compFilter.value = currentCompetencia;
    } else {
        currentCompetencia = '2026-02'; // Fallback
    }

    // 3. User & Competencia Filter global events
    document.getElementById('user-filter').addEventListener('change', (e) => {
        currentOperacionalUser = e.target.value;
        renderOperacional();
    });

    compFilter.addEventListener('change', (e) => {
        currentCompetencia = e.target.value;
        renderOperacional();

        // Se a view atual for dashboard, atualiza os gráficos pra refletir
        const dashboardView = document.getElementById('view-dashboard');
        if (dashboardView && dashboardView.classList.contains('active') || dashboardView.style.display === 'block') {
            renderDashboard();
        }
    });

    // 4. Modals Events Setup
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    // 6. Client Modal Events
    document.getElementById('btn-add-client').addEventListener('click', openClientModal);
    document.getElementById('close-client-modal').addEventListener('click', closeClientModal);
    document.getElementById('client-modal-cancel').addEventListener('click', closeClientModal);
    document.getElementById('add-client-form').addEventListener('submit', handleAddClient);

    // 7. Equipe Modal Events
    document.getElementById('btn-add-equipe').addEventListener('click', openEquipeModal);
    document.getElementById('close-equipe-modal').addEventListener('click', closeEquipeModal);
    document.getElementById('equipe-modal-cancel').addEventListener('click', closeEquipeModal);
    document.getElementById('add-equipe-form').addEventListener('submit', handleAddFuncionario);

    // 8. Rotinas Base Modal Events
    document.getElementById('btn-add-rotina').addEventListener('click', () => openRotinaModal());
    document.getElementById('close-rotina-modal').addEventListener('click', closeRotinaModal);
    document.getElementById('rotina-modal-cancel').addEventListener('click', closeRotinaModal);
    document.getElementById('add-rotina-form').addEventListener('submit', handleSaveRotina);
    document.getElementById('btn-add-checklist-item').addEventListener('click', handleAddChecklistItem);

    // 9. Mensagens Modal Events
    document.getElementById('btn-nova-mensagem').addEventListener('click', openNovaMensagemModal);
    document.getElementById('close-mensagem-modal').addEventListener('click', closeNovaMensagemModal);
    document.getElementById('mensagem-modal-cancel').addEventListener('click', closeNovaMensagemModal);
    document.getElementById('nova-mensagem-form').addEventListener('submit', handleSendMensagem);

    // 10. Manage Setores Modal Events
    const btnManageSetores = document.getElementById('btn-manage-setores');
    if (btnManageSetores) btnManageSetores.addEventListener('click', openSetoresModal);
    const closeSetores1 = document.getElementById('close-setores-modal');
    if (closeSetores1) closeSetores1.addEventListener('click', closeSetoresModal);
    const closeSetores2 = document.getElementById('setores-modal-close-btn');
    if (closeSetores2) closeSetores2.addEventListener('click', closeSetoresModal);
    const btnAddSetor = document.getElementById('btn-add-setor-submit');
    if (btnAddSetor) btnAddSetor.addEventListener('click', handleAddSetor);

    // 11. Auditoria Export Event
    const btnExportLogs = document.getElementById('btn-export-logs');
    if (btnExportLogs) btnExportLogs.addEventListener('click', downloadAuditoriaCSV);

    // 12. Backup Events
    const btnExportBackup = document.getElementById('btn-export-backup');
    if (btnExportBackup) btnExportBackup.addEventListener('click', downloadBackupFile);

    const btnRestoreBackup = document.getElementById('btn-restore-backup');
    if (btnRestoreBackup) btnRestoreBackup.addEventListener('click', restoreBackupFile);

    const toggleAutoBackup = document.getElementById('toggle-auto-backup');
    if (toggleAutoBackup) {
        toggleAutoBackup.addEventListener('change', (e) => {
            Store.updateConfig('autoBackup', e.target.checked);
        });
    }
}

function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    const errorMsg = document.getElementById('login-error');

    const auth = Store.login(user, pass);
    if (auth) {
        LOGGED_USER = auth;
        document.getElementById('login-overlay').classList.remove('active');
        setTimeout(() => {
            document.getElementById('login-overlay').style.display = 'none';
            document.getElementById('main-app-container').style.display = 'flex';

            // Apply User info to sidebar
            document.querySelector('.sidebar .user-name').textContent = auth.nome;
            document.querySelector('.sidebar .user-role').textContent = auth.permissao;

            // Trigger renders since we now have contextual access
            loadSetoresSelects();
            renderDashboard();
            renderOperacional();
            renderClientes();
            renderEquipe();
            renderRotinas();
            renderMensagens();
            renderAuditoria();
            renderBackupView();
            updateMensagensBadges();

            // Handle security visibility for Navbar dynamically upon login validation
            const navAudit = document.getElementById('nav-auditoria');
            const navBackup = document.getElementById('nav-backup');
            const btnSetores = document.getElementById('btn-manage-setores');
            if (auth.permissao !== 'Gerente') {
                if (navAudit) navAudit.style.display = 'none';
                if (navBackup) navBackup.style.display = 'none';
                if (btnSetores) btnSetores.style.display = 'none';
            } else {
                if (navAudit) navAudit.style.display = 'flex';
                if (navBackup) navBackup.style.display = 'flex';
                if (btnSetores) btnSetores.style.display = 'inline-block';
            }

            localStorage.setItem('fiscalapp_session', auth.id);

            // Execute Auto-Backup if enabled
            checkAndRunAutoBackup();
        }, 300); // Wait for fade out
    } else {
        errorMsg.style.display = 'block';
    }
}

function handleLogout() {
    localStorage.removeItem('fiscalapp_session');
    LOGGED_USER = null;
    document.getElementById('main-app-container').style.display = 'none';
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('login-overlay').classList.add('active');
    document.getElementById('login-form').reset();
    document.getElementById('login-error').style.display = 'none';
    // Clear selections so another user gets clean view next login
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelector('[data-view="dashboard"]').classList.add('active');
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(link => {
        if (link.id === 'btn-logout') return; // Handled separately

        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            link.classList.add('active');

            // Switch views globally
            const targetView = link.getAttribute('data-view');
            document.querySelectorAll('.view-section').forEach(view => {
                view.style.display = 'none';
                view.classList.remove('active');
            });

            const viewEl = document.getElementById(`view-${targetView}`);
            if (viewEl) {
                viewEl.style.display = 'block';
                // Small delay to trigger CSS animation
                setTimeout(() => viewEl.classList.add('active'), 10);

                // Refresh data based on view
                if (targetView === 'dashboard') renderDashboard();
                if (targetView === 'operacional') renderOperacional();
                if (targetView === 'clientes') renderClientes();
                if (targetView === 'equipe') renderEquipe();
                if (targetView === 'rotinas') renderRotinas();
                if (targetView === 'mensagens') renderMensagens();
                if (targetView === 'auditoria') renderAuditoria();
                if (targetView === 'backup') renderBackupView();
            }
        });
    });

    document.getElementById('btn-logout').addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
}

// ==========================================
// VIEW: Dashboard Manager
// ==========================================
function renderDashboard() {
    const kpis = Store.getKPIs(currentCompetencia);

    // Counters Animation
    animateValue('kpi-total', 0, kpis.total, 800);
    animateValue('kpi-done', 0, kpis.concluidos, 800);
    animateValue('kpi-andamento', 0, kpis.emAndamento, 800);
    animateValue('kpi-warning', 0, kpis.vencendo, 800);
    animateValue('kpi-late', 0, kpis.atrasados, 800);

    // Chart.js initialization
    renderChart(kpis);

    // Render Bottlenecks table
    const critical = Store.getCriticalBottlenecks(currentCompetencia);
    const tbody = document.querySelector('#critical-table tbody');
    tbody.innerHTML = '';

    if (critical.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--success);"><i class="fa-solid fa-face-smile fa-2x mb-3"></i><br/>Tudo sob controle! Nenhum gargalo encontrado.</td></tr>`;
    } else {
        critical.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${c.clientName}</strong></td>
                <td><span class="resp-tag">${c.rotina}</span></td>
                <td><i class="fa-solid fa-user-circle" style="color:var(--text-muted)"></i> ${c.responsavel}</td>
                <td>${formatDate(c.diaPrazo)}</td>
                <td><span class="status-badge atrasado">${c.statusAuto}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Render Team Performance
    let execsAll = Store.getExecucoesWithDetails('All');
    if (currentCompetencia) {
        execsAll = execsAll.filter(e => e.competencia === currentCompetencia);
    }
    const teamStats = {};
    execsAll.forEach(ex => {
        if (!teamStats[ex.responsavel]) {
            teamStats[ex.responsavel] = { total: 0, concluidas: 0, hoje: 0, atrasadas: 0 };
        }
        teamStats[ex.responsavel].total++;
        if (ex.feito) teamStats[ex.responsavel].concluidas++;
        else if (ex.semaforo === 'red') teamStats[ex.responsavel].atrasadas++;
        else if (ex.semaforo === 'yellow') teamStats[ex.responsavel].hoje++;
    });

    const ptbody = document.querySelector('#team-performance-table tbody');
    ptbody.innerHTML = '';
    if (Object.keys(teamStats).length === 0) {
        ptbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;">Sem dados de equipe.</td></tr>`;
    } else {
        Object.keys(teamStats).forEach(resp => {
            const st = teamStats[resp];
            const pct = st.total > 0 ? Math.round((st.concluidas / st.total) * 100) : 0;
            let pctBadge = 'noprazo';
            if (pct < 50) pctBadge = 'atrasado';
            else if (pct < 80) pctBadge = 'vencendo';

            let progressHtml = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="progress-container" style="flex:1; margin:0;"><div class="progress-bar" style="width:${pct}%"></div></div>
                    <span class="status-badge ${pctBadge}">${pct}%</span>
                </div>
            `;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="resp-tag"><i class="fa-solid fa-user-circle"></i> ${resp}</span></td>
                <td>${st.total}</td>
                <td><span style="color:var(--success); font-weight:bold;">${st.concluidas}</span></td>
                <td><span style="color:var(--warning);">${st.hoje}</span></td>
                <td><span style="color:var(--danger);">${st.atrasadas}</span></td>
                <td style="width:200px;">${progressHtml}</td>
            `;
            ptbody.appendChild(tr);
        });
    }
}

function renderChart(kpis) {
    const ctx = document.getElementById('semaforoChart');
    if (currentSemaforoChart) {
        currentSemaforoChart.destroy();
    }

    const data = [kpis.concluidos, kpis.emAndamento, kpis.vencendo, kpis.atrasados];
    // Dummy state so it looks like a ring
    if (data.every(d => d === 0)) data[0] = 0.1;

    currentSemaforoChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Concluído', 'Em Andamento', 'Vencendo Hoje', 'Atrasado'],
            datasets: [{
                data: data,
                backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'],
                borderWidth: 0,
                hoverOffset: 6
            }]
        },
        options: {
            cutout: '75%',
            responsive: true,
            maintainAspectRatio: false,
            animation: { animateScale: true, animateRotate: true },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#F8FAFC', padding: 20, font: { family: 'Inter', size: 13 } }
                }
            }
        }
    });
}

// ==========================================
// VIEW: Painel Operacional
// ==========================================
function renderOperacional() {
    let tasks = Store.getExecucoesWithDetails(currentOperacionalUser);

    // Filter by selected Competencia (History/Auditing)
    if (currentCompetencia) {
        tasks = tasks.filter(t => t.competencia && t.competencia.startsWith(currentCompetencia));
    }

    const container = document.getElementById('operacional-groups-container');
    container.innerHTML = '';

    if (tasks.length === 0) {
        container.innerHTML = `<div class="glass-card" style="text-align:center; padding: 3rem;">Nenhuma tarefa encontrada para este filtro.</div>`;
        return;
    }

    // Group tasks by 'rotina'
    const grouped = {};
    tasks.forEach(t => {
        if (!grouped[t.rotina]) grouped[t.rotina] = [];
        grouped[t.rotina].push(t);
    });

    Object.keys(grouped).forEach(rotinaName => {
        const groupTasks = grouped[rotinaName];

        // Sort inside group: Atrasados -> Vencendo Hoje -> No Prazo -> Concluido
        groupTasks.sort((a, b) => {
            if (a.feito && !b.feito) return 1;
            if (!a.feito && b.feito) return -1;
            return new Date(a.diaPrazo) - new Date(b.diaPrazo);
        });

        // Create Group Wrapper
        const groupDiv = document.createElement('div');
        groupDiv.className = 'routine-group fade-in';

        // Count done vs total
        const doneCount = groupTasks.filter(t => t.feito).length;

        // Build HTML
        let tableHtml = `
            <div class="routine-group-header">
                <h2><i class="fa-solid fa-layer-group"></i> ${rotinaName}</h2>
                <span class="routine-group-badge">${doneCount}/${groupTasks.length} Entregues</span>
            </div>
            <div class="table-responsive">
                <table class="data-table selectable-rows">
                    <thead>
                        <tr>
                            <th>Status Geral</th>
                            <th>Sinalização</th>
                            <th>Cliente</th>
                            <th>Prazo</th>
                            <th>Responsável</th>
                            <th>Status Auto</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        groupTasks.forEach(t => {
            let badgeClass = 'noprazo';
            if (t.statusAuto.includes('Atrasado')) badgeClass = 'atrasado';
            else if (t.statusAuto.includes('Hoje')) badgeClass = 'hoje';
            else if (t.statusAuto === 'Concluído') badgeClass = 'concluido';
            else if (t.statusAuto.includes('Em Andamento')) badgeClass = 'andamento';
            else if (t.statusAuto.includes('Vence')) badgeClass = 'vencendo';

            let driveBtnHtml = t.driveLink && t.driveLink !== "#" && t.driveLink.trim() !== ""
                ? `<a href="${t.driveLink}" target="_blank" class="btn btn-small btn-secondary" style="margin-right: 4px; padding: 0.25rem 0.5rem; font-size: 0.8rem;" title="Abrir Google Drive do Cliente"><i class="fa-brands fa-google-drive"></i></a>`
                : '';

            tableHtml += `
                <tr data-id="${t.id}" style="cursor: pointer;">
                    <td style="text-align: center;">
                        ${t.feito ? '<i class="fa-solid fa-circle-check fa-lg" style="color:var(--success)"></i>' : '<i class="fa-regular fa-circle fa-lg" style="color:var(--text-muted)"></i>'}
                    </td>
                    <td>
                        <div class="status-indicator">
                            <span class="orb ${t.semaforo}"></span>
                        </div>
                    </td>
                    <td><strong>${t.clientName}</strong></td>
                    <td>${formatDate(t.diaPrazo)}</td>
                    <td><span class="resp-tag"><i class="fa-solid fa-user"></i> ${t.responsavel}</span></td>
                    <td><span class="status-badge ${badgeClass}">${t.statusAuto}</span></td>
                    <td style="white-space: nowrap;">
                        ${driveBtnHtml}
                        <button class="btn btn-small btn-secondary open-task-btn" data-id="${t.id}">
                            Abrir <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;

        groupDiv.innerHTML = tableHtml;
        container.appendChild(groupDiv);
    });

    // Attach click events for both row and button
    document.querySelectorAll('#operacional-groups-container tr[data-id]').forEach(tr => {
        const taskId = parseInt(tr.getAttribute('data-id'));
        // Row click
        tr.addEventListener('click', () => openTaskModal(taskId));

        // Prevent bubble on internal button
        const btn = tr.querySelector('.open-task-btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openTaskModal(taskId);
            });
        }
    });
}

// ==========================================
// VIEW: Gestão de Clientes
// ==========================================
function renderClientes() {
    const clients = Store.getData().clientes;
    const stats = Store.getClientStats();

    // Update KPI Cards
    animateValue('kpi-total-clientes', 0, stats.total, 600);
    animateValue('kpi-simples', 0, stats.simples, 600);
    animateValue('kpi-outros-regimes', 0, stats.outros, 600);

    const tbody = document.querySelector('#clients-table tbody');
    tbody.innerHTML = '';

    if (clients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 3rem;">Nenhum cliente cadastrado.</td></tr>`;
        return;
    }

    // Sort by ID descending (newest first)
    const sorted = [...clients].sort((a, b) => b.id - a.id);

    sorted.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = 'fade-in';

        const isSimples = c.regime === 'Simples Nacional' || c.regime === 'MEI';

        let tagsHtml = '';
        if (c.rotinasSelecionadas) {
            c.rotinasSelecionadas.forEach(rotId => {
                const rName = Store.getData().rotinasBase.find(r => r.id === rotId)?.nome || 'Rotina';
                tagsHtml += `<span class="rotina-mini-tag">${rName}</span>`;
            });
        }

        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="client-checkbox custom-checkbox" value="${c.id}">
            </td>
            <td><strong>${c.codigo}</strong></td>
            <td>${c.razaoSocial}</td>
            <td>${c.cnpj}</td>
            <td>${c.regime}</td>
            <td><span class="resp-tag"><i class="fa-solid fa-user"></i> ${c.responsavelFiscal}</span></td>
            <td><div style="display:flex; gap:4px; flex-wrap:wrap; max-width:200px;">${tagsHtml}</div></td>
            <td style="white-space: nowrap;">
                <button class="btn btn-small btn-secondary" onclick="openClientModal(${c.id})" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-right: 4px;">
                    <i class="fa-solid fa-pen"></i> Editar
                </button>
                <button class="btn btn-small btn-secondary btn-delete-single-client" data-id="${c.id}" style="color: var(--danger); background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                    <i class="fa-solid fa-trash"></i> Excluir
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });

    setupClientCheckboxes();

    // Add single delete events
    document.querySelectorAll('.btn-delete-single-client').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = parseInt(e.currentTarget.getAttribute('data-id'));
            const c = Store.getData().clientes.find(x => x.id === id);
            if (c && confirm(`Atenção: Tem certeza que deseja excluir o cliente '${c.razaoSocial}' e TUDO que estiver atrelado a ele?`)) {
                await Store.deleteClient(id);
                renderClientes();
                renderOperacional();
                renderDashboard();
            }
        });
    });
}

function setupClientCheckboxes() {
    const selectAllCb = document.getElementById('select-all-clients');
    const checkboxes = document.querySelectorAll('.client-checkbox');
    const deleteBtn = document.getElementById('btn-delete-clients');
    const badge = document.getElementById('delete-clients-badge');

    const updateDeleteBtnVisibility = () => {
        const checkedCount = document.querySelectorAll('.client-checkbox:checked').length;
        if (checkedCount > 0) {
            deleteBtn.style.display = 'inline-block';
            badge.textContent = checkedCount;
            // Uncheck "select all" if not all are checked
            if (checkedCount < checkboxes.length && selectAllCb) selectAllCb.checked = false;
            else if (selectAllCb) selectAllCb.checked = true;
        } else {
            deleteBtn.style.display = 'none';
            if (selectAllCb) selectAllCb.checked = false;
        }
    };

    if (selectAllCb) {
        selectAllCb.checked = false;
        // Need to replace the element to prevent duplicate event listeners since renderClientes is called repeatedly
        const newSelectAll = selectAllCb.cloneNode(true);
        selectAllCb.parentNode.replaceChild(newSelectAll, selectAllCb);

        newSelectAll.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            checkboxes.forEach(cb => cb.checked = isChecked);
            updateDeleteBtnVisibility();
        });
    }

    checkboxes.forEach(cb => {
        cb.addEventListener('change', updateDeleteBtnVisibility);
    });

    // Handle bulk delete click
    if (deleteBtn) {
        // Remove old listeners to prevent duplicates
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);

        newDeleteBtn.addEventListener('click', async () => {
            const selectedIds = Array.from(document.querySelectorAll('.client-checkbox:checked')).map(cb => parseInt(cb.value));
            if (selectedIds.length === 0) return;

            if (confirm(`Atenção: Deseja realmente excluir os ${selectedIds.length} clientes selecionados?`)) {
                newDeleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Excluindo...';
                for (let id of selectedIds) {
                    await Store.deleteClient(id);
                }
                newDeleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir Selecionados <span class="badge" id="delete-clients-badge">0</span>';
                newDeleteBtn.style.display = 'none';

                const currentSelectAll = document.getElementById('select-all-clients');
                if (currentSelectAll) currentSelectAll.checked = false;

                renderClientes();
                renderOperacional();
                renderDashboard();
            }
        });
    }
}

function openClientModal(id = null) {
    document.getElementById('add-client-form').reset();

    // Dynamic loading of Checkboxes (Rotinas)
    const grid = document.getElementById('rotinas-checkbox-grid');
    grid.innerHTML = '';
    Store.getData().rotinasBase.forEach(rb => {
        grid.innerHTML += `
            <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-main); cursor:pointer;">
                <input type="checkbox" name="rotina-sel" id="rotina-cb-${rb.id}" value="${rb.id}" class="custom-checkbox">
                ${rb.nome} (Dia ${rb.diaPrazoPadrao})
            </label>
        `;
    });

    // Dynamic loading of Employees (Responsáveis)
    const respSelect = document.getElementById('client-responsavel');
    respSelect.innerHTML = '';
    Store.getData().funcionarios.forEach(f => {
        respSelect.innerHTML += `<option value="${f.nome}">${f.nome} (${f.permissao})</option>`;
    });

    const title = document.getElementById('modal-client-title');
    const submitBtn = document.getElementById('client-modal-submit-btn');

    if (id) {
        // Edit Mode
        const cliente = Store.getData().clientes.find(c => c.id === id);
        if (cliente) {
            title.innerHTML = '<i class="fa-solid fa-user-pen highlight-text"></i> Editar Cliente';
            submitBtn.innerHTML = 'Salvar Alterações';

            document.getElementById('client-id').value = cliente.id;
            document.getElementById('client-razao').value = cliente.razaoSocial;
            document.getElementById('client-cnpj').value = cliente.cnpj;
            document.getElementById('client-regime').value = cliente.regime;
            document.getElementById('client-responsavel').value = cliente.responsavelFiscal;
            document.getElementById('client-drive').value = cliente.driveLink || '';

            // Check the routines the client already has
            if (cliente.rotinasSelecionadas) {
                cliente.rotinasSelecionadas.forEach(rotId => {
                    const cb = document.getElementById(`rotina-cb-${rotId}`);
                    if (cb) cb.checked = true;
                });
            }
        }
    } else {
        // Add Mode
        title.innerHTML = '<i class="fa-solid fa-user-plus highlight-text"></i> Novo Cliente';
        submitBtn.innerHTML = 'Cadastrar e Gerar Rotinas';
        document.getElementById('client-id').value = '';
        document.getElementById('client-drive').value = '';
    }

    document.getElementById('add-client-modal').classList.add('active');
}

function closeClientModal() {
    document.getElementById('add-client-modal').classList.remove('active');
}

function handleAddClient(e) {
    e.preventDefault();

    const id = document.getElementById('client-id').value;
    const razao = document.getElementById('client-razao').value;
    const cnpj = document.getElementById('client-cnpj').value;
    const regime = document.getElementById('client-regime').value;
    const resp = document.getElementById('client-responsavel').value;
    const drive = document.getElementById('client-drive').value;

    // Collect specific checked routines
    const selectedRotinas = Array.from(document.querySelectorAll('input[name="rotina-sel"]:checked')).map(cb => parseInt(cb.value));

    if (selectedRotinas.length === 0) {
        alert("Atenção: Você precisa selecionar ao menos UMA rotina para este cliente.");
        return;
    }

    if (id) {
        Store.editClient(id, razao, cnpj, regime, resp, selectedRotinas, drive);
    } else {
        Store.addClient(razao, cnpj, regime, resp, selectedRotinas, drive);
    }

    // Refresh lists
    renderClientes();
    renderOperacional();
    renderDashboard();

    // Close modal
    closeClientModal();
}

// ==========================================
// VIEW: Gestão de Equipe
// ==========================================
function renderEquipe() {
    const tbody = document.querySelector('#equipe-table tbody');
    tbody.innerHTML = '';

    const func = Store.getData().funcionarios;

    // Restrict UI for non-managers
    const btnNovoMembro = document.getElementById('btn-add-equipe');
    if (LOGGED_USER && LOGGED_USER.permissao.toLowerCase() !== 'gerente') {
        btnNovoMembro.style.display = 'none';
    } else {
        btnNovoMembro.style.display = 'inline-block';
    }

    animateValue('kpi-total-equipe', 0, func.length, 600);

    if (func.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 3rem;">Nenhum funcionário cadastrado.</td></tr>`;
        return;
    }

    func.forEach(f => {
        const tr = document.createElement('tr');
        tr.className = 'fade-in';

        const badgeColor = f.permissao === 'Gerente' ? 'var(--primary)' : 'var(--success)';

        tr.innerHTML = `
            <td><strong>#${f.id.toString().padStart(3, '0')}</strong></td>
            <td>${f.nome}</td>
            <td>${f.setor}</td>
            <td><span class="resp-tag" style="background: rgba(255,255,255,0.1); border-color: ${badgeColor}; color: ${badgeColor}">${f.permissao}</span></td>
            <td><span class="status-badge noprazo"><i class="fa-solid fa-check-circle"></i> Ativo</span></td>
        `;

        tbody.appendChild(tr);
    });
}

function openEquipeModal() {
    document.getElementById('add-equipe-form').reset();
    document.getElementById('add-equipe-modal').classList.add('active');
}

function closeEquipeModal() {
    document.getElementById('add-equipe-modal').classList.remove('active');
}

function handleAddFuncionario(e) {
    if (e) e.preventDefault();
    const nome = document.getElementById('equipe-nome').value; // Changed from membro-nome to equipe-nome
    const email = ''; // Ignored in store, no email field in current form
    const setor = document.getElementById('equipe-setor').value;
    const permissao = document.getElementById('equipe-permissao').value;
    const senha = document.getElementById('equipe-senha').value;

    Store.addFuncionario(nome, setor, permissao, senha);
    closeEquipeModal(); // Changed from closeManageEquipeModal to closeEquipeModal
    renderEquipe();
}

// ==========================================
// VIEW: Gestão de Rotinas Base
// ==========================================
function renderRotinas() {
    const rotinas = Store.getData().rotinasBase;
    const tbody = document.querySelector('#rotinas-table tbody');
    tbody.innerHTML = '';

    if (rotinas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 3rem;">Nenhuma rotina base cadastrada.</td></tr>`;
        return;
    }

    rotinas.forEach(r => {
        let badgeClass = "noprazo";
        if (r.frequencia === 'Anual') badgeClass = 'hoje';
        else if (r.frequencia === 'Eventual') badgeClass = 'atrasado'; // Using red to highlight

        const diaText = r.frequencia === 'Mensal' ? `Dia ${r.diaPrazoPadrao} do mês base` :
            (r.frequencia === 'Anual' ? `Todo ${r.diaPrazoPadrao}` : `Em ${r.diaPrazoPadrao} dia(s) úteis`);

        const tr = document.createElement('tr');
        tr.className = 'fade-in';
        tr.innerHTML = `
            <td><strong>${r.nome}</strong></td>
            <td><span class="status-badge ${badgeClass}">${r.frequencia || 'Mensal'}</span></td>
            <td><span class="resp-tag" style="background: rgba(255,255,255,0.05); color: var(--text-main);">${r.setor || '-'}</span></td>
            <td>${diaText}</td>
            <td>
                <button class="btn btn-small btn-secondary" onclick="openRotinaModal(${r.id})" style="margin-right: 4px;">
                    <i class="fa-solid fa-pen"></i> Editar
                </button>
                <button class="btn btn-small btn-secondary" onclick="handleDeleteRotina(${r.id})" style="color: var(--danger); background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2);">
                    <i class="fa-solid fa-trash"></i> Excluir
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

let currentChecklistBuilder = [];

function openRotinaModal(id = null) {
    const form = document.getElementById('add-rotina-form');
    const title = document.getElementById('modal-rotina-title');
    const labelPrazo = document.getElementById('label-rotina-prazo');
    const inputPrazo = document.getElementById('rotina-prazo');
    const selectFreq = document.getElementById('rotina-frequencia');

    form.reset();
    currentChecklistBuilder = []; // Reset builder
    document.getElementById('new-checklist-item').value = '';

    const updateUIForFreq = (freq) => {
        if (freq === 'Mensal') {
            labelPrazo.innerHTML = 'Dia de Vencimento Padrão (Fixo num mês)';
            inputPrazo.placeholder = 'Ex: 15';
        } else if (freq === 'Anual') {
            labelPrazo.innerHTML = 'Dia e Mês Específico (Fixo no Ano)';
            inputPrazo.placeholder = 'Ex: 30/04';
        } else if (freq === 'Eventual') {
            labelPrazo.innerHTML = 'Prazo em Dias (SLA após evento)';
            inputPrazo.placeholder = 'Ex: 5';
        }
    };

    selectFreq.onchange = (e) => updateUIForFreq(e.target.value);

    if (id) {
        const rotina = Store.getData().rotinasBase.find(r => r.id === id);
        if (rotina) {
            title.innerHTML = '<i class="fa-solid fa-pen highlight-text"></i> Editar Rotina';
            document.getElementById('rotina-id').value = rotina.id;
            document.getElementById('rotina-nome').value = rotina.nome;
            document.getElementById('rotina-frequencia').value = rotina.frequencia || 'Mensal';
            document.getElementById('rotina-setor').value = rotina.setor || '';
            document.getElementById('rotina-prazo').value = rotina.diaPrazoPadrao;
            currentChecklistBuilder = [...(rotina.checklistPadrao || [])];
        }
    } else {
        title.innerHTML = '<i class="fa-solid fa-layer-group highlight-text"></i> Nova Rotina';
        document.getElementById('rotina-id').value = '';
        if (Store.getData().setores.length > 0) {
            document.getElementById('rotina-setor').value = Store.getData().setores[0];
        }
        document.getElementById('rotina-frequencia').value = 'Mensal';
    }

    updateUIForFreq(document.getElementById('rotina-frequencia').value);

    renderChecklistBuilderPreview();
    document.getElementById('add-rotina-modal').classList.add('active');
}

function closeRotinaModal() {
    document.getElementById('add-rotina-modal').classList.remove('active');
}

function handleAddChecklistItem() {
    const input = document.getElementById('new-checklist-item');
    const val = input.value.trim();
    if (val) {
        currentChecklistBuilder.push(val);
        input.value = '';
        renderChecklistBuilderPreview();
    }
}

function removeChecklistItem(index) {
    currentChecklistBuilder.splice(index, 1);
    renderChecklistBuilderPreview();
}

function renderChecklistBuilderPreview() {
    const ul = document.getElementById('rotina-checklist-preview');
    ul.innerHTML = '';
    if (currentChecklistBuilder.length === 0) {
        ul.innerHTML = '<li style="color:var(--text-muted); font-size:0.8rem;">Nenhum item adicionado...</li>';
        return;
    }

    currentChecklistBuilder.forEach((item, index) => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.background = 'rgba(255,255,255,0.05)';
        li.style.padding = '0.3rem 0.5rem';
        li.style.borderRadius = '4px';
        li.style.fontSize = '0.85rem';

        li.innerHTML = `
            <span><i class="fa-solid fa-check" style="color:var(--text-muted); margin-right:5px;"></i> ${item}</span>
            <button type="button" class="btn-icon" onclick="removeChecklistItem(${index})" style="color:var(--danger); background:transparent; border:none; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
        `;
        ul.appendChild(li);
    });
}

function handleSaveRotina(e) {
    e.preventDefault();

    const id = document.getElementById('rotina-id').value;
    const nome = document.getElementById('rotina-nome').value;
    const setor = document.getElementById('rotina-setor').value;
    const frequencia = document.getElementById('rotina-frequencia').value;
    let prazo = document.getElementById('rotina-prazo').value;

    // Optional validation logic
    if (frequencia === 'Mensal' && (isNaN(prazo) || prazo < 1 || prazo > 31)) {
        alert("Para rotinas mensais, preencha um dia válido de 1 a 31.");
        return;
    }
    if (frequencia === 'Anual' && !prazo.includes('/')) {
        alert("Para rotinas anuais, preencha a data no formato DD/MM.");
        return;
    }

    if (id) {
        Store.editRotinaBase(id, nome, setor, frequencia, prazo, currentChecklistBuilder);
    } else {
        Store.addRotinaBase(nome, setor, frequencia, prazo, currentChecklistBuilder);
    }

    renderRotinas();
    closeRotinaModal();
}

async function handleDeleteRotina(id) {
    const rotina = Store.getData().rotinasBase.find(r => r.id === id);
    if (!rotina) return;

    if (confirm(`Atenção: Tem certeza que deseja EXCLUIR a rotina '${rotina.nome}'? Isso a removerá da base de rotinas disponíveis.`)) {
        try {
            await Store.deleteRotinaBase(id);
            renderRotinas();
            alert(`Rotina '${rotina.nome}' excluída com sucesso!`);
        } catch (error) {
            console.error(error);
            alert("Ocorreu um erro ao excluir a rotina. Verifique o console.");
        }
    }
}

// ==========================================
// VIEW: Gestão de Setores (Dynamic Loader)
// ==========================================

function loadSetoresSelects() {
    const setores = Store.getData().setores;

    // Update Equipe Modal Sector Select
    const eqSetor = document.getElementById('equipe-setor');
    if (eqSetor) {
        eqSetor.innerHTML = '';
        setores.forEach(s => {
            eqSetor.innerHTML += `<option value="${s}">${s}</option>`;
        });
    }

    // Update Rotina Modal Sector Select
    const rotSetor = document.getElementById('rotina-setor');
    if (rotSetor) {
        rotSetor.innerHTML = '';
        setores.forEach(s => {
            rotSetor.innerHTML += `<option value="${s}">${s}</option>`;
        });
    }
}

function renderSetoresListPreview() {
    const ul = document.getElementById('setores-list-preview');
    if (!ul) return;
    ul.innerHTML = '';
    const setores = Store.getData().setores;

    setores.forEach(s => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.background = 'rgba(255,255,255,0.05)';
        li.style.padding = '0.5rem';
        li.style.borderRadius = '4px';
        li.style.fontSize = '0.85rem';

        li.innerHTML = `
            <span><i class="fa-solid fa-folder" style="color:var(--primary); margin-right:8px;"></i> ${s}</span>
            <button type="button" class="btn-icon" onclick="handleDeleteSetor('${s}')" style="color:var(--danger); background:transparent; border:none; cursor:pointer;" title="Excluir Setor">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        ul.appendChild(li);
    });
}

function openSetoresModal() {
    document.getElementById('new-setor-name').value = '';
    renderSetoresListPreview();
    document.getElementById('manage-setores-modal').classList.add('active');
}

function closeSetoresModal() {
    document.getElementById('manage-setores-modal').classList.remove('active');
}

function handleAddSetor() {
    const input = document.getElementById('new-setor-name');
    const val = input.value.trim();
    if (val) {
        Store.addSetor(val);
        input.value = '';
        renderSetoresListPreview();
        loadSetoresSelects(); // Update all selects globally
    }
}

async function handleDeleteSetor(nome) {
    if (confirm(`Atenção: Tem certeza que deseja excluir o setor '${nome}'? Isso não altera as rotinas e funcionários que já estão nomeados para ele, mas ele deixará de aparecer nas opções.`)) {
        await Store.deleteSetor(nome);
        renderSetoresListPreview();
        loadSetoresSelects();
    }
}

// ==========================================
// VIEW: Mensagens (Inbox)
// ==========================================

function updateMensagensBadges() {
    // For the UI we show the badge for the logged user
    if (!LOGGED_USER) return;
    const unreadCount = Store.getUnreadCount(LOGGED_USER.nome);

    const topbarBadge = document.getElementById('topbar-badge-msg');

    if (unreadCount > 0) {
        topbarBadge.style.display = 'inline-flex';
        topbarBadge.textContent = unreadCount;
    } else {
        topbarBadge.style.display = 'none';
    }
}

function renderMensagens() {
    const container = document.getElementById('mensagens-container');
    if (!LOGGED_USER) return;
    const msgs = Store.getMensagensPara(LOGGED_USER.nome);

    container.innerHTML = '';

    if (msgs.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding: 2rem; color: var(--text-muted);">Sua caixa de entrada está vazia.</p>`;
        updateMensagensBadges();
        return;
    }

    msgs.forEach(m => {
        const div = document.createElement('div');
        div.className = `glass-card fade-in ${m.lida ? '' : 'unread-msg'}`;
        div.style.marginBottom = '1rem';
        div.style.padding = '1.25rem';
        div.style.borderLeft = m.lida ? '3px solid transparent' : '3px solid var(--primary)';

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 0.5rem;">
                <h4 style="margin:0; font-size: 1rem;"><i class="fa-solid fa-user-circle" style="color:var(--text-muted);"></i> De: ${m.remetente}</h4>
                <small style="color:var(--text-muted);">${new Date(m.data).toLocaleString('pt-BR')}</small>
            </div>
            <p style="margin:0; color:var(--text-main); font-size: 0.95rem; line-height: 1.5;">${m.texto}</p>
            ${!m.lida ? `
                <div style="margin-top: 1rem; text-align:right;">
                    <button class="btn btn-small btn-secondary" onclick="markAsRead(${m.id})">Marcar como Lida</button>
                </div>
            ` : ''}
        `;

        container.appendChild(div);
    });

    updateMensagensBadges();
}

function markAsRead(id) {
    Store.markMensagemLida(id);
    renderMensagens();
}

function openNovaMensagemModal() {
    const select = document.getElementById('msg-destinatario');
    select.innerHTML = '';
    // Load all users except self
    Store.getData().funcionarios.forEach(f => {
        //if (f.nome !== LOGGED_USER) {  // Optional: let them message themselves for testing
        select.innerHTML += `<option value="${f.nome}">${f.nome} (${f.setor})</option>`;
        //}
    });

    document.getElementById('nova-mensagem-form').reset();
    document.getElementById('nova-mensagem-modal').classList.add('active');
}

function closeNovaMensagemModal() {
    document.getElementById('nova-mensagem-modal').classList.remove('active');
}

function handleSendMensagem(e) {
    e.preventDefault();
    const dest = document.getElementById('msg-destinatario').value;
    const texto = document.getElementById('msg-texto').value;

    Store.sendMensagem(LOGGED_USER.nome, dest, texto);

    alert(`Mensagem enviada para ${dest}!`);
    closeNovaMensagemModal();
    renderMensagens(); // in case they sent it to themselves
}

// ==========================================
// MODAL CONTROLLERS & CHECKLISTS
// ==========================================
let currentOpenTask = null;

function openTaskModal(taskId) {
    const task = Store.getExecucoesWithDetails('All').find(t => t.id === taskId);
    if (!task) return;
    currentOpenTask = task;

    // Fill Header contents
    document.getElementById('modal-rotina-name').textContent = task.rotina;
    document.getElementById('modal-cliente').textContent = task.clientName;

    const isLate = task.semaforo === 'red';
    const isToday = task.semaforo === 'yellow' && task.statusAuto === 'Hoje';
    const deadBadge = isLate ? 'atrasado' : (isToday ? 'hoje' : 'noprazo');

    document.getElementById('modal-prazo').innerHTML = `<span class="status-badge ${deadBadge}">${formatDate(task.diaPrazo)}</span>`;

    const statusHtml = task.feito
        ? '<span class="status-badge concluido" style="font-size: 1rem;"><i class="fa-solid fa-check"></i> Finalizado</span>'
        : '<span class="status-badge" style="background: rgba(255,255,255,0.1); border: 1px solid var(--border-glass); color: #fff; font-size: 1rem;"><i class="fa-solid fa-clock-rotate-left"></i> Pendente</span>';

    document.getElementById('modal-status').innerHTML = statusHtml;

    // Render Subitems
    renderChecklist();

    const overlay = document.getElementById('task-modal');
    overlay.classList.add('active');

    // Binding the main Toggle inside modal
    const mainToggle = document.getElementById('modal-done-toggle');
    const newToggle = mainToggle.cloneNode(true);
    mainToggle.parentNode.replaceChild(newToggle, mainToggle);

    newToggle.checked = task.feito;
    newToggle.addEventListener('change', (e) => {
        const checked = e.target.checked;
        Store.toggleExecucaoFeito(task.id, checked);

        // Refresh views natively
        renderChecklist();
        renderOperacional();
        renderDashboard();

        // Auto update header
        document.getElementById('modal-status').innerHTML = checked
            ? '<span class="status-badge concluido" style="font-size: 1rem;"><i class="fa-solid fa-check"></i> Finalizado</span>'
            : '<span class="status-badge" style="background: rgba(255,255,255,0.1); border: 1px solid var(--border-glass); color: #fff; font-size: 1rem;"><i class="fa-solid fa-clock-rotate-left"></i> Pendente</span>';
    });

    document.getElementById('modal-save').onclick = () => {
        closeModal();
    };
}

function renderChecklist() {
    if (!currentOpenTask) return;
    const task = Store.getExecucoesWithDetails().find(t => t.id === currentOpenTask.id);
    currentOpenTask = task;

    const container = document.getElementById('modal-checklist');
    container.innerHTML = '';

    let completed = 0;

    task.subitems.forEach((sub, index) => {
        if (sub.done) completed++;

        const div = document.createElement('div');
        div.className = 'checklist-item fade-in';
        div.style.animationDelay = `${index * 0.04}s`; // Micro-staggered entry

        div.innerHTML = `
            <input type="checkbox" class="custom-checkbox" id="chk_${sub.id}" ${sub.done ? 'checked' : ''}>
            <label for="chk_${sub.id}" class="item-text">${sub.texto || sub.desc || 'Item sem nome'}</label>
        `;

        // Single checklist item changed
        const chk = div.querySelector('input');
        chk.addEventListener('change', (e) => {
            Store.updateChecklist(task.id, sub.id, e.target.checked);

            // Re-render checklist and update underlaying lists
            renderChecklist();
            renderOperacional();
            renderDashboard();

            // Re-sync header if state changed due to all checks
            const refreshedTask = Store.getExecucoesWithDetails().find(t => t.id === currentOpenTask.id);
            document.getElementById('modal-status').innerHTML = refreshedTask.feito
                ? '<span class="status-badge concluido" style="font-size: 1rem;"><i class="fa-solid fa-check"></i> Finalizado</span>'
                : '<span class="status-badge" style="background: rgba(255,255,255,0.1); border: 1px solid var(--border-glass); color: #fff; font-size: 1rem;"><i class="fa-solid fa-clock-rotate-left"></i> Pendente</span>';
        });

        container.appendChild(div);
    });

    // Update Progress UI
    const total = task.subitems.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : (task.feito ? 100 : 0);

    document.getElementById('modal-progress').style.width = `${pct}%`;
    document.getElementById('modal-progress-text').textContent = `${pct}% Concluído`;

    // Sync Main Toggle visually
    const toggle = document.getElementById('modal-done-toggle');
    if (toggle) toggle.checked = task.feito;
}

function closeModal() {
    currentOpenTask = null;
    document.getElementById('task-modal').classList.remove('active');
}

// Helpers
function formatDate(dateStr) {
    if (!dateStr) return '--/--/----';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
}

// Easing Animation for Numbers
function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        // Exponential easeout
        const easeAmount = 1 - Math.pow(1 - progress, 4);
        obj.innerHTML = Math.floor(easeAmount * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            // Guarantee end state
            obj.innerHTML = end;
        }
    };
    window.requestAnimationFrame(step);
}

// ==========================================
// VIEW: Auditoria
// ==========================================
function renderAuditoria() {
    const tbody = document.querySelector('#auditoria-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const logs = [...Store.getData().logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 3rem;">Nenhum registro de auditoria encontrado.</td></tr>`;
        return;
    }

    logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.className = 'fade-in';

        // Format date BR
        const d = new Date(log.timestamp);
        const formatData = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR');

        tr.innerHTML = `
            <td style="white-space: nowrap;">${formatData}</td>
            <td><strong>${log.user_name}</strong></td>
            <td><span class="badge ${log.permissao === 'Gerente' ? 'danger' : 'success'}">${log.permissao}</span></td>
            <td>${log.action}</td>
            <td><span style="color: var(--text-muted); font-size: 0.9em;">${log.details || '-'}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function downloadAuditoriaCSV() {
    const logs = [...Store.getData().logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (logs.length === 0) {
        alert("Não há dados para exportar.");
        return;
    }

    // CSV Header
    let csvContent = "Data/Hora,Usuário,Permissão,Ação,Detalhes\n";

    logs.forEach(l => {
        const d = new Date(l.timestamp);
        const formatData = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');

        // Escape quotes and commas
        const escUser = (l.user_name || "").replace(/"/g, '""');
        const escPerm = (l.permissao || "").replace(/"/g, '""');
        const escAction = (l.action || "").replace(/"/g, '""');
        const escDetails = (l.details || "").replace(/"/g, '""');

        csvContent += `"${formatData}","${escUser}","${escPerm}","${escAction}","${escDetails}"\n`;
    });

    // Create Blob URL and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `auditoria_fiscalapp_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// VIEW: Backup e Segurança
// ==========================================
function renderBackupView() {
    const config = Store.getData().config;
    const toggle = document.getElementById('toggle-auto-backup');
    if (toggle) toggle.checked = config && config.autoBackup;

    const lastBackupText = document.getElementById('last-backup-text');
    if (lastBackupText) {
        if (config && config.lastBackupData) {
            const d = new Date(config.lastBackupData);
            lastBackupText.innerHTML = `Último backup automático: ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR')}`;
        } else {
            lastBackupText.innerHTML = `Último backup: Nunca`;
        }
    }
}

function downloadBackupFile() {
    const dataStr = JSON.stringify(Store.getData(), null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const d = new Date();
    const dateString = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `fiscalapp_backup_${dateString}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Store.registerLog("Backup de Segurança", "Realizou o download manual da base de dados");
    Store.saveToStorage();
}

function restoreBackupFile() {
    const fileInput = document.getElementById('backup-file-input');
    if (fileInput.files.length === 0) {
        alert("Por favor, selecione um arquivo JSON de backup.");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const parsedData = JSON.parse(e.target.result);
            if (!parsedData.clientes || !parsedData.execucoes || !parsedData.funcionarios) {
                alert("Arquivo de backup inválido ou corrompido.");
                return;
            }
            if (confirm("ATENÇÃO: Você está prestes a substituir toda a base de dados atual. Todas as alterações feitas após este backup serão PERDIDAS. Quer mesmo continuar?")) {
                Store.restoreDatabase(parsedData);
                alert("Banco de dados restaurado com sucesso! A página será recarregada.");
                window.location.reload();
            }
        } catch (error) {
            alert("Erro ao processar o arquivo. Certifique-se de que é um JSON válido.");
        }
    };
    reader.readAsText(file);
}

function checkAndRunAutoBackup() {
    const config = Store.getData().config;
    if (!config || !config.autoBackup) return;

    const now = new Date();
    const lastBackup = config.lastBackupData ? new Date(config.lastBackupData) : null;

    // Se nunca fez backup ou se passaram mais de 7 dias
    if (!lastBackup || (now - lastBackup) > (7 * 24 * 60 * 60 * 1000)) {
        console.log("Executando Auto-Backup semanal...");
        const dataStr = JSON.stringify(Store.getData(), null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const dateString = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;

        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `fiscalapp_autobackup_${dateString}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Store.updateConfig('lastBackupData', now.toISOString());
        Store.registerLog("Backup Automático", "O sistema realizou o download automático agendado.");
        Store.saveToStorage();
        renderBackupView();
    }
}

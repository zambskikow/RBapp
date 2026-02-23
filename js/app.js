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

        const auth = Store.getAuthBySession(storedSession);

        if (auth) {

            LOGGED_USER = auth;

            document.getElementById('login-overlay').style.display = 'none';

            document.getElementById('main-app-container').style.display = 'flex';



            // Apply User info to sidebar

            document.querySelector('.sidebar .user-name').textContent = auth.nome;

            document.querySelector('.sidebar .user-role').textContent = auth.permissao;



            // Trigger renders since we now have contextual access

            loadSetoresSelects();



            const savedView = localStorage.getItem('fiscalapp_current_view') || 'dashboard';



            // Apply permissions to Navbar BEFORE clicking!

            applyUserPermissions(auth);



            // Render everything invisibly first

            renderDashboard();

            renderOperacional();

            renderClientes();

            renderRotinas();

            renderMensagens();

            renderAuditoria();

            updateMensagensBadges();



            // Set the active view dynamically based on previous state

            setTimeout(() => {

                const navLink = document.querySelector(`.nav-item[data-view="${savedView}"]`);

                if (navLink) navLink.click();

            }, 50);

        }

    }



    // Setup everything else but don't render until logged in

    setupNavigation();



    // 2. Set Format Dates

    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });



    // Populate Competencia Filter (Both Dashboard and Operacional)

    const compFilter = document.getElementById('competencia-filter');

    const dashCompFilter = document.getElementById('dash-competencia-filter');

    const meuCompFilter = document.getElementById('meu-competencia-filter');



    compFilter.innerHTML = '';

    dashCompFilter.innerHTML = '';

    meuCompFilter.innerHTML = '';



    Store.getData().meses.forEach(m => {

        const option = `<option value="${m.id}">${m.mes}</option>`;

        compFilter.innerHTML += option;

        dashCompFilter.innerHTML += option;

        meuCompFilter.innerHTML += option;

    });



    // Set default values based on the store's active month

    const activeMonth = Store.getData().meses.find(m => m.ativo) || Store.getData().meses[0];

    if (activeMonth) {

        currentCompetencia = activeMonth.id;

        compFilter.value = currentCompetencia;

        dashCompFilter.value = currentCompetencia;

        meuCompFilter.value = currentCompetencia;

    } else {

        currentCompetencia = '2026-02'; // Fallback

    }



    // 2.5 Toggle Sidebar

    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');

    const sidebar = document.querySelector('.sidebar');

    if (btnToggleSidebar && sidebar) {

        btnToggleSidebar.addEventListener('click', () => {

            sidebar.classList.toggle('collapsed');

            if (window.innerWidth <= 992) {

                sidebar.classList.toggle('mobile-open');

            }

        });

    }



    // Populate the Dashboard Selects

    populateDashboardSelects();



    // 3. User & Competencia Filter global events

    document.getElementById('user-filter').addEventListener('change', (e) => {

        currentOperacionalUser = e.target.value;

        renderOperacional();

    });



    compFilter.addEventListener('change', (e) => {
        currentCompetencia = e.target.value;
        dashCompFilter.value = currentCompetencia;
        meuCompFilter.value = currentCompetencia;
        renderOperacional();
        const dashboardView = document.getElementById('view-dashboard');
        if (dashboardView && dashboardView.style.display === 'block') renderDashboard();
        const meuDesempenhoView = document.getElementById('view-meu-desempenho');
        if (meuDesempenhoView && meuDesempenhoView.style.display === 'block') renderMeuDesempenho();
    });

    // Operational Search Listener
    const opSearch = document.getElementById('operacional-search');
    if (opSearch) {
        opSearch.addEventListener('input', () => {
            renderOperacional();
        });
    }



    dashCompFilter.addEventListener('change', (e) => {

        currentCompetencia = e.target.value;

        compFilter.value = currentCompetencia;

        meuCompFilter.value = currentCompetencia;

        renderDashboard();

        renderOperacional();

        renderMeuDesempenho();

    });



    meuCompFilter.addEventListener('change', (e) => {

        currentCompetencia = e.target.value;

        compFilter.value = currentCompetencia;

        dashCompFilter.value = currentCompetencia;

        renderMeuDesempenho();

        renderOperacional();

        renderDashboard();

    });



    document.getElementById('dash-user-filter').addEventListener('change', renderDashboard);

    document.getElementById('dash-client-filter').addEventListener('change', renderDashboard);



    // 4. Modals Events Setup

    document.getElementById('close-modal').addEventListener('click', closeModal);

    document.getElementById('modal-cancel').addEventListener('click', closeModal);



    // 6. Client Detail Panel Events
    const btnAddClient = document.getElementById('btn-add-client');
    if (btnAddClient) btnAddClient.addEventListener('click', () => openClientDetail());

    const btnBackClients = document.getElementById('btn-back-clients-list');
    if (btnBackClients) btnBackClients.addEventListener('click', closeClientDetail);

    document.getElementById('add-client-form').addEventListener('submit', handleAddClient);

    // Setup Client Modal Tabs
    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetTab = document.getElementById(tabId);
            if (targetTab) targetTab.classList.add('active');
        });
    });



    // 7. Equipe Modal Events

    document.getElementById('btn-add-equipe').addEventListener('click', openEquipeModal);

    document.getElementById('close-equipe-modal').addEventListener('click', closeEquipeModal);

    document.getElementById('equipe-modal-cancel').addEventListener('click', closeEquipeModal);
    document.getElementById('add-equipe-form').addEventListener('submit', handleAddFuncionario);

    // 8. Rotinas Base View Events
    document.getElementById('btn-add-rotina').addEventListener('click', () => openRotinaModal());
    const btnBackRotinas = document.getElementById('btn-back-rotinas-list');
    if (btnBackRotinas) btnBackRotinas.addEventListener('click', closeRotinaModal);
    document.getElementById('add-rotina-form').addEventListener('submit', handleSaveRotina);
    document.getElementById('btn-add-checklist-item').addEventListener('click', handleAddChecklistItem);

    // Rotinas Clients Search
    const btnToggleClientSearch = document.getElementById('btn-toggle-client-search');
    const inputClientSearch = document.getElementById('filter-clientes-rotina');
    if (btnToggleClientSearch && inputClientSearch) {
        btnToggleClientSearch.addEventListener('click', () => {
            const isClosed = inputClientSearch.style.pointerEvents === 'none';
            if (isClosed) {
                inputClientSearch.style.width = '200px';
                inputClientSearch.style.opacity = '1';
                inputClientSearch.style.padding = '0 0.8rem';
                inputClientSearch.style.pointerEvents = 'auto';
                inputClientSearch.focus();
            } else {
                inputClientSearch.style.width = '0';
                inputClientSearch.style.opacity = '0';
                inputClientSearch.style.padding = '0';
                inputClientSearch.style.pointerEvents = 'none';
                inputClientSearch.value = '';
                inputClientSearch.dispatchEvent(new Event('input'));
            }
        });

        inputClientSearch.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const labels = document.querySelectorAll('#clientes-checkbox-grid label');
            labels.forEach(lbl => {
                if (lbl.textContent.toLowerCase().includes(val)) {
                    lbl.style.display = 'flex';
                } else {
                    lbl.style.display = 'none';
                }
            });
        });
    }

    const notificationBtn = document.getElementById('btn-notification');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', () => {
            // Animação
            notificationBtn.classList.add('bell-animate');
            setTimeout(() => notificationBtn.classList.remove('bell-animate'), 500);

            // Redireciona para mensagens
            const msgTab = document.querySelector('.nav-item[data-view="mensagens"]');
            if (msgTab) msgTab.click();
        });
    }

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

    // 13. Admin Panel (RBAC) Events
    const btnAddCargo = document.getElementById('btn-add-cargo');
    if (btnAddCargo) btnAddCargo.addEventListener('click', () => openCargoModal());
    const closeCargo1 = document.getElementById('close-cargo-modal');
    if (closeCargo1) closeCargo1.addEventListener('click', closeCargoModal);
    const closeCargo2 = document.getElementById('cargo-modal-cancel');
    if (closeCargo2) closeCargo2.addEventListener('click', closeCargoModal);
    const cargoForm = document.getElementById('admin-cargo-form');
    if (cargoForm) cargoForm.addEventListener('submit', handleSaveCargo);
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
            renderRotinas();
            renderMensagens();
            renderAuditoria();
            renderBackupView();
            updateMensagensBadges();

            // Execute Dynamic Authorization on Navbar (RBAC)
            applyUserPermissions(auth);

            // Re-route user to their first available view if they don't have access to Dashboard
            if (!auth.telas_permitidas.includes('dashboard') && auth.telas_permitidas.length > 0) {
                const firstView = auth.telas_permitidas[0];
                const firstNav = document.querySelector(`.nav-item[data-view="${firstView}"]`);
                if (firstNav) firstNav.click();
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
    Store.registerLog("Acesso", `${LOGGED_USER ? LOGGED_USER.nome : 'Usuário'} saiu do sistema.`);
    LOGGED_USER = null;
    localStorage.removeItem('fiscalapp_session');

    // Smooth transition
    document.getElementById('main-app-container').classList.add('fade-out');
    setTimeout(() => {
        window.location.reload();
    }, 300);
}

function applyUserPermissions(auth) {
    const permitidas = auth.telas_permitidas || [];

    // Loop through all navigation links and show/hide based on array
    document.querySelectorAll('.nav-item').forEach(navItem => {
        const view = navItem.getAttribute('data-view');
        if (!view) return; // Skip non-view links like logout

        if (permitidas.includes(view)) {
            navItem.style.display = 'flex'; // our UI uses flex for all nav-items
        } else {
            navItem.style.display = 'none';
        }
    });

    // Hide/Show specific inner buttons based on permissions
    const btnSetores = document.getElementById('btn-manage-setores');
    if (btnSetores) {
        if (auth.permissao === 'Gerente' || permitidas.includes('settings')) {
            btnSetores.style.display = 'inline-block';
        } else {
            btnSetores.style.display = 'none';
        }
    }

    const adminNavDivider = document.getElementById('admin-nav-divider');
    if (adminNavDivider) {
        if (auth.permissao === 'Gerente' || permitidas.includes('settings')) {
            adminNavDivider.style.display = 'block';
        } else {
            adminNavDivider.style.display = 'none';
        }
    }

    // Dashboard Access Control
    const dashUserFilter = document.getElementById('dash-user-filter');
    const isAdmin = ['Gerente', 'Adm', 'Admin', 'Supervisor'].includes(auth.permissao);

    if (dashUserFilter) {
        dashUserFilter.style.display = isAdmin ? 'block' : 'none';
        if (!isAdmin) dashUserFilter.value = auth.nome;
    }

    // Painel Operacional Access Control
    const userFilter = document.getElementById('user-filter');
    if (userFilter) {
        if (isAdmin) {
            userFilter.style.display = 'block';
            currentOperacionalUser = 'All';
            userFilter.value = 'All';
        } else {
            userFilter.style.display = 'none';
            currentOperacionalUser = auth.nome;
        }
    }
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

            // Disparar animação sutil no ícone
            const icon = link.querySelector('i');
            if (icon) {
                icon.classList.add('icon-animate');
                // Remove a classe após a animação (0.3s) para permitir repetir
                setTimeout(() => icon.classList.remove('icon-animate'), 300);
            }

            // Switch views globally
            const targetView = link.getAttribute('data-view');
            localStorage.setItem('fiscalapp_current_view', targetView);
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
                if (targetView === 'meu-desempenho') renderMeuDesempenho();
                if (targetView === 'operacional') renderOperacional();
                if (targetView === 'clientes') renderClientes();
                if (targetView === 'rotinas') renderRotinas();
                if (targetView === 'mensagens') renderMensagens();
                if (targetView === 'settings') {
                    // Trigger the first tab by default or re-render active
                    initSettingsTabs();
                    const activeTab = document.querySelector('.settings-tab-btn.active');
                    if (activeTab) activeTab.click();
                }
            }
        });
    });

    document.getElementById('btn-logout').addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
}

function populateDashboardSelects() {
    const dashUserFilter = document.getElementById('dash-user-filter');
    const dashClientFilter = document.getElementById('dash-client-filter');
    const userFilter = document.getElementById('user-filter');

    // Users
    if (dashUserFilter) {
        dashUserFilter.innerHTML = '<option value="All">Todos Analistas</option>';
        Store.getData().funcionarios.forEach(f => {
            dashUserFilter.innerHTML += `<option value="${f.nome}">${f.nome} - ${f.setor}</option>`;
        });
    }

    if (userFilter) {
        userFilter.innerHTML = '<option value="All">Todos os Responsáveis</option>';
        Store.getData().funcionarios.forEach(f => {
            userFilter.innerHTML += `<option value="${f.nome}">${f.nome}</option>`;
        });
    }

    // Clients
    if (dashClientFilter) {
        dashClientFilter.innerHTML = '<option value="All">Todos Clientes</option>';
        Store.getData().clientes.forEach(c => {
            dashClientFilter.innerHTML += `<option value="${c.id}">${c.razaoSocial}</option>`;
        });
    }
}

// ==========================================
// VIEW: Dashboard Manager
// ==========================================
function renderDashboard() {
    const dashUser = document.getElementById('dash-user-filter').value;
    const dashClient = document.getElementById('dash-client-filter').value;

    let execsAll = Store.getExecucoesWithDetails(dashUser);

    // Filter by Competencia
    if (currentCompetencia) {
        execsAll = execsAll.filter(e => e.competencia === currentCompetencia);
    }

    // Filter by Client
    if (dashClient !== 'All') {
        const clientId = parseInt(dashClient);
        execsAll = execsAll.filter(e => e.clienteId === clientId);
    }

    // Recalculate KPIs based on filtered array
    const kpis = {
        total: execsAll.length,
        concluidos: execsAll.filter(e => e.feito).length,
        emAndamento: execsAll.filter(e => !e.feito).length,
        vencendo: execsAll.filter(e => !e.feito && e.semaforo === 'yellow').length,
        atrasados: execsAll.filter(e => !e.feito && e.semaforo === 'red').length
    };

    // Counters Animation
    animateValue('kpi-total', parseInt(document.getElementById('kpi-total').innerText) || 0, kpis.total, 800);
    animateValue('kpi-done', parseInt(document.getElementById('kpi-done').innerText) || 0, kpis.concluidos, 800);
    animateValue('kpi-andamento', parseInt(document.getElementById('kpi-andamento').innerText) || 0, kpis.emAndamento, 800);
    animateValue('kpi-warning', parseInt(document.getElementById('kpi-warning').innerText) || 0, kpis.vencendo, 800);
    animateValue('kpi-late', parseInt(document.getElementById('kpi-late').innerText) || 0, kpis.atrasados, 800);

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
    let execsTeam = Store.getExecucoesWithDetails('All');
    if (currentCompetencia) {
        execsTeam = execsTeam.filter(e => e.competencia === currentCompetencia);
    }
    const teamStats = {};
    execsTeam.forEach(ex => {
        const reps = (ex.responsavel || "Automático").split(",").map(r => r.trim());
        reps.forEach(resp => {
            if (!teamStats[resp]) {
                teamStats[resp] = { total: 0, concluidas: 0, hoje: 0, atrasadas: 0 };
            }
            teamStats[resp].total++;
            if (ex.feito) teamStats[resp].concluidas++;
            else if (ex.semaforo === 'red') teamStats[resp].atrasadas++;
            else if (ex.semaforo === 'yellow') teamStats[resp].hoje++;
        });
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
// VIEW: Meu Desempenho
// ==========================================
let currentMeuSemaforoChart = null;

function renderMeuDesempenho() {
    if (!LOGGED_USER) return;

    let myExecs = Store.getExecucoesWithDetails(LOGGED_USER.nome);
    if (currentCompetencia) {
        myExecs = myExecs.filter(e => e.competencia === currentCompetencia);
    }

    const kpis = {
        total: myExecs.length,
        concluidas: myExecs.filter(e => e.feito).length,
        vencendo: myExecs.filter(e => !e.feito && e.semaforo === 'yellow').length,
        atrasadas: myExecs.filter(e => !e.feito && e.semaforo === 'red').length
    };

    animateValue('kpi-meu-total', parseInt(document.getElementById('kpi-meu-total').innerText) || 0, kpis.total, 800);
    animateValue('kpi-meu-done', parseInt(document.getElementById('kpi-meu-done').innerText) || 0, kpis.concluidas, 800);
    animateValue('kpi-meu-warning', parseInt(document.getElementById('kpi-meu-warning').innerText) || 0, kpis.vencendo, 800);
    animateValue('kpi-meu-late', parseInt(document.getElementById('kpi-meu-late').innerText) || 0, kpis.atrasadas, 800);

    // Chart
    const ctx = document.getElementById('meuSemaforoChart');
    if (currentMeuSemaforoChart) {
        currentMeuSemaforoChart.destroy();
    }

    const andamento = kpis.total - kpis.concluidas - kpis.vencendo - kpis.atrasadas;
    const data = [kpis.concluidas, andamento > 0 ? andamento : 0, kpis.vencendo, kpis.atrasadas];
    if (data.every(d => d === 0)) data[0] = 0.1;

    currentMeuSemaforoChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Concluída', 'No Prazo', 'Vencendo Hoje', 'Atrasada'],
            datasets: [{
                data: data,
                backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'],
                borderWidth: 0,
                hoverOffset: 6
            }]
        },
        options: {
            cutout: '70%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#F8FAFC', padding: 15, font: { family: 'Inter', size: 12 } } }
            }
        }
    });

    // Minhas Próximas Entregas (Prioridade)
    const pending = myExecs.filter(e => !e.feito).sort((a, b) => new Date(a.diaPrazo) - new Date(b.diaPrazo)).slice(0, 10);
    const tbody = document.querySelector('#minhas-proximas-table tbody');
    tbody.innerHTML = '';

    if (pending.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--success);"><i class="fa-solid fa-hands-clapping fa-2x mb-3"></i><br/>Todas as entregas em dia!</td></tr>`;
    } else {
        pending.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${p.clientName}</strong></td>
                <td><span class="resp-tag">${p.rotina}</span></td>
                <td>${formatDate(p.diaPrazo)}</td>
                <td><span class="status-badge ${p.semaforo === 'red' ? 'atrasado' : (p.semaforo === 'yellow' ? 'vencendo' : 'noprazo')}">${p.statusAuto}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }
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

    // Search Filter
    const searchVal = document.getElementById('operacional-search')?.value.toLowerCase() || '';
    if (searchVal) {
        tasks = tasks.filter(t =>
            t.rotina.toLowerCase().includes(searchVal) ||
            t.clientName.toLowerCase().includes(searchVal)
        );
    }

    // Update Operational KPIs
    const opTotal = tasks.length;
    const opDone = tasks.filter(t => t.feito).length;
    const opLate = tasks.filter(t => !t.feito && t.statusAuto.includes('Atrasado')).length;
    const opProgress = tasks.filter(t => !t.feito && t.statusAuto.includes('Andamento')).length;

    animateValue('kpi-operacional-total', 0, opTotal, 500);
    animateValue('kpi-operacional-done', 0, opDone, 500);
    animateValue('kpi-operacional-andamento', 0, opProgress, 500);
    animateValue('kpi-operacional-late', 0, opLate, 500);

    const container = document.getElementById('operacional-groups-container');
    container.innerHTML = '';

    if (tasks.length === 0) {
        container.innerHTML = `<div class="glass-card" style="text-align:center; padding: 3rem; color: var(--text-muted);">
            <i class="fa-solid fa-magnifying-glass fa-2x" style="margin-bottom:1rem; opacity:0.5;"></i><br>
            Nenhuma tarefa encontrada com os filtros atuais.
        </div>`;
        return;
    }

    // Grouping and Rendering...
    const grouped = {};
    Store.getData().rotinasBase.forEach(rb => {
        grouped[rb.nome] = [];
    });

    tasks.forEach(t => {
        if (!grouped[t.rotina]) grouped[t.rotina] = [];
        grouped[t.rotina].push(t);
    });

    Object.keys(grouped).forEach(rotinaName => {
        const groupTasks = grouped[rotinaName];
        if (groupTasks.length === 0 && searchVal) return; // Hide empty groups when searching

        groupTasks.sort((a, b) => {
            if (a.feito && !b.feito) return 1;
            if (!a.feito && b.feito) return -1;
            return new Date(a.diaPrazo) - new Date(b.diaPrazo);
        });

        const groupDiv = document.createElement('div');
        groupDiv.className = 'routine-group fade-in';
        const doneCount = groupTasks.filter(t => t.feito).length;

        let tableHtml = `
            <div class="routine-group-header">
                <h2><i class="fa-solid fa-layer-group"></i> ${rotinaName}</h2>
                <span class="routine-group-badge">${doneCount}/${groupTasks.length} Entregues</span>
            </div>
            <div class="table-responsive">
                <table class="data-table selectable-rows">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Sinal</th>
                            <th>Cliente</th>
                            <th>Prazo</th>
                            <th>Responsável</th>
                            <th>Status Auto</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (groupTasks.length === 0) {
            tableHtml += `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-style: italic;">
                        Sem pendências.
                    </td>
                </tr>
            `;
        } else {
            groupTasks.forEach(t => {
                let badgeClass = 'noprazo';
                if (t.statusAuto.includes('Atrasado')) badgeClass = 'atrasado';
                else if (t.statusAuto.includes('Hoje')) badgeClass = 'hoje';
                else if (t.statusAuto === 'Concluído') badgeClass = 'concluido';
                else if (t.statusAuto.includes('Em Andamento')) badgeClass = 'andamento';
                else if (t.statusAuto.includes('Vence')) badgeClass = 'vencendo';

                let driveBtnHtml = t.driveLink && t.driveLink !== "#" && t.driveLink.trim() !== ""
                    ? `<a href="${t.driveLink}" target="_blank" class="btn btn-small btn-secondary" style="margin-right: 4px; padding: 0.25rem 0.5rem; font-size: 0.8rem;" title="Google Drive"><i class="fa-brands fa-google-drive"></i></a>`
                    : '';

                tableHtml += `
                    <tr data-id="${t.id}" style="cursor: pointer;">
                        <td style="text-align: center;">
                            ${t.feito ? '<i class="fa-solid fa-circle-check fa-lg" style="color:var(--success)"></i>' : '<i class="fa-regular fa-circle fa-lg" style="color:var(--text-muted)"></i>'}
                        </td>
                        <td><span class="orb ${t.semaforo}"></span></td>
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
        }

        tableHtml += `</tbody></table></div>`;
        groupDiv.innerHTML = tableHtml;
        container.appendChild(groupDiv);
    });

    document.querySelectorAll('#operacional-groups-container tr[data-id]').forEach(tr => {
        const taskId = parseInt(tr.getAttribute('data-id'));
        tr.addEventListener('click', () => openTaskModal(taskId));
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
    animateValue('kpi-presumido', 0, stats.presumido, 600);
    animateValue('kpi-real', 0, stats.real, 600);
    animateValue('kpi-mei', 0, stats.mei, 600);

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
        tr.className = 'fade-in client-row-clickable';
        tr.dataset.id = c.id;

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
                <button class="btn btn-small btn-secondary btn-delete-single-client" data-id="${c.id}" style="color: var(--danger); background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                    <i class="fa-solid fa-trash"></i> Excluir
                </button>
            </td>
        `;

        // Row click opens detail panel
        tr.addEventListener('click', (e) => {
            // Don't open if clicked on checkbox, btn, or icons inside buttons
            if (e.target.closest('.group-actions') || e.target.closest('.client-checkbox') || e.target.closest('button')) return;
            openClientDetail(c.id);
        });

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

// Funções Utilitárias Globais
function toggleListVisibility(gridId, iconId) {
    const grid = document.getElementById(gridId);
    const icon = document.getElementById(iconId);

    if (grid && icon) {
        const isHidden = grid.style.display === 'none';
        grid.style.display = isHidden ? 'grid' : 'none';

        // Rotacionar ícone
        if (isHidden) {
            icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
        } else {
            icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
        }
    }
}

function setupClientCheckboxes() {
    const selectAllCb = document.getElementById('select-all-clients');
    const checkboxes = document.querySelectorAll('.client-checkbox');
    let deleteBtn = document.getElementById('btn-delete-clients-header');
    const badge = document.getElementById('delete-clients-header-count');

    // Remove old listeners by cloning
    if (deleteBtn) {
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        deleteBtn = newDeleteBtn; // Update reference to the one in DOM
    }

    const updateDeleteBtnVisibility = () => {
        const checkedCount = document.querySelectorAll('.client-checkbox:checked').length;
        if (deleteBtn) {
            if (checkedCount >= 2) {
                deleteBtn.style.display = 'inline-flex';
                const badgeInDom = deleteBtn.querySelector('#delete-clients-header-count');
                if (badgeInDom) badgeInDom.textContent = checkedCount;
            } else {
                deleteBtn.style.display = 'none';
            }
        }

        if (selectAllCb) {
            if (checkedCount === 0) selectAllCb.checked = false;
            else if (checkedCount === checkboxes.length) selectAllCb.checked = true;
            else selectAllCb.checked = false;
        }
    };

    if (selectAllCb) {
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

    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const selectedChecks = Array.from(document.querySelectorAll('.client-checkbox:checked'));
            const selectedIds = selectedChecks.map(cb => parseInt(cb.value));
            if (selectedIds.length === 0) return;

            if (confirm(`Atenção: Deseja realmente excluir os ${selectedIds.length} clientes selecionados?`)) {
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

                // Animation phase
                selectedChecks.forEach(cb => {
                    const row = cb.closest('tr');
                    if (row) row.classList.add('row-fade-out');
                });

                // Wait for animation
                await new Promise(r => setTimeout(r, 500));

                for (let id of selectedIds) {
                    await Store.deleteClient(id);
                }

                renderClientes();
                renderOperacional();
                renderDashboard();
                showFeedbackToast(`${selectedIds.length} clientes excluídos com sucesso.`, 'success');
            }
        });
    }
}
function openClientDetail(id = null) {
    document.getElementById('add-client-form').reset();

    // Toggle panels
    document.getElementById('clientes-list-container').style.display = 'none';
    const detailPanel = document.getElementById('clientes-detail-panel');
    detailPanel.style.display = 'block';
    detailPanel.classList.add('active');

    // Reset tabs
    document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="tab-geral"]').classList.add('active');
    document.getElementById('tab-geral').classList.add('active');

    const title = document.getElementById('client-panel-title');
    const headerName = document.getElementById('client-header-name');
    const submitBtn = document.getElementById('client-modal-submit-btn');

    // Load Rotinas for checklist
    const rotinasGrid = document.getElementById('rotinas-checkbox-grid');
    if (rotinasGrid) {
        rotinasGrid.innerHTML = '';
        Store.getData().rotinasBase.forEach(r => {
            rotinasGrid.innerHTML += `
                <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-main); cursor:pointer;">
                    <input type="checkbox" name="rotina-sel" id="rotina-cb-${r.id}" value="${r.id}" class="custom-checkbox client-rotina-checkbox">
                    ${r.nome}
                </label>
            `;
        });
    }

    if (id) {
        const cliente = Store.getData().clientes.find(c => c.id === id);
        if (cliente) {
            title.innerHTML = 'Ficha do Cliente';
            headerName.textContent = cliente.razaoSocial;
            submitBtn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar Alterações';

            document.getElementById('client-id').value = cliente.id;

            // Geral
            document.getElementById('client-codigo').value = cliente.codigo || '';
            document.getElementById('client-razao').value = cliente.razaoSocial || '';
            document.getElementById('client-cnpj').value = cliente.cnpj || '';
            document.getElementById('client-regime').value = cliente.regime || 'Simples Nacional';
            document.getElementById('client-ie').value = cliente.ie || '';
            document.getElementById('client-im').value = cliente.im || '';
            document.getElementById('client-abertura').value = cliente.dataAbertura || '';
            document.getElementById('client-tipo').value = cliente.tipoEmpresa || '';

            // Contato
            document.getElementById('client-contato-nome').value = cliente.contatoNome || '';
            document.getElementById('client-email').value = cliente.email || '';
            document.getElementById('client-telefone').value = cliente.telefone || '';
            document.getElementById('client-resp-fiscal').value = cliente.responsavelFiscal || '';

            // Acessos
            document.getElementById('login-ecac').value = cliente.loginEcac || '';
            document.getElementById('senha-ecac').value = cliente.senhaEcac || '';
            document.getElementById('login-sefaz').value = cliente.loginSefaz || '';
            document.getElementById('senha-sefaz').value = cliente.senhaSefaz || '';
            document.getElementById('login-pref').value = cliente.loginPref || '';
            document.getElementById('senha-pref').value = cliente.senhaPref || '';
            document.getElementById('login-dominio').value = cliente.loginDominio || '';
            document.getElementById('senha-dominio').value = cliente.senhaDominio || '';
            document.getElementById('client-outros-acessos').value = cliente.outrosAcessos || '';

            // Operacional
            document.getElementById('client-drive').value = cliente.driveLink || '';
            if (cliente.rotinasSelecionadas) {
                cliente.rotinasSelecionadas.forEach(rId => {
                    const cb = document.getElementById(`rotina-cb-${rId}`);
                    if (cb) cb.checked = true;
                });
            }
        }
    } else {
        title.innerHTML = 'Novo Cliente';
        headerName.textContent = 'um novo cliente';
        submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Cadastrar Novo Cliente';
        document.getElementById('client-id').value = '';
    }
}

function closeClientDetail() {
    document.getElementById('clientes-detail-panel').style.display = 'none';
    document.getElementById('clientes-detail-panel').classList.remove('active');
    document.getElementById('clientes-list-container').style.display = 'block';
}

async function handleAddClient(e) {
    e.preventDefault();

    const id = document.getElementById('client-id').value;

    const clientData = {
        codigo: document.getElementById('client-codigo').value,
        razaoSocial: document.getElementById('client-razao').value,
        cnpj: document.getElementById('client-cnpj').value,
        regime: document.getElementById('client-regime').value,
        ie: document.getElementById('client-ie').value,
        im: document.getElementById('client-im').value,
        dataAbertura: document.getElementById('client-abertura').value,
        tipoEmpresa: document.getElementById('client-tipo').value,
        contatoNome: document.getElementById('client-contato-nome').value,
        email: document.getElementById('client-email').value,
        telefone: document.getElementById('client-telefone').value,
        responsavelFiscal: document.getElementById('client-resp-fiscal').value,
        loginEcac: document.getElementById('login-ecac').value,
        senhaEcac: document.getElementById('senha-ecac').value,
        loginSefaz: document.getElementById('login-sefaz').value,
        senhaSefaz: document.getElementById('senha-sefaz').value,
        loginPref: document.getElementById('login-pref').value,
        senhaPref: document.getElementById('senha-pref').value,
        loginDominio: document.getElementById('login-dominio').value,
        senhaDominio: document.getElementById('senha-dominio').value,
        outrosAcessos: document.getElementById('client-outros-acessos').value,
        driveLink: document.getElementById('client-drive').value,
        rotinasSelecionadasIds: Array.from(document.querySelectorAll('.client-rotina-checkbox:checked')).map(cb => parseInt(cb.value))
    };

    if (id) {
        await Store.editClient(id, clientData);
    } else {
        await Store.addClient(clientData);
    }

    renderClientes();
    renderOperacional();
    renderDashboard();
    closeClientDetail();
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

    const ativos = func.filter(f => f.ativo !== false).length;
    const inativos = func.length - ativos;

    animateValue('kpi-total-equipe', 0, func.length, 600);
    animateValue('kpi-equipe-ativos', 0, ativos, 600);
    animateValue('kpi-equipe-inativos', 0, inativos, 600);

    if (func.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 3rem;">Nenhum funcionário cadastrado.</td></tr>`;
        return;
    }

    func.forEach(f => {
        const tr = document.createElement('tr');
        tr.className = 'fade-in';

        const badgeColor = f.permissao === 'Gerente' ? 'var(--primary)' : 'var(--success)';
        const isAtivo = f.ativo !== false; // default true

        let statusHtml = '';
        if (LOGGED_USER && LOGGED_USER.permissao.toLowerCase() === 'gerente') {
            statusHtml = `
                <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: flex-start;">
                    <label class="custom-toggle" style="margin: 0;">
                        <input type="checkbox" ${isAtivo ? 'checked' : ''} onchange="toggleFuncionarioStatus('${f.id}')">
                        <span class="toggle-slider"></span>
                    </label>
                    <span style="font-size: 0.8rem; font-weight: 500; color: ${isAtivo ? 'var(--success)' : 'var(--danger)'};">
                        ${isAtivo ? 'Ativo' : 'Inativo'}
                    </span>
                </div>
            `;
        } else {
            statusHtml = isAtivo
                ? `<span class="status-badge noprazo"><i class="fa-solid fa-check-circle"></i> Ativo</span>`
                : `<span class="status-badge atrasado"><i class="fa-solid fa-xmark-circle"></i> Inativo</span>`;
        }

        tr.innerHTML = `
            <td><strong>#${f.id.toString().padStart(3, '0')}</strong></td>
            <td>${f.nome}</td>
            <td>${f.setor}</td>
            <td><span class="resp-tag" style="background: rgba(255,255,255,0.1); border-color: ${badgeColor}; color: ${badgeColor}">${f.permissao}</span></td>
            <td>${statusHtml}</td>
            <td>
                <button class="btn btn-small btn-secondary" onclick="openEditEquipeModal('${f.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                    <i class="fa-solid fa-pen"></i> Editar
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function openEquipeModal() {
    document.getElementById('add-equipe-form').reset();
    document.getElementById('equipe-id').value = '';
    document.getElementById('modal-equipe-title').innerHTML = '<i class="fa-solid fa-user-shield highlight-text"></i> Novo Funcionário';
    document.getElementById('equipe-status-container').style.display = 'none';
    document.getElementById('add-equipe-modal').classList.add('active');
}

function openEditEquipeModal(id) {
    const f = Store.getData().funcionarios.find(x => x.id === id);
    if (!f) return;

    document.getElementById('add-equipe-form').reset();
    document.getElementById('equipe-id').value = f.id;
    document.getElementById('modal-equipe-title').innerHTML = '<i class="fa-solid fa-user-shield highlight-text"></i> Editar Funcionário';

    document.getElementById('equipe-nome').value = f.nome;
    document.getElementById('equipe-setor').value = f.setor;
    document.getElementById('equipe-permissao').value = f.permissao;
    document.getElementById('equipe-senha').value = f.senha;

    document.getElementById('equipe-ativo').checked = f.ativo !== false;
    document.getElementById('equipe-status-container').style.display = 'block';

    document.getElementById('add-equipe-modal').classList.add('active');
}

function closeEquipeModal() {
    document.getElementById('add-equipe-modal').classList.remove('active');
}

async function handleAddFuncionario(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('equipe-id').value;
    const nome = document.getElementById('equipe-nome').value;
    const setor = document.getElementById('equipe-setor').value;
    const permissao = document.getElementById('equipe-permissao').value;
    const senha = document.getElementById('equipe-senha').value;

    // Status is only used if editing, or defaults to true for new ones
    const isEditing = !!id;
    const ativo = isEditing ? document.getElementById('equipe-ativo').checked : true;

    if (isEditing) {
        await Store.editFuncionario(id, nome, setor, permissao, senha, ativo);
    } else {
        await Store.addFuncionario(nome, setor, permissao, senha, ativo);
    }

    closeEquipeModal();
    renderEquipe();
    populateDashboardSelects();
}

async function toggleFuncionarioStatus(id) {
    const stringId = id.toString();
    const f = Store.getData().funcionarios.find(x => x.id.toString() === stringId);
    if (!f) return;

    const novoStatus = f.ativo === false ? true : false;

    // Optimistic UI update
    f.ativo = novoStatus;
    renderEquipe();

    // Push backend change
    await Store.editFuncionario(f.id, f.nome, f.setor, f.permissao, f.senha, novoStatus);
}

// ==========================================
// VIEW: Gestão de Rotinas Base
// ==========================================
function renderRotinas() {
    const rotinas = Store.getData().rotinasBase;
    const clientes = Store.getData().clientes;
    const tbody = document.querySelector('#rotinas-table tbody');
    tbody.innerHTML = '';

    if (rotinas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 3rem;">Nenhuma rotina base cadastrada.</td></tr>`;
        return;
    }

    rotinas.forEach(r => {
        let badgeClass = "noprazo";
        if (r.frequencia === 'Anual') badgeClass = 'hoje';
        else if (r.frequencia === 'Eventual') badgeClass = 'atrasado'; // Using red to highlight

        const diaText = r.frequencia === 'Mensal' ? `Dia ${r.diaPrazoPadrao}` :
            (r.frequencia === 'Anual' ? `${r.diaPrazoPadrao}` : `${r.diaPrazoPadrao} d.ú.`);

        // Lista de clientes vinculados em uma só linha
        const clientesVinculados = clientes
            .filter(c => c.rotinasSelecionadas && c.rotinasSelecionadas.includes(r.id))
            .map(c => c.razaoSocial)
            .join(", ") || "Nenhum cliente";

        // Responsáveis (já vem como string separada por vírgula da Store)
        const responsaveisText = r.responsavel || "Automático";

        const tr = document.createElement('tr');
        tr.className = 'fade-in';
        tr.innerHTML = `
            <td><strong>${r.nome}</strong></td>
            <td><span class="status-badge ${badgeClass}">${r.frequencia || 'Mensal'}</span></td>
            <td><span class="resp-tag" style="background: rgba(255,255,255,0.05); color: var(--text-main);">${r.setor || '-'}</span></td>
            <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${responsaveisText}">
                <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-solid fa-users-gear"></i> ${responsaveisText}</span>
            </td>
            <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${clientesVinculados}">
                <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-solid fa-building"></i> ${clientesVinculados}</span>
            </td>
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

    // Dynamic loading of Employees (Responsáveis)
    const respGrid = document.getElementById('rotina-responsavel-grid');
    if (respGrid) {
        respGrid.innerHTML = '';
        Store.getData().funcionarios.forEach(f => {
            respGrid.innerHTML += `
                <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-main); cursor:pointer;">
                    <input type="checkbox" name="responsavel-sel" value="${f.nome}" class="custom-checkbox resp-checkbox">
                    ${f.nome}
                </label>
            `;
        });
    }

    form.reset();
    currentChecklistBuilder = []; // Reset builder
    document.getElementById('new-checklist-item').value = '';

    // Reset Search
    const filterInput = document.getElementById('filter-clientes-rotina');
    if (filterInput) {
        filterInput.value = '';
        filterInput.style.width = '0';
        filterInput.style.opacity = '0';
        filterInput.style.padding = '0';
        filterInput.style.pointerEvents = 'none';
    }

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

    // Dynamic loading of Clientes checkboxes
    const clientesGrid = document.getElementById('clientes-checkbox-grid');
    if (clientesGrid) {
        clientesGrid.innerHTML = '';
        Store.getData().clientes.forEach(c => {
            clientesGrid.innerHTML += `
                <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-main); cursor:pointer;">
                    <input type="checkbox" name="cliente-sel" id="cliente-cb-${c.id}" value="${c.id}" class="custom-checkbox">
                    ${c.razaoSocial}
                </label>
            `;
        });
    }

    if (id) {
        const rotina = Store.getData().rotinasBase.find(r => r.id === id);
        if (rotina) {
            title.innerHTML = '<i class="fa-solid fa-pen highlight-text"></i> Editar Rotina';
            document.getElementById('rotina-id').value = rotina.id;
            document.getElementById('rotina-nome').value = rotina.nome;
            document.getElementById('rotina-frequencia').value = rotina.frequencia || 'Mensal';
            document.getElementById('rotina-setor').value = rotina.setor || '';
            document.getElementById('rotina-prazo').value = rotina.diaPrazoPadrao;

            // Check the responsible employees
            const reps = (rotina.responsavel || "").split(",").map(s => s.trim());
            document.querySelectorAll('.resp-checkbox').forEach(cb => {
                if (reps.includes(cb.value)) cb.checked = true;
            });

            currentChecklistBuilder = [...(rotina.checklistPadrao || [])];

            // Check the clients that have this routine
            Store.getData().clientes.forEach(c => {
                if (c.rotinasSelecionadas && c.rotinasSelecionadas.includes(id)) {
                    const cb = document.getElementById(`cliente-cb-${c.id}`);
                    if (cb) cb.checked = true;
                }
            });
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
    document.getElementById('rotinas-list-panel').style.display = 'none';
    document.getElementById('rotinas-detail-panel').style.display = 'block';
}

function closeRotinaModal() {
    document.getElementById('rotinas-detail-panel').style.display = 'none';
    document.getElementById('rotinas-list-panel').style.display = 'block';
    const form = document.getElementById('add-rotina-form');
    if (form) form.reset();
    currentChecklistBuilder = [];
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



async function handleSaveRotina(e) {
    e.preventDefault();

    const id = document.getElementById('rotina-id').value;
    const nome = document.getElementById('rotina-nome').value;
    const setor = document.getElementById('rotina-setor').value;
    const frequencia = document.getElementById('rotina-frequencia').value;
    let prazo = document.getElementById('rotina-prazo').value;

    const selectedResps = Array.from(document.querySelectorAll('input[name="responsavel-sel"]:checked')).map(cb => cb.value);
    const responsavel = selectedResps.join(", ");

    const selectedClientIds = Array.from(document.querySelectorAll('input[name="cliente-sel"]:checked')).map(cb => parseInt(cb.value));

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
        await Store.editRotinaBase(id, nome, setor, frequencia, prazo, currentChecklistBuilder, selectedClientIds, responsavel);
    } else {
        await Store.addRotinaBase(nome, setor, frequencia, prazo, currentChecklistBuilder, selectedClientIds, responsavel);
    }

    renderRotinas();
    renderOperacional();
    renderDashboard();

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



let currentInboxFolder = 'inbox';
let currentLoadedMessageId = null;

function updateMensagensBadges() {
    if (!LOGGED_USER) return;

    const unreadCount = Store.getUnreadCount(LOGGED_USER.nome);
    const badges = document.querySelectorAll('.badge');

    badges.forEach(b => {
        if (unreadCount > 0) {
            b.textContent = unreadCount;
            b.style.display = 'flex';
        } else {
            b.style.display = 'none';
        }
    });

    // Sidebar Inbox Badge (specific element, if it exists)
    const inboxBadge = document.getElementById('inbox-unread-badge');
    if (inboxBadge) {
        if (unreadCount > 0) {
            inboxBadge.style.display = 'inline-block';
            inboxBadge.textContent = unreadCount;
        } else {
            inboxBadge.style.display = 'none';
        }
    }
}

function initInboxTabs() {
    const tabs = document.querySelectorAll('.inbox-menu-item');
    tabs.forEach(tab => {
        // Remove existing listeners to avoid doubles
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);

        newTab.addEventListener('click', (e) => {
            const folder = e.currentTarget.getAttribute('data-folder');
            document.querySelectorAll('.inbox-menu-item').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');

            const titles = {
                'inbox': 'Caixa de Entrada',
                'sent': 'Itens Enviados',
                'system': 'Alertas do Sistema'
            };
            document.getElementById('inbox-current-folder-title').textContent = titles[folder];
            currentInboxFolder = folder;
            renderMensagens();
            hideInboxReader();
        });
    });

    const refreshBtn = document.getElementById('btn-refresh-inbox');
    if (refreshBtn) {
        const newRefresh = refreshBtn.cloneNode(true);
        refreshBtn.parentNode.replaceChild(newRefresh, refreshBtn);
        newRefresh.addEventListener('click', () => {
            newRefresh.querySelector('i').classList.add('fa-spin');
            setTimeout(() => {
                newRefresh.querySelector('i').classList.remove('fa-spin');
                renderMensagens();
            }, 500);
        });
    }
}

function renderMensagens() {
    initInboxTabs();
    const container = document.getElementById('mensagens-container');
    if (!LOGGED_USER) return;

    let msgs = [];
    if (currentInboxFolder === 'inbox') {
        msgs = Store.getMensagensPara(LOGGED_USER.nome).filter(m => m.remetente !== 'Sistema');
    } else if (currentInboxFolder === 'sent') {
        msgs = Store.getData().mensagens.filter(m => m.remetente === LOGGED_USER.nome);
        msgs.sort((a, b) => new Date(b.data) - new Date(a.data));
    } else if (currentInboxFolder === 'system') {
        msgs = Store.getMensagensPara(LOGGED_USER.nome).filter(m => m.remetente === 'Sistema');
    }

    container.innerHTML = '';

    if (msgs.length === 0) {
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: var(--text-muted); display:flex; flex-direction:column; align-items:center; gap: 1rem;">
                <i class="fa-regular fa-folder-open" style="font-size: 2.5rem;"></i>
                <span>Nenhuma mensagem nesta pasta.</span>
            </div>
        `;
        updateMensagensBadges();
        return;
    }

    msgs.forEach(m => {
        const d = new Date(m.data);
        const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

        // Shorten preview text
        const snippet = m.texto.length > 50 ? m.texto.substring(0, 50) + '...' : m.texto;
        const subject = m.assunto || 'Sem Assunto';
        const displayUser = currentInboxFolder === 'sent' ? `Para: ${m.destinatario}` : m.remetente;

        const div = document.createElement('div');
        div.className = `msg-item fade-in ${m.id === currentLoadedMessageId ? 'active' : ''}`;
        if (!m.lida && currentInboxFolder !== 'sent') {
            div.classList.add('unread');
        }

        div.innerHTML = `
            <div class="msg-header">
                <span style="font-weight: ${!m.lida && currentInboxFolder !== 'sent' ? '700' : '500'}; color: var(--text-main);">${displayUser}</span>
                <span>${dateStr}</span>
            </div>
            <p class="msg-subject">${subject}</p>
            <p class="msg-preview">${snippet}</p>
        `;

        div.addEventListener('click', () => loadMessageIntoReader(m.id));
        container.appendChild(div);
    });

    updateMensagensBadges();
}

function loadMessageIntoReader(id) {
    const msg = Store.getData().mensagens.find(m => m.id === id);
    if (!msg) return;

    currentLoadedMessageId = id;

    // If it's in the inbox, mark as read
    if (currentInboxFolder === 'inbox' && !msg.lida) {
        Store.markMensagemLida(id);
        updateMensagensBadges();
    }

    // Update active state on list visually without full render to avoid jump
    document.querySelectorAll('.msg-item').forEach(el => el.classList.remove('active', 'unread'));
    renderMensagens();

    document.querySelector('.empty-reader-state').style.display = 'none';
    const reader = document.querySelector('.reader-content');
    reader.style.display = 'flex';

    // Re-trigger animation
    reader.classList.remove('fade-in');
    void reader.offsetWidth;
    reader.classList.add('fade-in');

    const subjectObj = msg.assunto || 'Nova Mensagem Automática';
    document.getElementById('reader-subject').textContent = subjectObj;

    const displayUser = currentInboxFolder === 'sent' ? `Enviado para: ${msg.destinatario}` : msg.remetente;
    document.getElementById('reader-from').textContent = displayUser;

    const d = new Date(msg.data);
    document.getElementById('reader-date').textContent = `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR')}`;

    // Format text
    const paragraphs = msg.texto.split('\n').filter(p => p.trim() !== '').map(p => `<p style="margin-bottom:1rem;">${p}</p>`).join('');
    document.getElementById('reader-body-content').innerHTML = paragraphs;

    // Actions
    const btnReply = document.getElementById('btn-reply-msg');
    const btnDelete = document.getElementById('btn-delete-msg');

    if (currentInboxFolder === 'inbox' || currentInboxFolder === 'system') {
        btnReply.style.display = currentInboxFolder === 'system' ? 'none' : 'inline-block';
        btnReply.onclick = () => {
            openNovaMensagemModal(msg.remetente, `Re: ${subjectObj}`);
        };
    } else {
        btnReply.style.display = 'none';
    }

    btnDelete.onclick = () => {
        if (confirm("Deseja mesmo excluir esta mensagem da sua visualização?")) {
            // Implement delete locally by filtering it out or via Store
            hideInboxReader();
            // Store.deleteMensagem(id) -> not fully implemented in Store yet, so we just clear view
            // Real implementation would delete the row.
            alert("Ação de apagar ainda não sincronizada com a API neste mock.");
        }
    };
}

function hideInboxReader() {
    currentLoadedMessageId = null;
    document.querySelector('.empty-reader-state').style.display = 'flex';
    document.querySelector('.reader-content').style.display = 'none';
}

function openNovaMensagemModal(prefillDest = null, prefillSubj = "") {
    const select = document.getElementById('msg-destinatario');
    select.innerHTML = '';

    Store.getData().funcionarios.forEach(f => {
        select.innerHTML += `<option value="${f.nome}">${f.nome} (${f.setor})</option>`;
    });

    document.getElementById('nova-mensagem-form').reset();

    // Inject custom invisible Subject field logic temporarily or if HTML adds it
    if (prefillDest) select.value = prefillDest;

    // Notice: there's no subject input in original HTML, so we just pre-fill texto if doing a reply
    let textArea = document.getElementById('msg-texto');
    if (prefillSubj) {
        textArea.value = `--- EM RESPOSTA A: ${prefillSubj} ---\n\n`;
    }

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

    // If we're looking at sent items, refresh
    if (currentInboxFolder === 'sent') {
        renderMensagens();
    }
}



// ==========================================

// MODAL CONTROLLERS & CHECKLISTS

// ==========================================

// MODAL CONTROLLERS & CHECKLISTS

// ==========================================

function fireConfetti() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            zIndex: 9999,
            colors: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
        });
    }
}

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
    const isAdmin = LOGGED_USER && ['Gerente', 'Adm', 'Admin', 'Supervisor'].includes(LOGGED_USER.permissao);

    // Lock global toggle if done and NOT admin/supervisor
    if (task.feito && !isAdmin) {
        newToggle.disabled = true;
        document.getElementById('modal-status').innerHTML += ' <i class="fa-solid fa-lock" title="Bloqueado para edição"></i>';
    } else {
        newToggle.disabled = false;
    }

    newToggle.addEventListener('change', (e) => {

        const checked = e.target.checked;
        const wasDone = task.feito;

        Store.toggleExecucaoFeito(task.id, checked);

        if (checked && !wasDone) {
            fireConfetti();
        }
        task.feito = checked;

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



        const isAdmin = LOGGED_USER && ['Gerente', 'Adm', 'Admin', 'Supervisor'].includes(LOGGED_USER.permissao);
        const isLocked = task.feito && !isAdmin;

        div.innerHTML = `
            <input type="checkbox" class="custom-checkbox" id="chk_${sub.id}" ${sub.done ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <label for="chk_${sub.id}" class="item-text" style="${isLocked ? 'opacity:0.7; cursor:not-allowed;' : ''}">${sub.texto || sub.desc || 'Item sem nome'}</label>
        `;



        // Single checklist item changed

        const chk = div.querySelector('input');

        chk.addEventListener('change', (e) => {

            const wasDone = task.feito;

            Store.updateChecklist(task.id, sub.id, e.target.checked);



            // Re-render checklist and update underlaying lists

            renderChecklist();

            renderOperacional();

            renderDashboard();



            // Re-sync header if state changed due to all checks

            const refreshedTask = Store.getExecucoesWithDetails().find(t => t.id === currentOpenTask.id);

            if (!wasDone && refreshedTask.feito) {
                fireConfetti();
            }

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

            <td><span class="table-badge ${log.permissao === 'Gerente' ? 'danger' : 'success'}">${log.permissao}</span></td>

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

// VIEW: Painel de Administração (RBAC)

// ==========================================

function renderAdminPanel() {

    const tbody = document.querySelector('#admin-cargos-table tbody');

    if (!tbody) return;

    tbody.innerHTML = '';



    const cargos = Store.getData().cargos || [];



    if (cargos.length === 0) {

        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 3rem;">Nenhum cargo de segurança configurado ainda.</td></tr>`;

        return;

    }



    cargos.forEach(cargo => {

        const tr = document.createElement('tr');

        tr.className = 'fade-in';



        let tagsHtml = '';

        if (cargo.telas_permitidas && cargo.telas_permitidas.length > 0) {

            cargo.telas_permitidas.forEach(tela => {

                let badgeClass = 'table-badge ';

                if (tela === 'settings') {

                    badgeClass += 'danger';

                } else if (tela === 'dashboard' || tela === 'operacional') {

                    badgeClass += 'primary';

                } else {

                    badgeClass += 'info';

                }

                tagsHtml += `<span class="${badgeClass}" style="margin-right: 4px; margin-bottom: 4px; display: inline-block;">${tela}</span>`;

            });

        } else {

            tagsHtml = '<span class="text-muted">Nenhum acesso definido</span>';

        }



        tr.innerHTML = `

            <td>#${cargo.id}</td>

            <td><strong>${cargo.nome_cargo}</strong></td>

            <td style="max-width: 400px; line-height: 1.8;">${tagsHtml}</td>

            <td style="text-align: right;">

                <button class="action-btn text-primary" onclick="openCargoModal(${cargo.id})" title="Editar Permissões"><i class="fa-solid fa-pen-to-square"></i></button>

                <button class="action-btn text-danger" onclick="deleteCargo(${cargo.id})" title="Excluir Cargo"><i class="fa-solid fa-trash"></i></button>

            </td>

        `;

        tbody.appendChild(tr);

    });

}



function openCargoModal(cargoId = null) {

    const modal = document.getElementById('admin-cargo-modal');

    modal.style.display = 'flex';

    // trigger animation

    setTimeout(() => modal.classList.add('active'), 10);



    const form = document.getElementById('admin-cargo-form');

    form.reset();

    document.getElementById('cargo-id').value = '';



    if (cargoId) {

        const cargo = Store.getData().cargos.find(c => c.id === cargoId);

        if (cargo) {

            document.getElementById('cargo-id').value = cargo.id;

            document.getElementById('cargo-nome').value = cargo.nome_cargo;



            const checks = document.querySelectorAll('.cargo-perm-check');

            checks.forEach(chk => {

                chk.checked = cargo.telas_permitidas && cargo.telas_permitidas.includes(chk.value);

            });

        }

    }

}



function closeCargoModal(e) {

    if (e) e.preventDefault();

    const modal = document.getElementById('admin-cargo-modal');

    modal.classList.remove('active');

    setTimeout(() => modal.style.display = 'none', 300);

}



async function handleSaveCargo(e) {

    e.preventDefault();

    const id = document.getElementById('cargo-id').value;

    const nome = document.getElementById('cargo-nome').value.trim();



    const checkboxes = document.querySelectorAll('.cargo-perm-check:checked');

    const permitidas = Array.from(checkboxes).map(chk => chk.value);



    // Disable button to prevent double submit
    const submitBtn = document.getElementById('btn-save-cargo') || e.target.querySelector('button[type="submit"]') || document.querySelector('#admin-cargo-modal button[type="submit"]');

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
    }



    let success = false;

    if (id) {

        success = await Store.updateCargo(parseInt(id), nome, permitidas);

    } else {

        success = await Store.addCargo(nome, permitidas);

    }



    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Salvar Permissões';
    }



    if (success) {

        closeCargoModal();

        renderAdminPanel();

        showFeedbackToast(`Permissões do cargo ${nome} salvas!`, 'success');

        // Se o usuário logado tiver esse permissão editada, seria ideal um recarregamento, 

        // mas assumimos que o Admin Master está gerenciando outras.

    } else {

        showFeedbackToast('Erro ao salvar cargo. Verifique a API.', 'danger');

    }

}



async function deleteCargo(id) {

    if (confirm("Tem certeza que deseja excluir esse Cargo e suas Permissões de Acesso?")) {

        const success = await Store.deleteCargo(id);

        if (success) {

            renderAdminPanel();

            showFeedbackToast('Cargo excluído com sucesso.', 'success');

        } else {

            showFeedbackToast('Erro ao excluir cargo.', 'danger');

        }

    }

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

    const file = fileInput.files[0];

    if (!file) {

        alert("Por favor, selecione um arquivo JSON de backup antes de clicar em Restaurar.");

        return;

    }



    if (!confirm("⚠️ ATENÇÃO EXTREMA ⚠️\n\nIsso apagará TODA a base atual do FiscalApp e a substituirá completamente pelos dados deste arquivo. Todas as execuções, mensagens, clientes novos feitos DEPOIS desse backup vão SUMIR para sempre.\n\nVocê tem 100% de certeza absoluta?")) {

        return;

    }



    const reader = new FileReader();

    reader.onload = function (e) {

        try {

            const rawData = e.target.result;

            const parsedData = JSON.parse(rawData);



            if (!parsedData.clientes || !parsedData.funcionarios || !parsedData.config || !parsedData.version) {

                throw new Error("O arquivo selecionado não parece ser um backup válido do FiscalApp.");

            }



            Store.setInitialData(parsedData);

            alert("✅ SISTEMA RESTAURADO COM SUCESSO!\n\nSeus dados foram alterados. O sistema será recarregado agora para aplicar todas as configurações visuais.");

            window.location.reload();



        } catch (err) {

            console.error(err);

            alert("Erro fatal ao tentar ler o arquivo: " + err.message);

            Store.registerLog("Aviso/Alerta", `Tentativa falha de restauração de backup.`);

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





// ==========================================
// VIEW: Auditoria de Competência
// ==========================================
function renderAuditoriaCompetencia() {
    const mesSelect = document.getElementById('audit-comp-mes');
    const userSelect = document.getElementById('audit-comp-user');
    const btnRun = document.getElementById('btn-run-audit-comp');

    // Populate Meses
    mesSelect.innerHTML = '<option value="">Todos os Meses</option>';
    const mesesObj = Store.getData().meses || [];
    [...mesesObj].sort((a, b) => b.id.localeCompare(a.id)).forEach(m => {
        mesSelect.innerHTML += `<option value="${m.id}">${m.mes}</option>`;
    });

    // Populate Users
    userSelect.innerHTML = '<option value="">Todos os Funcionários</option>';
    const usersObj = Store.getData().funcionarios || [];
    usersObj.forEach(u => {
        userSelect.innerHTML += `<option value="${u.nome}">${u.nome}</option>`;
    });

    // Reset Table
    document.getElementById('audit-comp-results').style.display = 'none';

    // Remove old listeners to prevent bubbling
    const cloneBtn = btnRun.cloneNode(true);
    btnRun.parentNode.replaceChild(cloneBtn, btnRun);

    cloneBtn.addEventListener('click', runAuditoriaCompetencia);
}

function runAuditoriaCompetencia() {
    const mesId = document.getElementById('audit-comp-mes').value;
    const userName = document.getElementById('audit-comp-user').value;

    if (!mesId && !userName) {
        alert("Selecione pelo menos um Mês ou um Funcionário para filtrar.");
        return;
    }

    const resultsDiv = document.getElementById('audit-comp-results');
    const tbody = document.querySelector('#audit-comp-table tbody');
    tbody.innerHTML = '';

    // Ler all rotinas
    const allExecs = Store.getData().execucoes || [];

    // Filter
    let filtered = allExecs;
    if (mesId) {
        filtered = filtered.filter(e => e.mesId === mesId);
    }
    if (userName) {
        filtered = filtered.filter(e => e.responsavel === userName);
    }

    // Stats
    let noPrazo = 0;
    let atrasado = 0;
    let pendente = 0;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">Nenhuma rotina encontrada para os filtros selecionados.</td></tr>`;
    } else {
        const tToday = new Date().setHours(0, 0, 0, 0);

        filtered.forEach(ex => {
            const client = Store.getData().clientes.find(c => c.id === ex.clienteId);
            const rName = client ? client.nome : `#${ex.clienteId}`;

            const dPrazo = ex.diaPrazo ? new Date(ex.diaPrazo + "T00:00:00").setHours(0, 0, 0, 0) : tToday;

            let statusTag = '';

            // Calculating exact state
            if (ex.feito) {
                // Was it done late?
                // Em simulações locais, faltaria o registro exato de `dataConclusao`. Adaptando pela prop `statusAuto`
                statusTag = '<span class="status-badge concluido"><i class="fa-solid fa-check"></i> Concluído No Prazo</span>';
                noPrazo++;
            } else {
                if (dPrazo < tToday) {
                    statusTag = '<span class="status-badge atrasado"><i class="fa-solid fa-triangle-exclamation"></i> Atrasado</span>';
                    atrasado++;
                } else {
                    statusTag = '<span class="status-badge"><i class="fa-solid fa-clock-rotate-left"></i> Pendente</span>';
                    pendente++;
                }
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${rName}</strong></td>
                <td>${ex.rotina}</td>
                <td>${formatDate(ex.diaPrazo)}</td>
                <td>${ex.feito ? '--' : 'Pendente'}</td>
                <td>${statusTag}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Update KPIs
    document.getElementById('audit-comp-noprazo').textContent = noPrazo;
    document.getElementById('audit-comp-atrasado').textContent = atrasado;
    document.getElementById('audit-comp-pendente').textContent = pendente;

    const lblMes = mesId ? Store.getData().meses.find(m => m.id === mesId)?.mes || mesId : 'Todo o Período';
    const lblUser = userName ? userName : 'Toda a Equipe';
    document.getElementById('audit-comp-subtitle').textContent = `Resultados para ${lblUser} em ${lblMes}`;

    resultsDiv.style.display = 'block';
}

// ==========================================
// Settings Hub Tabs Initialization
// ==========================================
let settingsInitDone = false;
function initSettingsTabs() {
    if (settingsInitDone) return;
    const tabs = document.querySelectorAll(".settings-tab-btn");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            // Remove active classes
            tabs.forEach(t => {
                t.classList.remove("active");
                t.style.background = "transparent";
                t.style.color = "var(--text-muted)";
            });
            document.querySelectorAll(".settings-pane").forEach(pane => {
                pane.style.display = "none";
                pane.classList.remove("active");
            });

            // Set active class to clicked tab
            tab.classList.add("active");
            tab.style.background = "rgba(99, 102, 241, 0.2)";
            tab.style.color = "var(--text-main)";

            const targetId = tab.getAttribute("data-target");
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.style.display = "block";
                setTimeout(() => targetPane.classList.add("active"), 10);
            }

            // Fire Specific Tab Renders
            if (targetId === "set-rbac") {
                renderAdminPanel();
            } else if (targetId === "set-setores") {
                renderSetoresSettings();
            } else if (targetId === "set-backup") {
                renderBackupView();
            } else if (targetId === "set-auditoria") {
                renderAuditoria();
            } else if (targetId === "set-auditoria-comp") {
                renderAuditoriaCompetencia();
            } else if (targetId === "set-equipe") {
                renderEquipe();
            }
        });
    });

    settingsInitDone = true;
}



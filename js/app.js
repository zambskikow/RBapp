// js/app.js - Main UI Controller



document.addEventListener('DOMContentLoaded', () => {

    initApp();

});



// Plugin registration will be handled inside initApp for more safety

let currentOperacionalUser = 'All';

const nowApp = new Date();
nowApp.setMonth(nowApp.getMonth() - 1);
let currentCompetencia = `${nowApp.getFullYear()}-${(nowApp.getMonth() + 1).toString().padStart(2, '0')}`;
// Set para rastrear grupos de rotinas que o usuário abriu manualmente
// Preserva o estado aberto mesmo após re-renderização do painel operacional
const operacionalGruposAbertos = new Set();

let LOGGED_USER = null; // Replaced hardcoded string



async function initApp() {

    // Await API Hydration First!

    const loaded = await Store.loadFromStorage();

    if (!loaded) {

        console.warn("API Offline or database empty.");

    }



    // Check initial state

    // Register DataLabels plugin globally if available
    if (typeof ChartDataLabels !== 'undefined') {
        try {
            Chart.register(ChartDataLabels);
        } catch (e) {
            console.warn("Datalabels plugin registration failed:", e);
        }
    }

    document.getElementById('login-form').addEventListener('submit', handleLogin);



    // Check session storage for session

    const storedSession = sessionStorage.getItem('fiscalapp_session');

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



            const savedView = sessionStorage.getItem('fiscalapp_current_view') || 'dashboard';



            // Apply permissions to Navbar BEFORE clicking!

            applyUserPermissions(auth);

            // Aplicar Identidade Visual (Branding)
            applyBranding();



            // Render everything invisibly first

            renderDashboard();

            renderOperacional();

            renderClientes();

            renderRotinas();

            renderMensagens();
            initInboxTabs();
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
    setupPasswordToggles();




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
    const savedCompetencia = localStorage.getItem('lastCompetencia');

    if (savedCompetencia && Store.getData().meses.find(m => m.id === savedCompetencia)) {
        currentCompetencia = savedCompetencia;
    } else if (activeMonth) {
        currentCompetencia = activeMonth.id;
    } else {
        currentCompetencia = `${nowApp.getFullYear()}-${(nowApp.getMonth() + 1).toString().padStart(2, '0')}`; // Fallback
    }

    compFilter.value = currentCompetencia;
    dashCompFilter.value = currentCompetencia;
    meuCompFilter.value = currentCompetencia;



    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');
    const sidebar = document.querySelector('.sidebar');

    if (btnToggleSidebar && sidebar) {
        btnToggleSidebar.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.add('mobile-open');
            } else {
                sidebar.classList.toggle('collapsed');
            }
        });
    }

    if (btnCloseSidebar && sidebar) {
        btnCloseSidebar.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
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
        localStorage.setItem('lastCompetencia', currentCompetencia);
        dashCompFilter.value = currentCompetencia;
        meuCompFilter.value = currentCompetencia;
        renderOperacional();
        const dashboardView = document.getElementById('view-dashboard');
        if (dashboardView && dashboardView.style.display === 'block') renderDashboard();
        const meuDesempenhoView = document.getElementById('view-meu-desempenho');
        if (meuDesempenhoView && meuDesempenhoView.style.display === 'block') renderMeuDesempenho();
    });

    // Event Listener Gestão de Competências
    const btnAddComp = document.getElementById('btn-add-competencia');
    if (btnAddComp) {
        btnAddComp.addEventListener('click', () => {
            const compAtualAno = new Date().getFullYear();
            const modal = document.getElementById('modal-add-competencia');
            const input = document.getElementById('add-comp-input');
            if (modal && input) {
                input.value = `${compAtualAno}-`;
                modal.classList.add('active');
                input.focus();
            }
        });
    }

    const btnConfirmAddComp = document.getElementById('btn-confirm-add-comp');
    if (btnConfirmAddComp) {
        btnConfirmAddComp.addEventListener('click', async () => {
            const inputVal = document.getElementById('add-comp-input').value;
            if (inputVal && /^\d{4}-\d{2}$/.test(inputVal)) {
                btnConfirmAddComp.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';
                btnConfirmAddComp.disabled = true;

                showLoading('Processando', `Criando competência ${inputVal}...`);
                const success = await Store.addCompetenciaManual(inputVal);
                hideLoading();

                closeAddCompetenciaModal();
                if (success) {
                    renderCompetenciasAdmin();
                    showNotify("Sucesso", "Competência gerada e obrigações criadas com sucesso!", "success");
                }
                // O erro de duplicação já lança showNotify lá no Store

                btnConfirmAddComp.innerHTML = '<i class="fa-solid fa-check"></i> Gerar Competência';
                btnConfirmAddComp.disabled = false;
            } else if (inputVal) {
                showNotify("Atenção", "Formato inválido. Use YYYY-MM (Ex: 2024-03).", "warning");
            }
        });
    }

    window.closeAddCompetenciaModal = function () {
        const modal = document.getElementById('modal-add-competencia');
        if (modal) modal.classList.remove('active');
    }

    const btnConfirmDeleteComp = document.getElementById('btn-confirm-delete-comp');
    if (btnConfirmDeleteComp) {
        btnConfirmDeleteComp.addEventListener('click', async () => {
            const hiddenId = document.getElementById('delete-comp-id');
            if (hiddenId && hiddenId.value) {
                const id = hiddenId.value;
                btnConfirmDeleteComp.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Apagando...';
                btnConfirmDeleteComp.disabled = true;

                showLoading('Processando', `Apagando ${id}...`);
                const success = await Store.deleteCompetencia(id);
                hideLoading();

                if (success) {
                    closeDeleteCompetenciaModal();
                    renderCompetenciasAdmin();
                } else {
                    showNotify("Erro", "Houve um erro na exclusão. Tente novamente.", "error");
                    btnConfirmDeleteComp.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir';
                    btnConfirmDeleteComp.disabled = false;
                }
            }
        });
    }

    // Operational Search & Sort Listeners
    const opSearch = document.getElementById('operacional-search');
    if (opSearch) {
        opSearch.addEventListener('input', () => {
            renderOperacional();
        });
    }
    const opSort = document.getElementById('operacional-sort');
    if (opSort) {
        opSort.addEventListener('change', () => {
            renderOperacional();
        });
    }

    // Inbox Listeners
    const btnNovaMsg = document.getElementById('btn-nova-mensagem');
    if (btnNovaMsg) {
        btnNovaMsg.addEventListener('click', () => openNovaMensagemModal());
    }

    const btnCloseMsg = document.getElementById('close-mensagem-modal');
    if (btnCloseMsg) {
        btnCloseMsg.addEventListener('click', () => closeNovaMensagemModal());
    }

    const btnCancelMsg = document.getElementById('mensagem-modal-cancel');
    if (btnCancelMsg) {
        btnCancelMsg.addEventListener('click', () => closeNovaMensagemModal());
    }

    const formMsg = document.getElementById('nova-mensagem-form');
    if (formMsg) {
        formMsg.addEventListener('submit', handleSendMensagem);
    }

    const btnNotif = document.getElementById('btn-notification');
    if (btnNotif) {
        btnNotif.addEventListener('click', () => {
            // Se houver lógica de notificações futura, entra aqui
            showFeedbackToast("Central de Notificações em breve!", "info");
        });
    }

    // Listeners de Pesquisa e Ordenação de Clientes
    const clientesSearch = document.getElementById('clientes-search');
    if (clientesSearch) {
        clientesSearch.addEventListener('input', () => {
            renderClientes();
        });
    }
    const clientesSort = document.getElementById('clientes-sort');
    if (clientesSort) {
        clientesSort.addEventListener('change', () => {
            renderClientes();
        });
    }



    dashCompFilter.addEventListener('change', (e) => {
        currentCompetencia = e.target.value;
        localStorage.setItem('lastCompetencia', currentCompetencia);
        compFilter.value = currentCompetencia;
        meuCompFilter.value = currentCompetencia;
        renderDashboard();
        renderOperacional();
        renderMeuDesempenho();
    });



    meuCompFilter.addEventListener('change', (e) => {
        currentCompetencia = e.target.value;
        localStorage.setItem('lastCompetencia', currentCompetencia);
        compFilter.value = currentCompetencia;
        dashCompFilter.value = currentCompetencia;
        renderMeuDesempenho();
        renderOperacional();
        renderDashboard();
    });



    document.getElementById('dash-user-filter').addEventListener('change', renderDashboard);



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

    const sortClientesRotina = document.getElementById('sort-clientes-rotina');
    if (sortClientesRotina) {
        sortClientesRotina.addEventListener('change', (e) => {
            const rotinaId = document.getElementById('rotina-id').value;
            renderRoutineClientsGrid(e.target.value, rotinaId ? parseInt(rotinaId) : null);
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

    // 14. Branding Event
    const brandingForm = document.getElementById('form-branding');
    if (brandingForm) {
        brandingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const configData = {
                brandName: document.getElementById('brand-name').value,
                brandLogoUrl: document.getElementById('brand-logo-url').value,
                accentColor: document.getElementById('brand-accent-color').value,
                slogan: document.getElementById('brand-slogan').value,
                theme: document.getElementById('brand-theme').value
            };
            await Store.updateBranding(configData);
            applyBranding();
            showNotify("Sucesso", "Identidade visual personalizada com sucesso!", "success");
        });
    }
}

/**
 * Exibe uma notificação elegante (Toast) na tela
 * @param {string} title Título da mensagem
 * @param {string} message Conteúdo da mensagem
 * @param {string} type Tipo: 'success', 'error', 'info', 'warning'
 */
window.showNotify = function (title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fa-solid ${icon}"></i>
        </div>
        <div class="toast-content">
            <span class="toast-title">${title}</span>
            <span class="toast-message">${message}</span>
        </div>
        <button class="toast-close">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    container.appendChild(toast);

    // Evento para fechar manual
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 500);
    });

    // Auto close após 5 segundos
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 500);
        }
    }, 5000);
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

            // Aplicar Branding após Login
            applyBranding();

            // Re-route user to their first available view if they don't have access to Dashboard
            if (!auth.telas_permitidas.includes('dashboard') && auth.telas_permitidas.length > 0) {
                const firstView = auth.telas_permitidas[0];
                const firstNav = document.querySelector(`.nav-item[data-view="${firstView}"]`);
                if (firstNav) firstNav.click();
            }

            sessionStorage.setItem('fiscalapp_session', auth.id);

            // Execute Auto-Backup if enabled
            checkAndRunAutoBackup();
        }, 300); // Wait for fade out
    } else {
        errorMsg.style.display = 'block';
    }
}

function handleLogout() {
    Store.registerLog("Acesso", `${LOGGED_USER ? LOGGED_USER.nome : 'Usuário'} saiu do sistema.`);

    // Disparar animação de shutdown
    const overlay = document.getElementById('shutdown-overlay');
    if (overlay) {
        overlay.classList.add('active');
    }

    setTimeout(() => {
        LOGGED_USER = null;
        sessionStorage.removeItem('fiscalapp_session');
        window.location.reload();
    }, 850); // Um pouco mais que a animação CSS (800ms)
}

// Master state for menu order
let currentMenuOrder = [];

function applyUserPermissions(auth) {
    const config = Store.getData().config || {};
    const savedOrder = config.menuOrder || [];
    const permitidas = auth.telas_permitidas || [];

    // Master Admin bypass: Manager account or "Gerente" permission gets everything
    const isMasterAdmin = auth.nome === 'Manager' || auth.permissao === 'Gerente';

    const sidebarNav = document.querySelector('.sidebar .nav-menu');
    if (sidebarNav) {
        const navItems = Array.from(sidebarNav.querySelectorAll('.nav-item'));

        // Reorder items in DOM if savedOrder exists
        if (savedOrder.length > 0) {
            savedOrder.forEach(viewKey => {
                const item = navItems.find(i => i.getAttribute('data-view') === viewKey);
                if (item) sidebarNav.appendChild(item);
            });
            // Append any items not in savedOrder to the end (future proofing)
            navItems.forEach(item => {
                if (!savedOrder.includes(item.getAttribute('data-view'))) {
                    sidebarNav.appendChild(item);
                }
            });
        }
    }

    // Loop through all navigation links and show/hide based on array
    document.querySelectorAll('.nav-item').forEach(navItem => {
        const view = navItem.getAttribute('data-view');
        if (!view) return; // Skip non-view links like logout

        if (isMasterAdmin || permitidas.includes(view)) {
            navItem.style.display = 'flex'; // our UI uses flex for all nav-items
        } else {
            navItem.style.display = 'none';
        }
    });

    // Final cleanup: ensure nav-divider and specific buttons follow the order
    const adminNavDivider = document.getElementById('admin-nav-divider');
    const navSettings = document.getElementById('nav-settings');
    if (adminNavDivider && sidebarNav) sidebarNav.appendChild(adminNavDivider);
    if (navSettings && sidebarNav) sidebarNav.appendChild(navSettings);

    // Hide/Show specific inner buttons based on permissions
    const btnSetores = document.getElementById('btn-manage-setores');
    if (btnSetores) {
        if (isMasterAdmin || permitidas.includes('settings')) {
            btnSetores.style.display = 'inline-block';
        } else {
            btnSetores.style.display = 'none';
        }
    }

    if (adminNavDivider) {
        if (isMasterAdmin || permitidas.includes('settings')) {
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

function applyBranding() {
    const config = Store.getData().config || {};
    const brandName = config.brandName || "RB|App";
    const brandLogoUrl = config.brandLogoUrl || "";
    const accentColor = config.accentColor || "#6366f1";
    const slogan = config.slogan || "";
    const theme = config.theme || "glass";

    // 1. Aplicar Cores (CSS Variables)
    const root = document.documentElement;
    root.style.setProperty('--primary', accentColor);
    root.style.setProperty('--primary-light', accentColor + 'ee');
    root.style.setProperty('--accent', accentColor);
    root.style.setProperty('--accent-glow', accentColor + '40'); // 25% opacity

    // 2. Aplicar Classe de Tema ao BODY
    // Remove todas as classes de tema anteriores
    document.body.classList.remove('theme-glass', 'theme-dark', 'theme-light');
    document.body.classList.add(`theme-${theme}`);

    // 3. Atualizar Sidebar Logo e Slogan
    const sidebarLogo = document.querySelector('.sidebar .logo span');
    if (sidebarLogo) sidebarLogo.textContent = brandName;

    const sidebarSlogan = document.querySelector('.sidebar .logo p');
    if (sidebarSlogan) {
        sidebarSlogan.textContent = slogan;
        sidebarSlogan.style.display = slogan ? 'block' : 'none';
    }

    // 4. Atualizar Login Logo
    const loginLogo = document.querySelector('.login-logo');
    if (loginLogo) {
        if (brandLogoUrl) {
            loginLogo.innerHTML = `<img src="${brandLogoUrl}" alt="${brandName}" style="max-height: 60px; border-radius: 8px; margin-bottom: 10px;">
                                   <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-main);">${brandName}</div>`;
        } else {
            loginLogo.innerHTML = `<i class="fa-solid fa-chart-line" style="font-size: 3rem; color: var(--primary);"></i> 
                                   <div style="font-size: 1.5rem; font-weight: 800; margin-top: 5px;">${brandName}</div>`;
        }
    }

    // 5. Sincronizar campos do formulário de personalização
    const inputName = document.getElementById('brand-name');
    const inputColor = document.getElementById('brand-accent-color');
    const inputSlogan = document.getElementById('brand-slogan');
    const inputLogo = document.getElementById('brand-logo-url');
    const selectTheme = document.getElementById('brand-theme');

    if (inputName) inputName.value = brandName;
    if (inputColor) inputColor.value = accentColor;
    if (inputSlogan) inputSlogan.value = slogan;
    if (inputLogo) inputLogo.value = brandLogoUrl;
    if (selectTheme) selectTheme.value = theme;
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
            sessionStorage.setItem('fiscalapp_current_view', targetView);
            document.querySelectorAll('.view-section').forEach(view => {
                view.style.display = 'none';
                view.classList.remove('active');
            });

            const viewEl = document.getElementById(`view-${targetView}`);
            if (viewEl) {
                viewEl.style.display = 'block';
                // Small delay to trigger CSS animation
                setTimeout(() => viewEl.classList.add('active'), 10);

                // Fechar sidebar no mobile após navegar
                if (window.innerWidth <= 768) {
                    const sidebar = document.querySelector('.sidebar');
                    if (sidebar) sidebar.classList.remove('mobile-open');
                }

                if (targetView === 'marketing') {
                    Marketing.init();
                }

                // Refresh data based on view
                if (targetView === 'dashboard') renderDashboard();
                if (targetView === 'meu-desempenho') renderMeuDesempenho();
                if (targetView === 'operacional') renderOperacional();
                if (targetView === 'clientes') renderClientes();
                if (targetView === 'rotinas') renderRotinas();
                if (targetView === 'mensagens') renderMensagens();
                if (targetView === 'competencias') renderCompetenciasAdmin();
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
}

// ==========================================
// VIEW: Dashboard Manager
// ==========================================
function renderDashboard() {
    const dashUser = document.getElementById('dash-user-filter').value;

    // Agora o dashboard é global da empresa, mas permite filtrar por analista
    let execsAll = Store.getExecucoesWithDetails(dashUser);

    // Filtro de Competência (Sempre ativo)
    if (currentCompetencia) {
        execsAll = execsAll.filter(e => e.competencia === currentCompetencia);
    }

    // Cálculos de KPIs Estratégicos
    const total = execsAll.length;
    const concluidos = execsAll.filter(e => e.feito).length;
    const taxaEficiencia = total > 0 ? Math.round((concluidos / total) * 100) : 0;

    const pendentes = execsAll.filter(e => !e.feito);
    const vencendo = pendentes.filter(e => e.semaforo === 'yellow').length;
    const atrasados = pendentes.filter(e => e.semaforo === 'red').length;
    const noPrazo = pendentes.length - vencendo - atrasados;

    const kpis = {
        total: total,
        concluidos: concluidos,
        noPrazo: noPrazo > 0 ? noPrazo : 0,
        vencendo: vencendo,
        atrasados: atrasados,
        taxaEficiencia: taxaEficiencia
    };

    // Identificar Maior Carga e Cliente Crítico
    let maiorCargaAnalista = "--";
    let maxPendencias = -1;
    let clienteCritico = "--";

    const teamStats = {};
    execsAll.forEach(ex => {
        const reps = (ex.responsavel || "Automático").split(",").map(r => r.trim());
        reps.forEach(resp => {
            if (!teamStats[resp]) teamStats[resp] = { total: 0, concluidas: 0, pendentes: 0 };
            teamStats[resp].total++;
            if (ex.feito) teamStats[resp].concluidas++;
            else teamStats[resp].pendentes++;

            if (teamStats[resp].pendentes > maxPendencias) {
                maxPendencias = teamStats[resp].pendentes;
                maiorCargaAnalista = resp;
            }
        });
    });

    const maisAtrasado = execsAll.filter(e => !e.feito && e.semaforo === 'red')
        .sort((a, b) => new Date(a.diaPrazo) - new Date(b.diaPrazo))[0];
    if (maisAtrasado) clienteCritico = maisAtrasado.clientName;

    // Atualização dos Contadores com Animação
    animateValue('kpi-total', parseInt(document.getElementById('kpi-total').innerText) || 0, kpis.total, 800);
    animateValue('kpi-done', parseInt(document.getElementById('kpi-done').innerText) || 0, kpis.concluidos, 800);
    animateValue('kpi-warning', parseInt(document.getElementById('kpi-warning').innerText) || 0, kpis.vencendo, 800);
    animateValue('kpi-late', parseInt(document.getElementById('kpi-late').innerText) || 0, kpis.atrasados, 800);

    const efEl = document.getElementById('kpi-eficiencia');
    if (efEl) {
        efEl.innerText = `${taxaEficiencia}%`;
        efEl.style.color = taxaEficiencia > 80 ? 'var(--success)' : (taxaEficiencia > 50 ? 'var(--warning)' : 'var(--danger)');
    }

    // Alertas de Gestão
    const alertCarga = document.getElementById('kpi-alert-carga');
    const alertRisco = document.getElementById('kpi-alert-risco');
    if (alertCarga) alertCarga.querySelector('span').innerText = `Maior Carga: ${maiorCargaAnalista} (${maxPendencias > 0 ? maxPendencias : 0})`;
    if (alertRisco) alertRisco.querySelector('span').innerText = `Crítico: ${clienteCritico}`;

    // Renderizar Múltiplos Gráficos
    renderHealthChart(kpis);
    renderTeamProductivityChart(teamStats);
    renderSectorLoadChart(execsAll);

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

    // Render Team Performance Table
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
                <td><span style="color:var(--warning); font-weight:bold;">${st.total - st.concluidas}</span></td>
                <td><span style="color:var(--danger); font-weight:bold;">${st.pendentes}</span></td>
                <td style="width:200px;">${progressHtml}</td>
            `;
            ptbody.appendChild(tr);
        });
    }
}

// Global chart instances for destruction on redraw
let healthChartInst = null;
let teamChartInst = null;
let sectorChartInst = null;

function renderHealthChart(kpis) {
    const ctxValue = document.getElementById('semaforoChart');
    if (!ctxValue) return;
    if (healthChartInst) healthChartInst.destroy();

    if (!kpis) return;

    // Garantir que todos os valores sejam numéricos
    const d_concluidos = Number(kpis.concluidos) || 0;
    const d_noPrazo = Number(kpis.noPrazo) || 0;
    const d_vencendo = Number(kpis.vencendo) || 0;
    const d_atrasados = Number(kpis.atrasados) || 0;

    let data = [d_concluidos, d_noPrazo, d_vencendo, d_atrasados];
    const isActuallyEmpty = data.every(d => d === 0);

    if (isActuallyEmpty) {
        data = [0.1, 0, 0, 0]; // Valor mínimo para evitar canvas vazio
    }

    healthChartInst = new Chart(ctxValue, {
        type: 'doughnut',
        data: {
            labels: ['Concluído', 'No Prazo', 'Vencendo', 'Atrasado'],
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
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94A3B8', font: { size: 10 } } },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 12 },
                    formatter: (value) => (value >= 1 && !isActuallyEmpty) ? value : ''
                }
            }
        }
    });
}

function renderTeamProductivityChart(teamStats) {
    const ctxValue = document.getElementById('teamChart');
    if (!ctxValue) return;
    if (teamChartInst) teamChartInst.destroy();

    const labels = Object.keys(teamStats);
    const concluidas = labels.map(l => teamStats[l].concluidas);
    const pendentes = labels.map(l => teamStats[l].pendentes);

    teamChartInst = new Chart(ctxValue, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Feito', data: concluidas, backgroundColor: '#10B981' },
                { label: 'Pendente', data: pendentes, backgroundColor: 'rgba(255,255,255,0.1)' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 10 } } },
                y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8', font: { size: 10 } } }
            },
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94A3B8', font: { size: 10 } } },
                datalabels: {
                    color: '#fff',
                    anchor: 'center',
                    align: 'center',
                    font: { weight: 'bold', size: 11 },
                    formatter: (value) => value > 0 ? value : ''
                }
            }
        }
    });
}

function renderSectorLoadChart(execsAll) {
    const ctxValue = document.getElementById('sectorChart');
    if (!ctxValue) return;
    if (sectorChartInst) sectorChartInst.destroy();

    const sectors = {};
    execsAll.forEach(ex => {
        const s = ex.setor || "Geral";
        sectors[s] = (sectors[s] || 0) + 1;
    });

    sectorChartInst = new Chart(ctxValue, {
        type: 'polarArea',
        data: {
            labels: Object.keys(sectors),
            datasets: [{
                data: Object.values(sectors),
                backgroundColor: [
                    'rgba(99, 102, 241, 0.6)',
                    'rgba(139, 92, 246, 0.6)',
                    'rgba(16, 185, 129, 0.6)',
                    'rgba(245, 158, 11, 0.6)',
                    'rgba(239, 68, 68, 0.6)',
                    'rgba(59, 130, 246, 0.6)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { display: false } }
            },
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94A3B8', font: { size: 10 } } },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 11 },
                    formatter: (value) => value > 0 ? value : '',
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    borderRadius: 4,
                    padding: 4
                }
            }
        }
    });
}

// ==========================================
// VIEW: Meu Desempenho
// ==========================================
// Global chart instances for individual performance
let meuSemaforoChartInst = null;
let meuRadarChartInst = null;
let meuWeeklyChartInst = null;

function renderMeuDesempenho() {
    if (!LOGGED_USER) return;

    // Personalizar título com nome do usuário para reforçar a identidade visual do painel individual
    const headerTitle = document.querySelector('#view-meu-desempenho .section-header h1');
    if (headerTitle) {
        headerTitle.innerHTML = `Meu Desempenho <span style="font-weight: 300; opacity: 0.6; font-size: 1.1rem; margin-left: 10px;">| ${LOGGED_USER.nome}</span>`;
    }

    let myExecs = Store.getExecucoesWithDetails(LOGGED_USER.nome);
    if (currentCompetencia) {
        myExecs = myExecs.filter(e => e.competencia === currentCompetencia);
    }

    // Cálculos de KPIs
    const total = myExecs.length;
    const concluidas = myExecs.filter(e => e.feito).length;
    const vencendo = myExecs.filter(e => !e.feito && e.semaforo === 'yellow').length;
    const atrasadas = myExecs.filter(e => !e.feito && e.semaforo === 'red').length;

    // Novo KPI: Score de Eficiência
    // Consideramos eficientes as tarefas concluídas (feito === true)
    // Se quisermos ser mais rigorosos, poderíamos checar se foi feito antes ou no prazo.
    const scoreEficiencia = total > 0 ? Math.round((concluidas / total) * 100) : 0;

    animateValue('kpi-meu-total', parseInt(document.getElementById('kpi-meu-total').innerText) || 0, total, 800);
    animateValue('kpi-meu-done', parseInt(document.getElementById('kpi-meu-done').innerText) || 0, concluidas, 800);
    animateValue('kpi-meu-warning', parseInt(document.getElementById('kpi-meu-warning').innerText) || 0, vencendo, 800);
    animateValue('kpi-meu-late', parseInt(document.getElementById('kpi-meu-late').innerText) || 0, atrasadas, 800);
    animateValue('kpi-meu-score', parseInt(document.getElementById('kpi-meu-score').innerText) || 0, scoreEficiencia, 800);
    document.getElementById('kpi-meu-score').innerHTML = scoreEficiencia + '<span style="font-size:0.8rem; margin-left:2px;">%</span>';

    // 1. Gráfico de Saúde (Doughnut)
    const ctxSemaforo = document.getElementById('meuSemaforoChart');
    if (meuSemaforoChartInst) meuSemaforoChartInst.destroy();

    const noPrazo = total - concluidas - vencendo - atrasadas;
    const semaforoData = [concluidas, noPrazo > 0 ? noPrazo : 0, vencendo, atrasadas];
    if (semaforoData.every(d => d === 0)) semaforoData[0] = 0.1;

    meuSemaforoChartInst = new Chart(ctxSemaforo, {
        type: 'doughnut',
        data: {
            labels: ['Concluída', 'No Prazo', 'Vencendo Hoje', 'Atrasada'],
            datasets: [{
                data: semaforoData,
                backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            cutout: '75%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94A3B8', font: { size: 11 } } },
                datalabels: { display: false }
            }
        }
    });

    // 2. Gráfico de Setores (Radar)
    const ctxRadar = document.getElementById('meuRadarChart');
    if (meuRadarChartInst) meuRadarChartInst.destroy();

    const setoresMap = {};
    myExecs.forEach(e => {
        const s = e.setor || "Geral";
        setoresMap[s] = (setoresMap[s] || 0) + 1;
    });

    const radarLabels = Object.keys(setoresMap);
    const radarValues = Object.values(setoresMap);

    meuRadarChartInst = new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: radarLabels,
            datasets: [{
                label: 'Carga por Setor',
                data: radarValues,
                fill: true,
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                borderColor: '#8B5CF6',
                pointBackgroundColor: '#8B5CF6',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#8B5CF6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255,255,255,0.1)' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    pointLabels: { color: '#94A3B8', font: { size: 10 } },
                    ticks: { display: false, stepSize: 1 }
                }
            },
            plugins: {
                legend: { display: false },
                datalabels: { display: false }
            }
        }
    });

    // 3. Gráfico Semanal (Line)
    const ctxWeekly = document.getElementById('meuWeeklyChart');
    if (meuWeeklyChartInst) meuWeeklyChartInst.destroy();

    // Mock/Cálculo de produtividade dos últimos 7 dias
    const last7Days = [];
    const last7DaysLabels = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7DaysLabels.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }));

        const dStr = d.toISOString().split('T')[0];
        const count = myExecs.filter(e => e.feito && e.feitoEm === dStr).length;
        last7Days.push(count);
    }

    meuWeeklyChartInst = new Chart(ctxWeekly, {
        type: 'line',
        data: {
            labels: last7DaysLabels,
            datasets: [{
                label: 'Entregas',
                data: last7Days,
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: '#10B981'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 10 } } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8', font: { size: 10 }, stepSize: 1 } }
            },
            plugins: {
                legend: { display: false },
                datalabels: { display: false }
            }
        }
    });

    // 4. Minhas Próximas Entregas (Prioridade)
    const pending = myExecs.filter(e => !e.feito).sort((a, b) => new Date(a.diaPrazo) - new Date(b.diaPrazo)).slice(0, 10);
    const tbody = document.querySelector('#minhas-proximas-table tbody');
    tbody.innerHTML = '';

    if (pending.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2.5rem; color: var(--success);">
            <i class="fa-solid fa-circle-check fa-3x" style="margin-bottom:1rem; opacity:0.5;"></i><br/>
            Excelente! Você não tem pendências para este período.
        </td></tr>`;
    } else {
        pending.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${p.clientName}</strong></td>
                <td><span class="resp-tag">${p.rotina}</span></td>
                <td>${formatDate(p.diaPrazo)}</td>
                <td><span class="status-badge ${p.semaforo === 'red' ? 'atrasado' : (p.semaforo === 'yellow' ? 'hoje' : 'noprazo')}">${p.statusAuto}</span></td>
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
    const sortVal = document.getElementById('operacional-sort')?.value || 'prazo-asc';

    if (searchVal) {
        tasks = tasks.filter(t =>
            t.rotina.toLowerCase().includes(searchVal) ||
            t.clientName.toLowerCase().includes(searchVal)
        );
    }

    // Apply Sorting
    tasks.sort((a, b) => {
        switch (sortVal) {
            case 'prazo-asc':
                return new Date(a.diaPrazo) - new Date(b.diaPrazo);
            case 'prazo-desc':
                return new Date(b.diaPrazo) - new Date(a.diaPrazo);
            case 'cliente-az':
                return a.clientName.localeCompare(b.clientName, 'pt-BR');
            case 'cliente-za':
                return b.clientName.localeCompare(a.clientName, 'pt-BR');
            case 'rotina-az':
                return a.rotina.localeCompare(b.rotina, 'pt-BR');
            default:
                return new Date(a.diaPrazo) - new Date(b.diaPrazo);
        }
    });

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

    // Capturar quais grupos estão atualmente abertos (não collapsed) antes de re-renderizar
    // Isso preserva o estado quando o usuário abre uma lista com >10 clientes e executa uma tarefa
    container.querySelectorAll('.routine-group[data-rotina]').forEach(g => {
        const content = g.querySelector('.routine-group-content');
        const rotinaKey = g.getAttribute('data-rotina');
        if (content && !content.classList.contains('collapsed')) {
            operacionalGruposAbertos.add(rotinaKey);
        } else if (content && content.classList.contains('collapsed')) {
            operacionalGruposAbertos.delete(rotinaKey);
        }
    });

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

    // Definir ordem dos grupos baseada na ordenação das tarefas
    const groupOrder = [];
    tasks.forEach(t => {
        if (!groupOrder.includes(t.rotina)) groupOrder.push(t.rotina);
    });

    // Adicionar rotinas que não possuem tarefas no momento (para manter visibilidade se não houver busca)
    if (!searchVal) {
        Store.getData().rotinasBase.forEach(rb => {
            if (!groupOrder.includes(rb.nome)) groupOrder.push(rb.nome);
        });

        // Se a ordenação for por Rotina, ordenar a lista final de grupos
        if (sortVal === 'rotina-az') {
            groupOrder.sort((a, b) => a.localeCompare(b, 'pt-BR'));
        }
    }

    groupOrder.forEach(rotinaName => {
        const groupTasks = grouped[rotinaName] || [];
        if (groupTasks.length === 0 && searchVal) return; // Ocultar grupos vazios na busca
        if (groupTasks.length === 0 && !groupOrder.includes(rotinaName)) return; // Segurança

        groupTasks.sort((a, b) => {
            if (a.feito && !b.feito) return 1;
            if (!a.feito && b.feito) return -1;

            // Dentro do grupo, manter a ordenação selecionada se possível
            switch (sortVal) {
                case 'prazo-asc': return new Date(a.diaPrazo) - new Date(b.diaPrazo);
                case 'prazo-desc': return new Date(b.diaPrazo) - new Date(a.diaPrazo);
                case 'cliente-az': return a.clientName.localeCompare(b.clientName, 'pt-BR');
                case 'cliente-za': return b.clientName.localeCompare(a.clientName, 'pt-BR');
                default: return new Date(a.diaPrazo) - new Date(b.diaPrazo);
            }
        });

        const groupDiv = document.createElement('div');
        groupDiv.className = 'routine-group fade-in';
        groupDiv.setAttribute('data-rotina', rotinaName);
        const doneCount = groupTasks.filter(t => t.feito).length;

        // Regra de colapso:
        // - Grupos com >10 clientes começam colapsados por padrão
        // - Mas se o usuário abriu manualmente o grupo antes do re-render, mantém aberto
        const foiAbertoManualmente = operacionalGruposAbertos.has(rotinaName);
        const isCollapsed = groupTasks.length > 10 && !foiAbertoManualmente;

        let tableHtml = `
            <div class="routine-group-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="this.nextElementSibling.classList.toggle('collapsed'); this.querySelector('.chevron-icon').classList.toggle('fa-rotate-180'); var rn=this.closest('[data-rotina]').getAttribute('data-rotina'); if(this.nextElementSibling.classList.contains('collapsed')){ operacionalGruposAbertos.delete(rn); } else { operacionalGruposAbertos.add(rn); }">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-chevron-up chevron-icon ${isCollapsed ? 'fa-rotate-180' : ''}" style="transition: transform 0.3s ease; font-size: 0.8rem; color: var(--text-muted);"></i>
                    <h2><i class="fa-solid fa-layer-group"></i> ${rotinaName}</h2>
                </div>
                <span class="routine-group-badge">${doneCount}/${groupTasks.length} Entregues</span>
            </div>
            <div class="routine-group-content table-responsive ${isCollapsed ? 'collapsed' : ''}" style="transition: all 0.3s ease;">
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
                        <td>
                            <strong>${t.clientName}</strong><br>
                            <small style="color:var(--text-muted); font-size:0.7rem;">${t.cnpj}</small>
                        </td>
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

    // Atualizar KPIs
    animateValue('kpi-total-clientes', 0, stats.total, 600);
    animateValue('kpi-inativos', 0, stats.inativos, 600);
    animateValue('kpi-simples', 0, stats.simples, 600);
    animateValue('kpi-presumido', 0, stats.presumido, 600);
    animateValue('kpi-real', 0, stats.real, 600);
    animateValue('kpi-mei', 0, stats.mei, 600);

    // Capturar filtros de pesquisa e ordenação
    const searchInput = document.getElementById('clientes-search');
    const sortSelect = document.getElementById('clientes-sort');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const sortMode = sortSelect ? sortSelect.value : 'recente';

    const tbody = document.querySelector('#clients-table tbody');
    tbody.innerHTML = '';

    const isOperacional = LOGGED_USER && LOGGED_USER.permissao.toLowerCase() === 'operacional';

    // Esconder botão Novo Cliente para operacional
    const btnAddClient = document.getElementById('btn-add-client');
    if (btnAddClient) {
        btnAddClient.style.display = isOperacional ? 'none' : 'inline-block';
    }


    if (clients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 3rem;">Nenhum cliente cadastrado.</td></tr>`;
        return;
    }

    // Filtrar por pesquisa
    let filtered = [...clients];
    if (searchTerm) {
        filtered = filtered.filter(c => {
            const razao = (c.razaoSocial || '').toLowerCase();
            const cnpj = (c.cnpj || '').toLowerCase();
            const codigo = (c.codigo || '').toLowerCase();
            const responsavel = (c.responsavelFiscal || '').toLowerCase();
            return razao.includes(searchTerm) || cnpj.includes(searchTerm) || codigo.includes(searchTerm) || responsavel.includes(searchTerm);
        });
    }

    // Ordenar conforme a opção selecionada
    switch (sortMode) {
        case 'az':
            filtered.sort((a, b) => (a.razaoSocial || '').localeCompare(b.razaoSocial || '', 'pt-BR'));
            break;
        case 'za':
            filtered.sort((a, b) => (b.razaoSocial || '').localeCompare(a.razaoSocial || '', 'pt-BR'));
            break;
        case 'codigo-asc':
            filtered.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', 'pt-BR', { numeric: true }));
            break;
        case 'codigo-desc':
            filtered.sort((a, b) => (b.codigo || '').localeCompare(a.codigo || '', 'pt-BR', { numeric: true }));
            break;
        case 'recente':
            filtered.sort((a, b) => b.id - a.id);
            break;
        case 'antigo':
            filtered.sort((a, b) => a.id - b.id);
            break;
        case 'regime':
            filtered.sort((a, b) => (a.regime || '').localeCompare(b.regime || '', 'pt-BR'));
            break;
        default:
            filtered.sort((a, b) => b.id - a.id);
    }

    // Mensagem de nenhum resultado encontrado
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 3rem; color: var(--text-muted);">
            <i class="fa-solid fa-search" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block; opacity: 0.5;"></i>
            Nenhum cliente encontrado para "<strong>${searchTerm}</strong>"
        </td></tr>`;
        return;
    }

    filtered.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = 'fade-in client-row-clickable';
        tr.dataset.id = c.id;

        const isSimples = c.regime === 'Simples Nacional' || c.regime === 'MEI';

        // Coluna de Status com Toggle Compacto
        const statusToggleHtml = `
            <div style="display: flex; align-items: center; justify-content: center;">
                <label class="custom-toggle" title="${isOperacional ? 'Permissão apenas para visualização' : 'Alterar status de ' + c.razaoSocial}" style="${isOperacional ? 'cursor: not-allowed; opacity: 0.6;' : ''}">
                    <input type="checkbox" onchange="toggleClientStatus(${c.id}, this.checked)" ${c.ativo !== false ? 'checked' : ''} ${isOperacional ? 'disabled' : ''}>
                    <span class="toggle-slider"></span>
                    <span class="toggle-label" style="font-size: 0.7rem;">Ativo</span>
                </label>
            </div>
        `;

        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="client-checkbox custom-checkbox" value="${c.id}">
            </td>
            <td class="clickable-cell" onclick="openClientDetail(${c.id})" style="cursor: pointer; color: var(--primary-light); font-weight: 700; width: 80px;">
                ${c.codigo || 'S/C'}
            </td>
            <td class="clickable-cell" onclick="openClientDetail(${c.id})" style="cursor: pointer;">
                <span style="font-weight: 600; color: var(--text-main); text-decoration: underline; text-underline-offset: 4px; text-decoration-color: rgba(255,255,255,0.1); font-size: 0.9rem;">${c.razaoSocial}</span>
            </td>
            <td style="font-size: 0.8rem; color: var(--text-muted); opacity: 0.7; width: 140px;">${c.cnpj}</td>
            <td><span class="status-badge noprazo" style="font-size: 0.7rem; padding: 2px 8px;">${c.regime}</span></td>
            <td style="text-align: center;">
                ${c.driveLink ? `
                <a href="${c.driveLink}" target="_blank" class="btn-action-drive" title="Abrir Google Drive de ${c.razaoSocial}" style="color: #34A853; font-size: 1.1rem; transition: transform 0.2s;">
                    <i class="fa-brands fa-google-drive"></i>
                </a>
                ` : `
                <i class="fa-brands fa-google-drive" title="Drive não configurado" style="color: var(--text-muted); opacity: 0.3; font-size: 1.1rem;"></i>
                `}
            </td>
            <td style="width: 110px;">${statusToggleHtml}</td>
            <td style="white-space: nowrap; width: 60px;">
                <div class="btn-action-container">
                    ${isOperacional ? '' : `
                    <button class="btn btn-small btn-secondary btn-delete-single-client" data-id="${c.id}" style="color: var(--danger); background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.1); padding: 5px 8px; font-size: 0.75rem;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    `}
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    setupClientCheckboxes();

    // Eventos de exclusão individual
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


// Controle de Loading Global
function showLoading(title = 'Processando...', message = 'Por favor, aguarde um momento.') {
    const overlay = document.getElementById('global-loading-overlay');
    const titleEl = document.getElementById('loading-title');
    const msgEl = document.getElementById('loading-message');

    if (overlay && titleEl && msgEl) {
        titleEl.textContent = title;
        msgEl.textContent = message;
        overlay.classList.add('active');
    }
}

function hideLoading() {
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// Controle do Overlay de Celebração (Early Release)
function showSuccessOverlay(title = 'Parabéns!', message = 'Você concluiu a competência antecipadamente.') {
    const overlay = document.getElementById('success-overlay');
    const titleEl = document.getElementById('success-overlay-title');
    const msgEl = document.getElementById('success-overlay-message');

    if (overlay && titleEl && msgEl) {
        titleEl.textContent = title;
        msgEl.textContent = message;
        // The display logic is flex by default, but hidden with opacity
        overlay.style.pointerEvents = 'all';
        overlay.style.opacity = '1';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            hideSuccessOverlay();
        }, 5000);
    }
}

function hideSuccessOverlay() {
    const overlay = document.getElementById('success-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
    }
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

    const isOperacional = LOGGED_USER && LOGGED_USER.permissao.toLowerCase() === 'operacional';

    // Bloquear campos para operacional
    const form = document.getElementById('add-client-form');
    if (form) {
        const elements = form.querySelectorAll('input, select, textarea');
        elements.forEach(el => {
            el.disabled = isOperacional;
        });
    }

    if (submitBtn) {
        submitBtn.style.display = isOperacional ? 'none' : 'inline-block';
    }


    // Load Rotinas for checklist
    const rotinasGrid = document.getElementById('rotinas-checkbox-grid');
    if (rotinasGrid) {
        rotinasGrid.innerHTML = '';
        Store.getData().rotinasBase.forEach(r => {
            rotinasGrid.innerHTML += `
                <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-main); cursor:pointer;">
                    <input type="checkbox" name="rotina-sel" id="rotina-cb-${r.id}" value="${r.id}" class="custom-checkbox client-rotina-checkbox" ${isOperacional ? 'disabled' : ''}>
                    ${r.nome}
                </label>
            `;
        });
    }

    // Status Toggle Setup
    const statusContainer = document.getElementById('client-status-container');
    const statusToggle = document.getElementById('client-ativo');
    const statusLabel = document.getElementById('client-status-label');

    if (statusToggle) {
        statusToggle.onchange = () => {
            statusLabel.textContent = statusToggle.checked ? 'Ativo' : 'Inativo';
            statusLabel.style.color = statusToggle.checked ? '#10B981' : '#EF4444';
        };
    }

    if (id) {
        const cliente = Store.getData().clientes.find(c => c.id === id);
        if (cliente) {
            title.innerHTML = isOperacional ? 'Ficha do Cliente (Consulta)' : 'Ficha do Cliente';
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

            // Status
            if (statusContainer) statusContainer.style.display = 'flex';
            if (statusToggle) {
                statusToggle.checked = cliente.ativo !== false;
                statusToggle.onchange(); // Trigger label update
            }

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
        const title = document.getElementById('client-panel-title');
        const headerName = document.getElementById('client-header-name');
        const submitBtn = document.getElementById('client-modal-submit-btn');

        title.innerHTML = 'Novo Cliente';
        headerName.textContent = 'um novo cliente';
        submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Cadastrar Novo Cliente';
        document.getElementById('client-id').value = '';
        if (statusContainer) statusContainer.style.display = 'none';
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
        rotinasSelecionadasIds: Array.from(document.querySelectorAll('.client-rotina-checkbox:checked')).map(cb => parseInt(cb.value)),
        ativo: document.getElementById('client-ativo') ? document.getElementById('client-ativo').checked : true
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

/**
 * Atalho para alternar status do cliente diretamente da lista
 */
async function toggleClientStatus(id, newStatus) {
    try {
        const cliente = Store.getData().clientes.find(c => c.id === id);
        if (cliente) {
            await Store.editClient(id, { ...cliente, ativo: newStatus, rotinasSelecionadasIds: cliente.rotinasSelecionadas || [] });
            showFeedbackToast(`Status de ${cliente.razaoSocial} alterado para ${newStatus ? 'Ativo' : 'Inativo'}.`, 'success');
            // Refresh counts and dashboard if needed
            renderDashboard();
        }
    } catch (e) {
        console.error("Erro ao alternar status:", e);
        showFeedbackToast("Erro ao atualizar status.", "error");
    }
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
            (r.frequencia === 'Anual' ? `${r.diaPrazoPadrao}` : `${r.diaPrazoPadrao} d.c.`);

        // Lista de clientes vinculados em uma só linha
        const clientesVinculados = clientes
            .filter(c => c.rotinasSelecionadas && c.rotinasSelecionadas.includes(r.id))
            .map(c => c.razaoSocial)
            .join(", ") || "Nenhum cliente";

        // Responsáveis (já vem como string separada por vírgula da Store)
        const responsaveisText = r.responsavel || "Automático";

        const tr = document.createElement('tr');
        tr.className = 'fade-in';
        const isOperacional = LOGGED_USER && LOGGED_USER.permissao.toLowerCase() === 'operacional';
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
                <div class="btn-action-container">
                    ${isOperacional ? '' : `
                    <button class="btn btn-small btn-secondary btn-edit" onclick="openRotinaModal(${r.id})">
                        <i class="fa-solid fa-pen"></i> Editar
                    </button>
                    <button class="btn btn-small btn-secondary btn-delete" onclick="handleDeleteRotina(${r.id}, this)" style="color: var(--danger); background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2);">
                        <i class="fa-solid fa-trash"></i> Excluir
                    </button>
                    `}
                </div>
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

    const isOperacional = LOGGED_USER && LOGGED_USER.permissao.toLowerCase() === 'operacional';
    const respGrid = document.getElementById('rotina-responsavel-grid');
    if (respGrid) {
        respGrid.innerHTML = '';
        Store.getData().funcionarios.forEach(f => {
            respGrid.innerHTML += `
                <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-main); cursor:pointer;">
                    <input type="checkbox" name="responsavel-sel" value="${f.nome}" class="custom-checkbox resp-checkbox" ${isOperacional ? 'disabled' : ''}>
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

    // Dynamic loading of Clientes checkboxes with sorting
    const sortMode = document.getElementById('sort-clientes-rotina')?.value || 'az';
    renderRoutineClientsGrid(sortMode, id);

    const saveBtn = document.getElementById('btn-save-rotina-detail');
    if (saveBtn) saveBtn.style.display = isOperacional ? 'none' : 'inline-block';
    const resetChecklistBtn = document.getElementById('btn-add-checklist-item');
    if (resetChecklistBtn) resetChecklistBtn.style.display = isOperacional ? 'none' : 'inline-block';

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

    // Garantir que a lista de clientes esteja aberta e o chevron correto
    const grid = document.getElementById('clientes-checkbox-grid');
    const icon = document.getElementById('icon-cli');
    if (grid && icon) {
        grid.style.display = 'grid';
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    }
}

/**
 * Renderiza a grid de clientes no modal de rotinas com suporte a ordenação
 */
function renderRoutineClientsGrid(sortMode = 'az', rotinaId = null) {
    const clientesGrid = document.getElementById('clientes-checkbox-grid');
    if (!clientesGrid) return;

    let clientes = [...Store.getData().clientes];
    const isOperacional = LOGGED_USER && LOGGED_USER.permissao.toLowerCase() === 'operacional';

    // Aplicar Ordenação
    clientes.sort((a, b) => {
        if (sortMode === 'az') return a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR');
        if (sortMode === 'za') return b.razaoSocial.localeCompare(a.razaoSocial, 'pt-BR');
        if (sortMode === 'regime') return (a.regime || '').localeCompare(b.regime || '', 'pt-BR');
        return 0;
    });

    // Guardar estados atuais dos checkboxes para não perder ao re-renderizar por ordenação
    const selectedIds = Array.from(document.querySelectorAll('input[name="cliente-sel"]:checked')).map(cb => parseInt(cb.value));

    // Se for abertura inicial de uma rotina existente, marcar os já vinculados se selectedIds estiver vazio
    const finalSelectedIds = (selectedIds.length === 0 && rotinaId)
        ? clientes.filter(c => c.rotinasSelecionadas && c.rotinasSelecionadas.includes(rotinaId)).map(c => c.id)
        : selectedIds;

    clientesGrid.innerHTML = '';
    clientes.forEach(c => {
        const isChecked = finalSelectedIds.includes(c.id);
        clientesGrid.innerHTML += `
            <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-main); cursor:pointer;">
                <input type="checkbox" name="cliente-sel" id="cliente-cb-${c.id}" value="${c.id}" class="custom-checkbox" 
                    ${isOperacional ? 'disabled' : ''} ${isChecked ? 'checked' : ''}>
                <div>
                    <strong>${c.razaoSocial}</strong><br>
                    <small style="opacity:0.6; font-size:0.7rem;">${c.regime || 'Não Informado'}</small>
                </div>
            </label>
        `;
    });
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

    // Validação de campos obrigatórios
    if (!nome.trim()) {
        showNotify("Campo Obrigatório", "O campo 'Nome da Rotina' é obrigatório.", "warning");
        document.getElementById('rotina-nome').focus();
        return;
    }
    if (!setor.trim()) {
        showNotify("Campo Obrigatório", "O campo 'Setor' é obrigatório.", "warning");
        document.getElementById('rotina-setor').focus();
        return;
    }
    if (!prazo.trim()) {
        showNotify("Campo Obrigatório", "O campo 'Prazo' é obrigatório.", "warning");
        document.getElementById('rotina-prazo').focus();
        return;
    }
    if (!responsavel) {
        showNotify("Atenção", "Selecione ao menos um responsável pela rotina.", "warning");
        return;
    }

    // Validações conforme o tipo de frequência
    if (frequencia === 'Mensal' && (isNaN(prazo) || prazo < 1 || prazo > 31)) {
        showNotify("Valor Inválido", "Para rotinas mensais, preencha um dia válido de 1 a 31.", "warning");
        return;
    }
    if (frequencia === 'Anual' && !prazo.includes('/')) {
        showNotify("Valor Inválido", "Para rotinas anuais, preencha a data no formato DD/MM.", "warning");
        return;
    }
    if (frequencia === 'Eventual' && (isNaN(prazo) || parseInt(prazo) < 1)) {
        showNotify("Valor Inválido", "Para rotinas eventuais, preencha um número de dias válido (mínimo: 1).", "warning");
        return;
    }

    showLoading('Salvando Rotina', 'Processando vinculação de clientes e gerando tarefas...');

    try {
        if (id) {
            await Store.editRotinaBase(id, nome, setor, frequencia, prazo, currentChecklistBuilder, selectedClientIds, responsavel);
        } else {
            await Store.addRotinaBase(nome, setor, frequencia, prazo, currentChecklistBuilder, selectedClientIds, responsavel);
        }

        renderRotinas();
        renderOperacional();
        renderDashboard();

        closeRotinaModal();
    } catch (error) {
        console.error("Erro ao salvar rotina:", error);
        showNotify("Erro", "Ocorreu um erro ao salvar a rotina. Tente novamente.", "error");
    } finally {
        hideLoading();
    }
}



async function handleDeleteRotina(id, btnElement = null) {
    const rotina = Store.getData().rotinasBase.find(r => r.id === id);
    if (!rotina) return;

    if (confirm(`Atenção: Tem certeza que deseja EXCLUIR a rotina '${rotina.nome}'? Isso a removerá da base de rotinas disponíveis.`)) {
        // Efeito visual no ícone antes de sumir
        if (btnElement) {
            const icon = btnElement.querySelector('i');
            if (icon) icon.classList.add('delete-pop');
        }

        showLoading('Excluindo Rotina', `Removendo '${rotina.nome}' e todas as tarefas vinculadas...`);

        try {
            // Pequeno delay para a animação aparecer antes da remoção
            await new Promise(resolve => setTimeout(resolve, 500));
            await Store.deleteRotinaBase(id);
            renderRotinas();
            // alert(`Rotina '${rotina.nome}' excluída com sucesso!`); // Alert opcional, UI já some
        } catch (error) {
            console.error(error);
            showNotify("Erro", "Ocorreu um erro ao excluir a rotina. Verifique o console.", "error");
        } finally {
            hideLoading();
        }
    }
}


// ==========================================
// VIEW: Gestão de Competências (Admin) 
// ==========================================

function renderCompetenciasAdmin() {
    const tbody = document.querySelector('#competencias-admin-table tbody');
    const totalKpi = document.getElementById('kpi-total-comp-admin');
    const activeKpi = document.getElementById('kpi-active-comp-admin');

    if (!tbody) return;

    tbody.innerHTML = '';

    const meses = Store.getData().meses || [];

    if (totalKpi) totalKpi.textContent = meses.length;

    const ativo = meses.find(m => m.ativo);
    if (activeKpi) activeKpi.textContent = ativo ? ativo.mes : 'Nenhum';

    if (meses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">Nenhuma competência registrada no sistema.</td></tr>`;
        return;
    }

    // Sort descending by ID (YYYY-MM)
    const sortedMeses = [...meses].sort((a, b) => b.id.localeCompare(a.id));

    sortedMeses.forEach(m => {
        const tr = document.createElement('tr');

        let statusBadge = m.ativo
            ? `<span class="badge" style="background:var(--success); color:#fff; border:none; white-space:nowrap;"><i class="fa-solid fa-check-circle"></i> Mês Ativo</span>`
            : `<span class="badge" style="white-space:nowrap;"><i class="fa-solid fa-lock"></i> Histórico / Futuro</span>`;

        tr.innerHTML = `
            <td><strong style="color:var(--text-light);">${m.id}</strong></td>
            <td>${m.mes}</td>
            <td>${statusBadge}</td>
            <td>
                <div style="font-size: 0.8rem; color:var(--text-muted); white-space:nowrap;">
                    Tarefas: ${m.total_execucoes || 0} <br>
                    Concluído: ${m.percent_concluido || 0}%
                </div>
            </td>
            <td style="text-align: right;">
                <button class="btn btn-outline btn-delete-comp" data-id="${m.id}" style="border-color:var(--danger); color:var(--danger); padding:0.4rem 0.8rem;" ${m.ativo ? 'disabled title="Não é possível apagar o mês atual"' : ''}>
                    <i class="fa-solid fa-trash"></i> Apagar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Attach Delete Events
    document.querySelectorAll('.btn-delete-comp').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const modal = document.getElementById('modal-delete-competencia');
            const hiddenId = document.getElementById('delete-comp-id');
            const msgEl = document.getElementById('delete-comp-msg');

            if (modal && hiddenId && msgEl) {
                hiddenId.value = id;
                msgEl.innerHTML = `Você está prestes a apagar a competência <strong>${id}</strong> inteira, junto com todas as tarefas vinculadas a ela. Esta é uma ação destrutiva irreversível.`;
                modal.style.display = 'flex';
                // Trigger CSS transitions
                setTimeout(() => modal.classList.add('active'), 10);
            }
        });
    });
}

function closeDeleteCompetenciaModal() {
    const modal = document.getElementById('modal-delete-competencia');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
        document.getElementById('delete-comp-id').value = '';

        // Reset button state
        const submitBtn = document.getElementById('btn-confirm-delete-comp');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir';
        }
    }
}

// ==========================================
// CONFIG: Menu Reordering Logic
// ==========================================

function renderMenuReorderList() {
    const listContainer = document.getElementById('menu-reorder-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    // Pegar todos os itens do menu (conforme estão no DOM agora)
    const navItems = Array.from(document.querySelectorAll('.sidebar .nav-item'));

    navItems.forEach(item => {
        const view = item.getAttribute('data-view');
        if (!view || view === 'settings') return; // Settings sempre fica embaixo

        const label = item.querySelector('span').textContent;
        const iconClass = item.querySelector('i').className;

        const div = document.createElement('div');
        div.className = 'reorder-item';
        div.draggable = true;
        div.setAttribute('data-view', view);
        div.innerHTML = `
            <i class="${iconClass}"></i>
            <span>${label}</span>
            <i class="fa-solid fa-grip-vertical drag-handle"></i>
        `;

        // Drag events
        div.addEventListener('dragstart', () => div.classList.add('dragging'));
        div.addEventListener('dragend', () => div.classList.remove('dragging'));

        listContainer.appendChild(div);
    });

    listContainer.addEventListener('dragover', e => {
        e.preventDefault();
        const draggingItem = document.querySelector('.dragging');
        const siblings = [...listContainer.querySelectorAll('.reorder-item:not(.dragging)')];

        const nextSibling = siblings.find(sibling => {
            return e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2;
        });

        listContainer.insertBefore(draggingItem, nextSibling);
    });
}

async function saveMenuOrder() {
    const listContainer = document.getElementById('menu-reorder-list');
    if (!listContainer) return;

    const items = listContainer.querySelectorAll('.reorder-item');
    const newOrder = Array.from(items).map(i => i.getAttribute('data-view'));

    // Always keep settings at the end
    newOrder.push('settings');

    showLoading('Salvando Ordem', 'Atualizando layout do menu lateral...');

    const config = Store.getData().config || {};
    config.menuOrder = newOrder;

    // Sincronizar com formato do banco (snake_case)
    const success = await Store.updateGlobalConfig({
        ...config,
        menu_order: newOrder
    });
    hideLoading();

    if (success) {
        // Re-apply immediately
        applyUserPermissions(LOGGED_USER);
        showNotify("Sucesso", "Ordem do menu salva com sucesso!", "success");
    } else {
        showNotify("Erro", "Erro ao salvar ordem do menu.", "error");
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

    const unreadTotal = Store.getUnreadCount(LOGGED_USER.nome);
    const unreadInbox = Store.getUnreadInboxCount(LOGGED_USER.nome);
    const unreadSystem = Store.getUnreadSystemCount(LOGGED_USER.nome);

    // Global Topbar Badge
    const badges = document.querySelectorAll('.badge');
    badges.forEach(b => {
        // Only update the global topbar notification badge here
        if (b.parentElement.id === 'btn-notification') {
            if (unreadTotal > 0) {
                b.textContent = unreadTotal;
                b.style.display = 'flex';
            } else {
                b.style.display = 'none';
            }
        }
    });

    // Sidebar Inbox Badge (Caixa de Entrada)
    const inboxBadge = document.getElementById('inbox-unread-badge');
    if (inboxBadge) {
        if (unreadInbox > 0) {
            inboxBadge.style.display = 'block';
            inboxBadge.textContent = unreadInbox;
        } else {
            inboxBadge.style.display = 'none';
        }
    }

    // Sidebar System Badge (Alertas do Sistema)
    const systemBadge = document.getElementById('system-unread-badge');
    if (systemBadge) {
        if (unreadSystem > 0) {
            systemBadge.style.display = 'block';
            systemBadge.textContent = unreadSystem;
        } else {
            systemBadge.style.display = 'none';
        }
    }
}

let currentMsgSearch = '';

window.handleMessageSearch = function (query) {
    currentMsgSearch = query.toLowerCase();
    renderMensagens();
};

// Inicialização do inbox usando event delegation para máxima robustez
let _inboxDelegationInit = false;

function initInboxTabs() {
    // Event delegation: registrar apenas uma vez no document
    if (!_inboxDelegationInit) {
        _inboxDelegationInit = true;

        // === Delegação para pastas ===
        document.addEventListener('click', (e) => {
            // Busca o botão folder-item mais próximo a partir do clique
            const tab = e.target.closest('.folder-item[data-folder]');
            if (!tab) return;

            // Verifica se está dentro da view de mensagens
            if (!tab.closest('#view-mensagens')) return;

            const folder = tab.getAttribute('data-folder');
            document.querySelectorAll('#view-mensagens .folder-item').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const titles = {
                'inbox': 'Entrada',
                'important': 'Favoritas',
                'sent': 'Itens Enviados',
                'sent-items': 'Itens Enviados',
                'system': 'Alertas do Sistema',
                'trash': 'Lixeira',
                'office': 'Escritório',
                'clients': 'Clientes'
            };

            const nameEl = document.getElementById('inbox-folder-name');
            if (nameEl) nameEl.textContent = titles[folder] || folder;

            currentInboxFolder = folder;
            renderMensagens();
            hideInboxReader();
        });

        // === Botão Atualizar ===
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#btn-refresh-inbox-new');
            if (!btn) return;
            const icon = btn.querySelector('i');
            if (icon) icon.classList.add('fa-spin');
            setTimeout(() => {
                if (icon) icon.classList.remove('fa-spin');
                renderMensagens();
            }, 600);
        });

        // === Botão Voltar para lista ===
        document.addEventListener('click', (e) => {
            if (e.target.closest('#btn-back-to-list')) hideInboxReader();
        });

        // === Botões de Suporte ===
        document.addEventListener('click', (e) => {
            if (e.target.closest('#btn-inbox-config')) {
                showNotify("Informação", "Configurações de Mensagens em breve...", "info");
            }
            if (e.target.closest('#btn-inbox-help')) {
                showNotify("Ajuda das Mensagens", "• Clique nas pastas para navegar\n• Use ☆ para favoritar\n• Marque checkboxes para ações em massa", "info");
            }
        });

        // === Select All ===
        document.addEventListener('change', (e) => {
            if (e.target.id === 'select-all-msgs') {
                document.querySelectorAll('.msg-check').forEach(c => c.checked = e.target.checked);
                updateBulkActionsVisibility();
            }
        });

        // === Exclusão em Massa ===
        document.addEventListener('click', async (e) => {
            if (!e.target.closest('#btn-bulk-delete-msgs')) return;
            const selected = document.querySelectorAll('.msg-check:checked');
            if (selected.length === 0) return;
            if (confirm(`Excluir ${selected.length} mensagens selecionadas?`)) {
                for (let check of selected) {
                    const item = check.closest('.msg-item-refined');
                    if (item) {
                        const id = item.getAttribute('data-msg-id');
                        await Store.deleteMensagem(id, LOGGED_USER.nome);
                    }
                }
                renderMensagens();
            }
        });

        // === Marcar como Lidas em Massa ===
        document.addEventListener('click', async (e) => {
            if (!e.target.closest('#btn-bulk-read-msgs')) return;
            const selected = document.querySelectorAll('.msg-check:checked');
            if (selected.length === 0) return;
            for (let check of selected) {
                const item = check.closest('.msg-item-refined');
                if (!item) continue;
                const id = item.getAttribute('data-msg-id');
                const msg = Store.getData().mensagens.find(m => m.id == id);
                if (msg && !msg.lida) {
                    msg.lida = true;
                    try {
                        await fetch(`${API_BASE}/mensagens/${id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ lida: true })
                        });
                    } catch (e) { }
                }
            }
            renderMensagens();
        });
    }
}

function updateBulkActionsVisibility() {
    const selectedCount = document.querySelectorAll('.msg-check:checked').length;
    const bulkDelete = document.getElementById('btn-bulk-delete-msgs');
    const bulkRead = document.getElementById('btn-bulk-read-msgs');
    if (bulkDelete) bulkDelete.style.display = selectedCount > 0 ? 'inline-flex' : 'none';
    if (bulkRead) bulkRead.style.display = selectedCount > 0 ? 'inline-flex' : 'none';
}

function renderMensagens() {
    // Reset bulk actions visibility
    updateBulkActionsVisibility();
    const selectAllCheck = document.getElementById('select-all-msgs');
    if (selectAllCheck) selectAllCheck.checked = false;

    const container = document.getElementById('mensagens-container');
    if (!LOGGED_USER) return;

    let msgs = [];
    if (currentInboxFolder === 'inbox') {
        msgs = Store.getMensagensPara(LOGGED_USER.nome).filter(m => m.remetente !== 'Sistema');
    } else if (currentInboxFolder === 'important') {
        // Filtra mensagens favoritas que não foram excluídas pelo usuário
        msgs = Store.getData().mensagens.filter(m =>
            m.favorito &&
            (m.destinatario === LOGGED_USER.nome || m.remetente === LOGGED_USER.nome) &&
            !(m.excluidoPor || []).includes(LOGGED_USER.nome)
        ).sort((a, b) => new Date(b.data) - new Date(a.data));
    } else if (currentInboxFolder === 'sent') {
        msgs = Store.getMensagensEnviadas(LOGGED_USER.nome);
    } else if (currentInboxFolder === 'system') {
        msgs = Store.getMensagensPara(LOGGED_USER.nome).filter(m => m.remetente === 'Sistema');
    } else if (currentInboxFolder === 'trash') {
        msgs = Store.getData().mensagens.filter(m =>
            (m.excluidoPor || []).includes(LOGGED_USER.nome) && (m.destinatario === LOGGED_USER.nome || m.remetente === LOGGED_USER.nome)
        ).sort((a, b) => new Date(b.data) - new Date(a.data));
    }

    // Filtro de Busca (protege contra campos undefined)
    if (currentMsgSearch) {
        msgs = msgs.filter(m =>
            (m.assunto || '').toLowerCase().includes(currentMsgSearch) ||
            (m.texto || '').toLowerCase().includes(currentMsgSearch) ||
            (m.remetente || '').toLowerCase().includes(currentMsgSearch)
        );
    }

    container.innerHTML = '';

    if (msgs.length === 0) {
        container.innerHTML = `
            <div style="padding: 3rem 2rem; text-align: center; color: var(--text-muted); opacity: 0.5;">
                <i class="fa-solid fa-cloud" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
                <p>Nenhuma mensagem encontrada.</p>
            </div>
        `;
        updateMensagensBadges();
        return;
    }

    msgs.forEach(m => {
        const div = document.createElement('div');
        div.className = `msg-item-refined fade-in ${m.id === currentLoadedMessageId ? 'active' : ''}`;
        div.setAttribute('data-msg-id', m.id);
        if (!m.lida && m.destinatario === LOGGED_USER.nome) {
            div.classList.add('unread');
        }

        const date = new Date(m.data);
        const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const snippet = m.texto.substring(0, 50) + (m.texto.length > 50 ? '...' : '');
        const sender = currentInboxFolder === 'sent' ? m.destinatario : m.remetente;
        const initials = sender.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        div.innerHTML = `
            <div class="msg-refined-left">
                <input type="checkbox" class="msg-check" onclick="event.stopPropagation(); updateBulkActionsVisibility()">
                <i class="fa-solid fa-star msg-star ${m.favorito ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorito(${m.id})"></i>
            </div>
            <div class="msg-refined-avatar">${initials}</div>
            <div class="msg-refined-content">
                <div class="msg-content-top">
                    <span class="msg-sender-name">${sender}</span>
                    <span class="msg-time">${timeStr}</span>
                </div>
                <div class="msg-content-mid">
                    <h4 class="msg-subject-line">${m.assunto || 'Sem Assunto'}</h4>
                </div>
                <div class="msg-content-bot">
                    <p class="msg-preview-line">${snippet}</p>
                    <div class="msg-item-indicators">
                        ${m.anexos ? '<i class="fa-solid fa-paperclip"></i>' : ''}
                    </div>
                </div>
            </div>
        `;

        div.onclick = () => loadMessageIntoReader(m.id);
        container.appendChild(div);
    });

    // Update pagination info if needed
    const countInfo = document.getElementById('msgs-count-info');
    if (countInfo) countInfo.textContent = msgs.length > 0 ? `1 - ${msgs.length} de ${msgs.length}` : '0 - 0 de 0';

    updateMensagensBadges();
}

window.toggleFavorito = async function (id) {
    const msg = Store.getData().mensagens.find(m => m.id == id);
    if (msg) {
        msg.favorito = !msg.favorito;
        await Store.toggleFavorito(id, msg.favorito);
        renderMensagens();
    }
};

function loadMessageIntoReader(id) {
    const msg = Store.getData().mensagens.find(m => m.id == id);
    if (!msg) return;

    currentLoadedMessageId = id;

    // Se estiver lendo algo não lido do inbox ou system, marca como lida
    if ((currentInboxFolder === 'inbox' || currentInboxFolder === 'system') && !msg.lida) {
        Store.markMensagemLida(id);
        updateMensagensBadges();
    }

    // UI Feedback na lista - selecionar item ativo por ID
    document.querySelectorAll('.msg-item-refined').forEach(el => {
        el.classList.remove('active');
        if (el.getAttribute('data-msg-id') == id) {
            el.classList.add('active');
            el.classList.remove('unread');
        }
    });

    document.querySelector('.empty-reader-state').style.display = 'none';
    const reader = document.querySelector('.reader-content-refined');
    reader.style.display = 'flex';

    // Refresh animation
    reader.classList.remove('fade-in');
    void reader.offsetWidth;
    reader.classList.add('fade-in');

    const subjectStr = msg.assunto || 'Sem Assunto';
    document.getElementById('reader-subject').textContent = subjectStr;

    // Avatar text (iniciais)
    const senderName = msg.remetente || 'S';
    document.getElementById('reader-avatar-text').textContent = senderName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('reader-email-text').textContent = `${senderName.toLowerCase().replace(/ /g, '.')}@fiscal.app`;

    const displayUser = currentInboxFolder === 'sent' ? `Para: ${msg.destinatario}` : msg.remetente;
    document.getElementById('reader-from').textContent = displayUser;

    const d = new Date(msg.data);
    document.getElementById('reader-date').textContent = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    // Formatar o texto em parágrafos
    const paragraphs = msg.texto.split('\n').filter(p => p.trim() !== '').map(p => `<p style="margin-bottom:1.2rem;">${p}</p>`).join('');
    document.getElementById('reader-body-content').innerHTML = paragraphs;

    // Botões de ação
    const btnReply = document.getElementById('btn-reply-msg');
    const btnDelete = document.getElementById('btn-delete-msg');

    // Só permite responder no Inbox (se não for Sistema)
    const canReply = currentInboxFolder === 'inbox' && msg.remetente !== 'Sistema';
    btnReply.style.display = canReply ? 'flex' : 'none';
    if (canReply) {
        btnReply.onclick = () => openNovaMensagemModal(msg.remetente, `Re: ${subjectStr}`);
    }

    btnDelete.style.display = currentInboxFolder === 'trash' ? 'none' : 'flex';
    btnDelete.onclick = async () => {
        if (confirm("Deseja mesmo arquivar esta mensagem? (Ela ficará disponível na Lixeira para auditoria)")) {
            btnDelete.disabled = true;
            btnDelete.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            const success = await Store.deleteMensagem(id, LOGGED_USER.nome);
            btnDelete.disabled = false;
            btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i>';

            if (success) {
                currentLoadedMessageId = null;
                hideInboxReader();
                renderMensagens();
                showFeedbackToast("Mensagem arquivada com sucesso.", "success");
            } else {
                showFeedbackToast("Erro ao arquivar mensagem.", "error");
            }
        }
    };
}

function hideInboxReader() {
    currentLoadedMessageId = null;
    const emptyState = document.querySelector('.empty-reader-state');
    const readerContent = document.querySelector('.reader-content-refined');
    if (emptyState) emptyState.style.display = 'flex';
    if (readerContent) readerContent.style.display = 'none';
}

function openNovaMensagemModal(prefillDest = null, prefillSubj = "") {
    const select = document.getElementById('msg-destinatario');
    select.innerHTML = '';

    Store.getData().funcionarios.forEach(f => {
        select.innerHTML += `<option value="${f.nome}">${f.nome} (${f.setor})</option>`;
    });

    document.getElementById('nova-mensagem-form').reset();

    // Preencher destino e assunto se for resposta
    if (prefillDest) select.value = prefillDest;

    let subjectInput = document.getElementById('msg-assunto');

    if (prefillSubj) {
        subjectInput.value = prefillSubj;
    }

    document.getElementById('nova-mensagem-modal').classList.add('active');
}

function closeNovaMensagemModal() {
    document.getElementById('nova-mensagem-modal').classList.remove('active');
}

async function handleSendMensagem(e) {
    e.preventDefault();

    // Capturar valores ANTES de qualquer reset do form
    const dest = document.getElementById('msg-destinatario').value;
    const assunto = document.getElementById('msg-assunto').value.trim() || 'Sem Assunto';
    const texto = document.getElementById('msg-texto').value.trim();

    if (!dest) { showNotify("Atenção", "Selecione um destinatário.", "warning"); return; }
    if (!texto) { showNotify("Atenção", "Escreva uma mensagem antes de enviar.", "warning"); return; }

    await Store.sendMensagem(LOGGED_USER.nome, dest, texto, assunto);

    closeNovaMensagemModal();
    triggerPaperPlaneAnimation();
    mostrarAnimacaoMensagemEnviada();

    setTimeout(() => {
        if (currentInboxFolder === 'sent') renderMensagens();
    }, 1600);
}

function mostrarAnimacaoMensagemEnviada() {
    // Remover overlay anterior se existir
    const existente = document.getElementById('msg-send-overlay');
    if (existente) existente.remove();

    const overlay = document.createElement('div');
    overlay.id = 'msg-send-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 99998;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
        animation: fadeInOverlay 0.3s ease;
        pointer-events: none;
    `;

    overlay.innerHTML = `
        <style>
            @keyframes fadeInOverlay { from { opacity:0; } to { opacity:1; } }
            @keyframes fadeOutOverlay { from { opacity:1; } to { opacity:0; } }
            @keyframes popIn { from { transform: scale(0.5); opacity:0; } to { transform: scale(1); opacity:1; } }
            @keyframes flyUp { 0% { transform: translateY(0) rotate(0deg); opacity:1; } 100% { transform: translateY(-60px) rotate(-15deg); opacity:0; } }
        </style>
        <div style="text-align:center; animation: popIn 0.4s cubic-bezier(0.34,1.56,0.64,1);">
            <div style="width:80px; height:80px; background:linear-gradient(135deg,#6366f1,#8b5cf6); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; box-shadow:0 0 40px rgba(99,102,241,0.5);">
                <i class="fa-solid fa-paper-plane" style="color:#fff; font-size:2rem; animation: flyUp 1s ease 0.3s forwards;"></i>
            </div>
            <p style="color:#fff; font-size:1.1rem; font-weight:600; margin:0;">Mensagem enviada!</p>
            <p style="color:rgba(255,255,255,0.6); font-size:0.85rem; margin:0.3rem 0 0;">Seu recado foi entregue com sucesso</p>
        </div>
    `;

    document.body.appendChild(overlay);

    // Remover após 1.8s com fade out
    setTimeout(() => {
        overlay.style.animation = 'fadeOutOverlay 0.4s ease forwards';
        setTimeout(() => overlay.remove(), 400);
    }, 1400);
}


function triggerPaperPlaneAnimation() {
    const container = document.getElementById('paper-plane-container');
    if (!container) return;

    const plane = document.createElement('div');
    plane.className = 'paper-plane';
    plane.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';

    // Start position (roughly center-right where modal usually is)
    plane.style.left = '50%';
    plane.style.top = '50%';

    container.appendChild(plane);

    // Remove element after animation
    setTimeout(() => {
        plane.remove();
    }, 2000);
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

// ==========================================
// MODAL: Nova Demanda Eventual
// ==========================================

// Armazena todos os clientes para o dropdown
let _evtClientesCache = [];

function openDemandaEventualModal() {
    // Verificar rotinas eventuais antes de abrir
    const rotinas = Store.getData().rotinasBase.filter(r => (r.frequencia || '').toLowerCase() === 'eventual');
    if (rotinas.length === 0) {
        showNotify("Atenção", "Não há rotinas eventuais cadastradas. Cadastre uma rotina com frequência 'Eventual' primeiro.", "info");
        return;
    }

    // Popular select de rotinas eventuais
    const rotinasSel = document.getElementById('evt-rotina-select');
    rotinasSel.innerHTML = '<option value="">— Selecione a Rotina —</option>';
    rotinas.forEach(r => {
        rotinasSel.innerHTML += `<option value="${r.id}">${r.nome} (${r.diaPrazoPadrao} d.c.)</option>`;
    });

    // Cachear clientes e popular dropdown customizado
    _evtClientesCache = [...Store.getData().clientes.filter(c => c.ativo !== false)]
        .sort((a, b) => (a.razaoSocial || '').localeCompare(b.razaoSocial || '', 'pt-BR'));
    filtrarClientesEventual('');

    // Resetar estado do dropdown de clientes
    document.getElementById('evt-cliente-select').value = '';
    document.getElementById('evt-cliente-label').textContent = '— Selecione o Cliente —';
    document.getElementById('evt-cliente-label').style.color = 'var(--text-muted)';
    document.getElementById('evt-cliente-busca').value = '';
    document.getElementById('evt-cliente-dropdown').style.display = 'none';
    document.getElementById('evt-chevron').style.transform = '';

    // Resetar preview de prazo
    document.getElementById('evt-prazo-preview').style.display = 'none';

    // Abrir modal
    document.getElementById('modal-demanda-eventual').classList.add('active');

    // Fechar dropdown ao clicar fora
    setTimeout(() => {
        document.addEventListener('click', _fecharDropdownFora, { once: false });
    }, 0);
}

function _fecharDropdownFora(e) {
    const dropdown = document.getElementById('evt-cliente-dropdown');
    const trigger = document.getElementById('evt-cliente-trigger');
    if (dropdown && !dropdown.contains(e.target) && trigger && !trigger.contains(e.target)) {
        dropdown.style.display = 'none';
        const chevron = document.getElementById('evt-chevron');
        if (chevron) chevron.style.transform = '';
    }
}

function toggleClienteDropdown() {
    const dropdown = document.getElementById('evt-cliente-dropdown');
    const chevron = document.getElementById('evt-chevron');
    const isOpen = dropdown.style.display === 'block';
    dropdown.style.display = isOpen ? 'none' : 'block';
    chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
    if (!isOpen) {
        // Focar na busca ao abrir
        setTimeout(() => document.getElementById('evt-cliente-busca').focus(), 50);
    }
}

function filtrarClientesEventual(termo) {
    const termoLower = (termo || '').toLowerCase().trim();
    const filtrados = termoLower
        ? _evtClientesCache.filter(c => (c.razaoSocial || '').toLowerCase().includes(termoLower))
        : _evtClientesCache;

    const lista = document.getElementById('evt-cliente-list');
    lista.innerHTML = '';

    if (filtrados.length === 0) {
        lista.innerHTML = '<li style="padding:0.75rem 1rem; color:var(--text-muted); font-size:0.85rem;">Nenhum cliente encontrado</li>';
        return;
    }

    filtrados.forEach(c => {
        const li = document.createElement('li');
        li.style.cssText = 'padding:0.65rem 1rem; cursor:pointer; font-size:0.9rem; transition:background 0.15s; border-radius:4px; margin:0 0.3rem;';
        li.textContent = c.razaoSocial;
        li.onmouseenter = () => li.style.background = 'rgba(99,102,241,0.15)';
        li.onmouseleave = () => li.style.background = '';
        li.onclick = () => selecionarClienteEventual(c.id, c.razaoSocial);
        lista.appendChild(li);
    });
}

function selecionarClienteEventual(id, nome) {
    document.getElementById('evt-cliente-select').value = id;
    document.getElementById('evt-cliente-label').textContent = nome;
    document.getElementById('evt-cliente-label').style.color = 'var(--text-main)';
    document.getElementById('evt-cliente-dropdown').style.display = 'none';
    document.getElementById('evt-chevron').style.transform = '';
}

function onEventualRotinaChange() {
    const rotinaId = document.getElementById('evt-rotina-select').value;
    const preview = document.getElementById('evt-prazo-preview');
    const prazoText = document.getElementById('evt-prazo-text');

    if (!rotinaId) { preview.style.display = 'none'; return; }

    const rotina = Store.getData().rotinasBase.find(r => r.id === parseInt(rotinaId));
    if (!rotina) return;

    const dias = parseInt(rotina.diaPrazoPadrao) || 0;
    const prazo = new Date();
    prazo.setDate(prazo.getDate() + dias);
    const prazoStr = prazo.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    prazoText.textContent = `Prazo estimado: ${prazoStr} (${dias} dias corridos a partir de hoje)`;
    preview.style.display = 'block';
}

function closeDemandaEventualModal() {
    document.getElementById('modal-demanda-eventual').classList.remove('active');
    document.getElementById('evt-cliente-dropdown').style.display = 'none';
    document.removeEventListener('click', _fecharDropdownFora);
}


async function handleSaveDemandaEventual() {
    const rotinaId = document.getElementById('evt-rotina-select').value;
    const clienteId = document.getElementById('evt-cliente-select').value;

    if (!rotinaId) {
        showNotify("Atenção", "Selecione uma rotina eventual.", "warning");
        return;
    }
    if (!clienteId) {
        showNotify("Atenção", "Selecione um cliente.", "warning");
        return;
    }

    const btn = document.getElementById('btn-confirmar-eventual');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando...';

    const result = await Store.criarExecucaoEventual(rotinaId, clienteId);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Demanda';

    if (result.ok) {
        closeDemandaEventualModal();
        renderOperacional();
        renderDashboard();
        showFeedbackToast('Demanda eventual criada com sucesso!', 'success');
    } else {
        showNotify("Aviso", result.msg || 'Erro ao criar demanda eventual.', "warning");
    }
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

        const formatData = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' às ' + d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });



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

        showNotify("Atenção", "Não há dados para exportar.", "info");

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

        showNotify("Atenção", "Por favor, selecione um arquivo JSON de backup antes de clicar em Restaurar.", "warning");

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

            showNotify("Sistema Restaurado", "Seus dados foram restaurados com sucesso! Recarregando sistema...", "success");

            window.location.reload();



        } catch (err) {

            console.error(err);

            showNotify("Erro de Restauração", "Erro fatal ao tentar ler o arquivo: " + err.message, "error");

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

    // Print Button Listener
    const btnPrint = document.getElementById('btn-print-audit-comp');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            window.print();
        });
    }
}

function runAuditoriaCompetencia() {
    const mesId = document.getElementById('audit-comp-mes').value;
    const userName = document.getElementById('audit-comp-user').value;

    if (!mesId && !userName) {
        showNotify("Atenção", "Selecione pelo menos um Mês ou um Funcionário para filtrar.", "info");
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
        filtered = filtered.filter(e => e.competencia === mesId);
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
            const clientName = client ? client.razaoSocial : `#${ex.clienteId}`;

            const dPrazo = ex.diaPrazo ? new Date(ex.diaPrazo + "T00:00:00") : null;
            const dFeito = ex.feitoEm ? new Date(ex.feitoEm + "T00:00:00") : null;

            let statusTag = '';
            let veredito = '';
            let dataRealBaixa = ex.feitoEm ? formatDate(ex.feitoEm) : 'Pendente';

            if (ex.feito) {
                if (dPrazo && dFeito && dFeito > dPrazo) {
                    statusTag = '<span class="status-badge atrasado"><i class="fa-solid fa-clock"></i> Com Atraso</span>';
                    vereditoHTML = `<div class="audit-veredito-card"><span style="color:var(--danger); font-weight:600;">Entregue em ${dataRealBaixa}</span><br><small style="color:var(--text-muted)">(Fora do Prazo)</small></div>`;
                    atrasado++;
                } else {
                    statusTag = '<span class="status-badge concluido"><i class="fa-solid fa-check"></i> No Prazo</span>';
                    vereditoHTML = `<div class="audit-veredito-card"><span style="color:var(--success); font-weight:600;">Entregue em ${dataRealBaixa}</span><br><small style="color:var(--text-muted)">(No Prazo)</small></div>`;
                    noPrazo++;
                }
                if (ex.baixadoPor) {
                    vereditoHTML += `<div style="margin-top:4px; padding-left:10px;"><small style="color:var(--text-muted); font-style:italic;">Baixado por: ${ex.baixadoPor}</small></div>`;
                }
            } else {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                if (dPrazo && dPrazo < now) {
                    statusTag = '<span class="status-badge atrasado"><i class="fa-solid fa-triangle-exclamation"></i> Atrasado</span>';
                    vereditoHTML = '<div class="audit-veredito-card"><span style="color:var(--danger); font-weight:600;">Pendente e Atrasado</span></div>';
                    atrasado++;
                } else {
                    statusTag = '<span class="status-badge pendente"><i class="fa-solid fa-clock-rotate-left"></i> Pendente</span>';
                    vereditoHTML = '<div class="audit-veredito-card"><span style="color:var(--text-muted);">Aguardando Execução</span></div>';
                    pendente++;
                }
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${clientName}</strong></td>
                <td>${ex.rotina}</td>
                <td style="color:var(--text-muted)">${formatDate(ex.diaPrazo)}</td>
                <td><span style="font-weight:500;">${dataRealBaixa}</span></td>
                <td>${vereditoHTML}</td>
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
            });
            document.querySelectorAll(".settings-pane").forEach(pane => {
                pane.style.display = "none";
                pane.classList.remove("active");
            });

            // Set active class to clicked tab
            tab.classList.add("active");

            // Scroll suave para a aba selecionada (útil em mobile e telas pequenas)
            tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

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
            } else if (targetId === "set-branding") {
                renderMenuReorderList();
            }
        });
    });

    settingsInitDone = true;
}

function setupPasswordToggles() {
    document.querySelectorAll('.btn-toggle-password').forEach(btn => {
        btn.addEventListener('click', function () {
            const wrapper = this.closest('.password-wrapper');
            if (!wrapper) return;
            const input = wrapper.querySelector('input');
            const icon = this.querySelector('i');

            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });
}

// Handler para liberação antecipada de competência
window.updateCompetenciaSelects = function (newCompId) {
    const filters = [
        document.getElementById('competencia-filter'),
        document.getElementById('dash-competencia-filter'),
        document.getElementById('meu-competencia-filter')
    ];

    const monthObj = Store.getData().meses.find(m => m.id === newCompId);
    if (!monthObj) return;

    filters.forEach(select => {
        if (!select) return;
        // Verifica se já existe
        let exists = Array.from(select.options).some(opt => opt.value === newCompId);
        if (!exists) {
            const option = document.createElement('option');
            option.value = newCompId;
            option.textContent = monthObj.mes;
            select.appendChild(option);
        }
    });
};

window.showEarlyReleaseToast = function (compName) {
    showFeedbackToast(`Parabéns! Você concluiu suas demandas. A competência ${compName} foi liberada!`, 'success');
};

// js/store.js - Configured to fetch from Python API / Vercel

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000/api' // URL do servidor local FastAPI para testes
    : '/api'; // URL relativa de produção da Vercel

const today = new Date();
const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

// Initial state cache - starts empty and gets populated by the API
let db = {
    setores: [],
    funcionarios: [],
    rotinasBase: [],
    clientes: [],
    meses: [],
    execucoes: [],
    mensagens: [],
    logs: [],
    config: { autoBackup: false, lastBackupData: null }
};

window.Store = {
    // -----------------------------------------------------------------
    // API HYDRATION
    // -----------------------------------------------------------------
    async fetchAllData() {
        try {
            console.log("Baixando dados do banco de dados (Supabase/Python)...");
            const [
                setoresRes, funcionariosRes, rotinasBaseRes,
                clientesRes, mesesRes, execucoesRes, mensagensRes, logsRes
            ] = await Promise.all([
                fetch(`${API_BASE}/setores`),
                fetch(`${API_BASE}/funcionarios`),
                fetch(`${API_BASE}/rotinas_base`),
                fetch(`${API_BASE}/clientes`),
                fetch(`${API_BASE}/meses`),
                fetch(`${API_BASE}/execucoes`),
                fetch(`${API_BASE}/mensagens`),
                fetch(`${API_BASE}/logs`)
            ]);

            db.setores = (await setoresRes.json()).map(s => s.nome) || [];
            db.funcionarios = await funcionariosRes.json() || [];
            db.rotinasBase = await rotinasBaseRes.json() || [];
            db.clientes = await clientesRes.json() || [];
            db.meses = await mesesRes.json() || [];
            db.execucoes = await execucoesRes.json() || [];
            db.mensagens = await mensagensRes.json() || [];
            db.logs = await logsRes.json() || [];

            // Map python rotinasBase to expected camelCase names for legacy frontend compatibility
            db.rotinasBase = db.rotinasBase.map(r => ({
                id: r.id,
                nome: r.nome,
                setor: r.setor,
                frequencia: r.frequencia,
                diaPrazoPadrao: r.dia_prazo_padrao,
                checklistPadrao: typeof r.checklist_padrao === 'string' ? JSON.parse(r.checklist_padrao) : r.checklist_padrao
            }));

            db.clientes = db.clientes.map(c => ({
                id: c.id,
                codigo: c.codigo,
                razaoSocial: c.razao_social,
                cnpj: c.cnpj,
                regime: c.regime,
                responsavelFiscal: c.responsavel_fiscal,
                rotinasSelecionadas: typeof c.rotinas_selecionadas === 'string' ? JSON.parse(c.rotinas_selecionadas) : c.rotinas_selecionadas,
                driveLink: c.drive_link
            }));

            db.execucoes = db.execucoes.map(e => ({
                id: e.id,
                clienteId: e.cliente_id,
                rotina: e.rotina,
                competencia: e.competencia,
                diaPrazo: e.dia_prazo,
                driveLink: e.drive_link,
                feito: e.feito,
                feitoEm: e.feito_em,
                responsavel: e.responsavel,
                iniciadoEm: e.iniciado_em,
                checklistGerado: e.checklist_gerado,
                ehPai: e.eh_pai,
                subitems: typeof e.subitems === 'string' ? JSON.parse(e.subitems) : e.subitems
            }));

            console.log("Dados sincronizados com sucesso!");
            return true;
        } catch (error) {
            console.error("Erro ao puxar dados do banco:", error);
            // Fallback for visual offline testing if needed, or notify user
            alert("Erro de conexão com o banco de dados. Tente atualizar a página.");
            return false;
        }
    },

    // As in local storage, but now wait for fetch
    async loadFromStorage() {
        return await this.fetchAllData();
    },

    saveToStorage() {
        // Na nuvem (Supabase), ao invés de salvar TUDO, nós idealmente usamos as rotas de POST/PUT/DELETE.
        // No entanto, para fins desta migração rápida e pra manter 100% de retrocompatibilidade do painel:
        // você vai notar que os métodos individuais abaixo estão sendo adaptados para fazer POST imediatamente.
    },

    // ... rest of the original function structures
    async registerLog(action, details) {
        const username = (typeof LOGGED_USER !== 'undefined' && LOGGED_USER) ? LOGGED_USER.nome : "Sistema";
        const permissao = (typeof LOGGED_USER !== 'undefined' && LOGGED_USER) ? LOGGED_USER.permissao : "Automático";

        try {
            await fetch(`${API_BASE}/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_name: username,
                    permissao: permissao,
                    action: action,
                    details: details
                })
            });
            // Also add locally for instant UI update
            db.logs.push({ timestamp: new Date().toISOString(), user_name: username, permissao, action, details });
        } catch (e) {
            console.error(e);
        }
    },

    getData() {
        return db;
    },

    // UI Engine gets filtered from the local Cache (which was populated via loadFromStorage mapping)
    getExecucoesWithDetails(userFilter = 'All') {
        const tToday = new Date().setHours(0, 0, 0, 0);
        let execs = db.execucoes.map(ex => {
            const client = db.clientes.find(c => c.id === ex.clienteId);
            const dPrazo = ex.diaPrazo ? new Date(ex.diaPrazo + "T00:00:00").setHours(0, 0, 0, 0) : tToday;

            let statusAuto = "No Prazo";
            let semaforo = "green";
            let pendente = !ex.feito;

            if (ex.feito) {
                statusAuto = "Concluído";
                semaforo = "green";
            } else if (dPrazo < tToday) {
                statusAuto = "Atrasado";
                semaforo = "red";
                if (ex.subitems && ex.subitems.some(s => s.done)) {
                    statusAuto = "Atrasado (Em Andamento)";
                }
            } else if (dPrazo === tToday) {
                statusAuto = "Hoje";
                semaforo = "yellow";
                if (ex.subitems && ex.subitems.some(s => s.done)) {
                    statusAuto = "Hoje (Em Andamento)";
                }
            } else {
                const diaDiff = Math.ceil((dPrazo - tToday) / (1000 * 60 * 60 * 24));
                statusAuto = `Vence em ${diaDiff} d`;
                if (diaDiff <= 2) semaforo = "yellow";
                if (ex.subitems && ex.subitems.some(s => s.done)) {
                    statusAuto = "Em Andamento";
                    semaforo = "blue";
                }
            }

            return {
                ...ex,
                clientName: client ? client.razaoSocial : 'Desconhecido',
                regime: client ? client.regime : '',
                statusAuto,
                semaforo,
                pendente
            };
        });

        if (userFilter !== 'All') {
            execs = execs.filter(e => e.responsavel === userFilter);
        }

        return execs;
    },

    getKPIs() {
        const execs = this.getExecucoesWithDetails('All');
        return {
            total: execs.length,
            concluidos: execs.filter(e => e.feito).length,
            atrasados: execs.filter(e => e.semaforo === 'red' && !e.feito).length,
            vencendo: execs.filter(e => e.semaforo === 'yellow' && !e.feito).length,
            emAndamento: execs.filter(e => !e.feito && e.subitems && e.subitems.some(s => s.done)).length
        };
    },

    getClientStats() {
        return {
            total: db.clientes.length,
            simples: db.clientes.filter(c => c.regime === 'Simples Nacional' || c.regime === 'MEI').length,
            outros: db.clientes.filter(c => c.regime !== 'Simples Nacional' && c.regime !== 'MEI').length
        };
    },

    getCriticalBottlenecks() {
        return this.getExecucoesWithDetails('All')
            .filter(e => e.semaforo === 'red' && e.ehPai && !e.feito)
            .sort((a, b) => new Date(a.diaPrazo || new Date()) - new Date(b.diaPrazo || new Date()));
    },

    // Action Disparators - API MOCK
    // In a real deep restructuring we would have an app.put('/api/execucoes/{id}') on Python
    async toggleExecucaoFeito(id, isFeito) {
        const ex = db.execucoes.find(e => e.id === id);
        if (ex) {
            ex.feito = isFeito;
            ex.feitoEm = isFeito ? today.toISOString().split('T')[0] : null;

            if (isFeito) ex.subitems.forEach(s => s.done = true);
            else ex.subitems.forEach(s => s.done = false);

            await fetch(`${API_BASE}/execucoes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feito: ex.feito, feito_em: ex.feitoEm, subitems: ex.subitems })
            });

            this.registerLog("Ação de Rotina", `Marcou rotina '${ex.rotina}' como ${isFeito ? 'Concluída' : 'Pendente'}`);
        }
    },

    async updateChecklist(execId, subId, isDone) {
        const ex = db.execucoes.find(e => e.id === execId);
        if (ex) {
            const sub = ex.subitems.find(s => s.id === subId);
            if (sub) sub.done = isDone;

            const allDone = ex.subitems.every(s => s.done);
            if (allDone && !ex.feito) {
                ex.feito = true;
                ex.feitoEm = today.toISOString().split('T')[0];
            } else if (!allDone && ex.feito) {
                ex.feito = false;
                ex.feitoEm = null;
            }

            await fetch(`${API_BASE}/execucoes/${execId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feito: ex.feito, feito_em: ex.feitoEm, subitems: ex.subitems })
            });

            this.registerLog("Atualizou Checklist", `Checklist item id ${subId} (rotina ${ex.rotina}) - ${isDone ? 'Feito' : 'Desfeito'}`);
        }
    },

    async addClient(razaoSocial, cnpj, regime, responsavelFiscal, rotinasSelecionadasIds, driveLink = "") {
        const codigo = `C${(db.clientes.length + 1).toString().padStart(3, '0')}`;

        const res = await fetch(`${API_BASE}/clientes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                razao_social: razaoSocial,
                cnpj,
                codigo,
                regime,
                responsavel_fiscal: responsavelFiscal,
                rotinas_selecionadas: rotinasSelecionadasIds || [],
                drive_link: driveLink
            })
        });

        if (res.ok) {
            const savedData = await res.json();
            const newClient = savedData[0]; // Supabase returns array
            // Convert to camelCase format
            db.clientes.push({
                id: newClient.id, razaoSocial, cnpj, codigo, regime,
                responsavelFiscal, rotinasSelecionadas: rotinasSelecionadasIds, driveLink
            });
            this.engineRotinas(db.clientes[db.clientes.length - 1]);
            this.sendMensagem("Sistema", responsavelFiscal, `Novo cliente cadastrado: ${razaoSocial}.`);
            this.registerLog("Cadastrou Cliente", razaoSocial);
        }
    },

    login(username, password) {
        console.log("Tentativa de login:", username, "- Senha Local:", password);
        console.log("Total Funcionarios carregados pelo Banco:", db.funcionarios.length);
        console.log("Funcionarios no DB:", db.funcionarios);

        const user = db.funcionarios.find(f => f.nome === username && f.senha === password);

        if (user) {
            console.log("Usuário encontrado! Logando...");
            this.registerLog("Acesso ao Sistema", `Login efetuado por ${username}`);
        } else {
            console.log("Falha no login. Nenhum usuário combinou com as credenciais fornecidas.");
        }
        return user || null;
    },

    // Additional methods mock
    sendMensagem(remetente, destinatario, texto) {
        // Push locally
        const m = { id: Date.now(), remetente, destinatario, texto, lida: false, data: new Date().toISOString() };
        db.mensagens.push(m);
        // Post api
        fetch(`${API_BASE}/mensagens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remetente, destinatario, texto, lida: false }) }).catch(e => { });
    },

    getMensagensPara(usuario) {
        return db.mensagens.filter(m => m.destinatario === usuario).sort((a, b) => new Date(b.data) - new Date(a.data));
    },

    getUnreadCount(usuario) {
        return db.mensagens.filter(m => m.destinatario === usuario && !m.lida).length;
    },

    engineRotinas(cliente) {
        // ... simplified iteration calling /api/execucoes POST for each routine setup.
        console.log("Rotinas engine trigger bypass para demonstração da migração.");
    }
};

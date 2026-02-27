const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000/api'
    : 'https://eikiko-rbapp.hf.space/api';

window.API_BASE = API_BASE;


const today = new Date();
const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

// --- Wrapper Global de Fetch para injetar cookies do JWT em todas as requisições ---
async function apiFetch(url, options = {}) {
    options.credentials = 'include';
    // Omit não é mais necessário aqui dentro a não ser no primeiro carregamento público, que será passado explicitamente
    return fetch(url, options);
}

// Cache do estado inicial - começa vazio e é preenchido pela API
let db = {
    setores: [],
    funcionarios: [],
    rotinasBase: [],
    clientes: [],
    meses: [],
    execucoes: [],
    mensagens: [],
    logs: [],
    config: {
        autoBackup: false,
        lastBackupData: null,
        brandName: "RB|App",
        brandLogoUrl: "",
        accentColor: "#6366f1",
        slogan: "Sua contabilidade inteligente",
        theme: "glass",
        menuOrder: []
    },
    cargos: [],
    marketing_posts: [],
    marketing_campanhas: [],
    marketing_equipe: [],
    marketing_metricas: []
};

window.Store = {
    // -----------------------------------------------------------------
    // HIDRATAÇÃO DA API
    // -----------------------------------------------------------------
    async fetchAllData() {
        try {
            console.log("Baixando dados do banco de dados (Supabase/Python)...");
            const [
                setoresRes, funcionariosRes, rotinasBaseRes,
                clientesRes, mesesRes, execucoesRes, mensagensRes, logsRes, cargosRes,
                marketing_postsRes, marketing_campanhasRes, marketing_equipeRes,
                marketing_metricasRes, global_configRes
            ] = await Promise.all([
                apiFetch(`${API_BASE}/setores`),
                apiFetch(`${API_BASE}/funcionarios`),
                apiFetch(`${API_BASE}/rotinas_base`),
                apiFetch(`${API_BASE}/clientes`),
                apiFetch(`${API_BASE}/meses`),
                apiFetch(`${API_BASE}/execucoes`),
                apiFetch(`${API_BASE}/mensagens`),
                apiFetch(`${API_BASE}/logs`),
                apiFetch(`${API_BASE}/cargos`),
                apiFetch(`${API_BASE}/marketing_posts`),
                apiFetch(`${API_BASE}/marketing_campanhas`),
                apiFetch(`${API_BASE}/marketing_equipe`),
                apiFetch(`${API_BASE}/marketing_metricas`),
                apiFetch(`${API_BASE}/global_config`)
            ]);

            db.setores = (await setoresRes.json()).map(s => s.nome) || [];
            db.funcionarios = await funcionariosRes.json() || [];
            db.rotinasBase = await rotinasBaseRes.json() || [];
            db.clientes = await clientesRes.json() || [];
            db.meses = await mesesRes.json() || [];
            db.execucoes = await execucoesRes.json() || [];
            db.mensagens = (await mensagensRes.json()).map(m => ({
                id: m.id,
                remetente: m.remetente,
                destinatario: m.destinatario,
                texto: m.texto,
                assunto: m.assunto || 'Sem Assunto',
                lida: m.lida,
                data: m.data,
                excluido_por: Array.isArray(m.excluido_por) ? m.excluido_por : (typeof m.excluido_por === 'string' ? JSON.parse(m.excluido_por) : []),
                favorito: m.favorito || false
            })) || [];
            db.logs = await logsRes.json() || [];

            // Tentar definir os cargos (pode falhar se a tabela não existir, fallback para array vazio)
            try {
                const cargosData = await cargosRes.json();
                db.cargos = Array.isArray(cargosData) ? cargosData : [];
            } catch (e) { db.cargos = []; }

            try {
                const marketingData = await marketing_postsRes.json();
                db.marketing_posts = Array.isArray(marketingData) ? marketingData : [];
            } catch (e) { db.marketing_posts = []; }

            try {
                const campanhasData = await marketing_campanhasRes.json();
                db.marketing_campanhas = Array.isArray(campanhasData) ? campanhasData : [];
            } catch (e) { db.marketing_campanhas = []; }

            try {
                const equipeData = await marketing_equipeRes.json();
                db.marketing_equipe = Array.isArray(equipeData) ? equipeData : [];
            } catch (e) { db.marketing_equipe = []; }

            try {
                const metricsData = await marketing_metricasRes.json();
                db.marketing_metricas = Array.isArray(metricsData) ? metricsData : [];
            } catch (e) { db.marketing_metricas = []; }

            try {
                const configData = await global_configRes.json();
                if (Array.isArray(configData) && configData.length > 0) {
                    const c = configData[0];
                    db.config.brandName = c.brand_name || db.config.brandName;
                    db.config.brandLogoUrl = c.brand_logo_url || db.config.brandLogoUrl;
                    db.config.accentColor = c.accent_color || db.config.accentColor;
                    db.config.slogan = c.slogan || db.config.slogan;
                    db.config.theme = c.theme || db.config.theme;
                    let mOrder = c.menu_order || c.menuOrder || db.config.menuOrder;

                    if (mOrder) {
                        if (typeof mOrder === 'string' && mOrder.trim() !== "") {
                            try { mOrder = JSON.parse(mOrder); }
                            catch (e) {
                                if (mOrder.includes(',')) mOrder = mOrder.split(',').map(s => s.trim());
                            }
                        }
                    }

                    db.config.menuOrder = Array.isArray(mOrder) ? mOrder : [];
                    db.config.menu_order = db.config.menuOrder; // Garantir sincronia local
                }
            } catch (e) {
                console.warn("Erro ao processar global_config:", e);
            }

            // Mapear rotinasBase do python para camelCase esperado por compatibilidade de frontend legado
            db.rotinasBase = db.rotinasBase.map(r => ({
                id: r.id,
                nome: r.nome,
                setor: r.setor,
                frequencia: r.frequencia,
                diaPrazoPadrao: r.dia_prazo_padrao,
                checklistPadrao: typeof r.checklist_padrao === 'string' ? JSON.parse(r.checklist_padrao) : r.checklist_padrao,
                responsavel: r.responsavel || ""
            }));

            db.clientes = db.clientes.map(c => ({
                id: c.id,
                codigo: c.codigo,
                razaoSocial: c.razao_social,
                cnpj: c.cnpj,
                regime: c.regime,
                responsavelFiscal: c.responsavel_fiscal,
                rotinasSelecionadas: typeof c.rotinas_selecionadas === 'string' ? JSON.parse(c.rotinas_selecionadas) : c.rotinas_selecionadas || [],
                driveLink: c.drive_link,
                // Novos campos expansíveis (fallback para vazio se não existirem na API)
                ie: c.inscricao_estadual || "",
                im: c.inscricao_municipal || "",
                dataAbertura: c.data_abertura || "",
                tipoEmpresa: c.tipo_empresa || "",
                contatoNome: c.contato_nome || "",
                email: c.email || "",
                telefone: c.telefone || "",
                loginEcac: c.login_ecac || "",
                senhaEcac: c.senha_ecac || "",
                loginSefaz: c.login_sefaz || "",
                senhaSefaz: c.senha_sefaz || "",
                loginPref: c.login_pref || "",
                senhaPref: c.senha_pref || "",
                loginDominio: c.login_dominio || "",
                senhaDominio: c.senha_dominio || "",
                outrosAcessos: c.outros_acessos || "",
                ativo: c.ativo !== false // Default true
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
                baixadoPor: e.baixado_por || "", // Novo campo mapeado do banco
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
            // Fallback para testes offline visuais se necessário, ou notificar o usuário
            if (typeof window.showNotify === 'function') {
                window.showNotify("Erro de Conexão", "Erro de conexão com o banco de dados. Tente atualizar a página.", "error");
            } else {
                console.error("Erro de conexão com o banco de dados.");
            }
            return false;
        }
    },

    // Como no storage local, mas agora espera o fetch
    async loadFromStorage() {
        const loaded = await this.fetchAllData();
        if (loaded) {
            await this.checkCompetenciaRollover();
        }
        return loaded;
    },

    /**
     * Helper unificado para gerar execuções (tarefas) para uma competência específica.
     * Centraliza a lógica de cálculo de data e criação de subitems.
     */
    async gerarExecucaoParaCompetencia(cliente, rotina, competenciaId) {
        // Verifica se já existe para evitar duplicatas
        const existsE = db.execucoes.find(e =>
            e.clienteId === cliente.id &&
            e.rotina === rotina.nome &&
            e.competencia === competenciaId
        );
        if (existsE) return null;

        const [y, mStr] = competenciaId.split('-');
        let execDate = new Date(parseInt(y), parseInt(mStr) - 1, 1);

        // Padrão: Vencimento no mês seguinte à competência
        execDate.setMonth(execDate.getMonth() + 1);

        let execYStr = execDate.getFullYear();
        let execMStr = (execDate.getMonth() + 1).toString().padStart(2, '0');
        let diaStr = (rotina.diaPrazoPadrao || "05").toString().padStart(2, '0');
        let dateStr = `${execYStr}-${execMStr}-${diaStr}`;

        // Regra especial para Anual (ex: "15/04")
        if (rotina.frequencia === 'Anual' && rotina.diaPrazoPadrao.toString().includes('/')) {
            const [diaAnual, mesAnual] = rotina.diaPrazoPadrao.toString().split('/');
            dateStr = `${y}-${mesAnual.padStart(2, '0')}-${diaAnual.padStart(2, '0')}`;
        }

        const subitems = (rotina.checklistPadrao || []).map((item, idx) => {
            const text = typeof item === 'string' ? item : item.texto;
            return { id: idx + 1, texto: text, done: false };
        });

        try {
            const resE = await apiFetch(`${API_BASE}/execucoes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente_id: cliente.id,
                    rotina: rotina.nome,
                    competencia: competenciaId,
                    dia_prazo: dateStr,
                    drive_link: cliente.driveLink || "",
                    responsavel: rotina.responsavel || "",
                    subitems: subitems,
                    eh_pai: true,
                    feito: false,
                    iniciado_em: new Date().toISOString().split('T')[0],
                    checklist_gerado: true
                })
            });

            if (resE.ok) {
                const dataE = await resE.json();
                const newExec = {
                    id: dataE[0] ? dataE[0].id : Date.now(),
                    clienteId: cliente.id,
                    rotina: rotina.nome,
                    competencia: competenciaId,
                    diaPrazo: dateStr,
                    driveLink: cliente.driveLink || "",
                    feito: false,
                    feitoEm: null,
                    responsavel: rotina.responsavel || "",
                    iniciadoEm: new Date().toISOString().split('T')[0],
                    checklistGerado: true,
                    ehPai: true,
                    subitems: subitems
                };
                db.execucoes.push(newExec);
                return newExec;
            }
        } catch (e) {
            console.error(`[Store] Erro ao gerar execução para ${rotina.nome} / ${cliente.razaoSocial}:`, e);
        }
        return null;
    },

    async checkCompetenciaRollover() {
        if (!db.meses) db.meses = [];

        const now = new Date();
        // A competência trabalhada é sempre o mês anterior
        now.setMonth(now.getMonth() - 1);
        const year = now.getFullYear();
        const monthNum = (now.getMonth() + 1).toString().padStart(2, '0');
        const currentCompId = `${year}-${monthNum}`;
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const currentExt = `${monthNames[now.getMonth()]} ${year}`;

        // Checar se o mês real atual existe no Banco de Dados
        const exists = db.meses.find(m => m.id === currentCompId);

        if (!exists) {
            console.log(`[Rollover] Mês ${currentCompId} não existe. Iniciando virada de competência...`);

            // Desativar meses ativos antigos
            const oldActives = db.meses.filter(m => m.ativo);
            for (let m of oldActives) {
                m.ativo = false;
                try {
                    await apiFetch(`${API_BASE}/meses/${m.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ativo: false })
                    });
                } catch (e) {
                    console.error("Erro ao desativar mês antigo:", e);
                }
            }

            // Criar novo mês
            const newMonth = {
                id: currentCompId,
                mes: currentExt,
                ativo: true,
                percent_concluido: 0,
                atrasados: 0,
                concluidos: 0,
                total_execucoes: 0,
                vencendo: 0
            };

            try {
                const res = await apiFetch(`${API_BASE}/meses`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newMonth)
                });

                if (res.ok) {
                    const data = await res.json();
                    db.meses.push(data[0]);
                    this.registerLog("Sistema", `Competência virada para ${currentExt}`);

                    console.log(`[Rollover] Gerando tarefas periódicas para ${db.clientes.length} clientes...`);

                    // Estrutura de replicação unificada para garantir consistência
                    for (let cliente of db.clientes) {
                        const routinesToProcess = cliente.rotinasSelecionadas || [];
                        for (const rotId of routinesToProcess) {
                            const rotina = db.rotinasBase.find(r => r.id === rotId);
                            if (!rotina) continue;

                            // REGRA CRÍTICA: Não replicar rotinas eventuais
                            if ((rotina.frequencia || '').toLowerCase() === 'eventual') {
                                console.log(`[Rollover] Ignorando rotina eventual: ${rotina.nome} para cliente ${cliente.razaoSocial}`);
                                continue;
                            }

                            await this.gerarExecucaoParaCompetencia(cliente, rotina, currentCompId);
                        }
                    }
                }
            } catch (e) {
                console.error("Erro ao criar nova competência:", e);
            }

        } else if (!exists.ativo) {
            // Corrigir caso extremo onde o mês existe, mas não está marcado como ativo
            exists.ativo = true;
            await apiFetch(`${API_BASE}/meses/${exists.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ativo: true })
            }).catch(e => { });
        }
    },

    saveToStorage() {
        // Na nuvem (Supabase), ao invés de salvar TUDO, nós idealmente usamos as rotas de POST/PUT/DELETE.
        // No entanto, para fins desta migração rápida e pra manter 100% de retrocompatibilidade do painel:
        // você vai notar que os métodos individuais abaixo estão sendo adaptados para fazer POST imediatamente.
    },

    // ... resto das estruturas da função original
    async registerLog(action, details) {
        const username = (typeof window.LOGGED_USER !== 'undefined' && window.LOGGED_USER) ? window.LOGGED_USER.nome : "Sistema";
        const permissao = (typeof window.LOGGED_USER !== 'undefined' && window.LOGGED_USER) ? window.LOGGED_USER.permissao : "Automático";

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
            // Também adicionar localmente para atualização instantânea da UI
            const now = new Date();
            const timestamp = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
            db.logs.push({ timestamp, user_name: username, permissao, action, details });
        } catch (e) {
            console.error(e);
        }
    },

    getData() {
        return db;
    },

    // A engine da UI é filtrada a partir do Cache local (que foi preenchido via mapeamento loadFromStorage)
    getExecucoesWithDetails(userFilter = 'All') {
        const tToday = new Date().setHours(0, 0, 0, 0);
        // Filtra execuções órfãs ou de clientes que perderam o vínculo com a rotina
        const activeMonth = db.meses.find(m => m.ativo);
        const currentComp = activeMonth ? activeMonth.id : null;

        const rotinasAtivas = new Set(db.rotinasBase.map(r => r.nome));

        let execs = db.execucoes.filter(ex => {
            if (!rotinasAtivas.has(ex.rotina)) return false; // Rotina foi apagada do sistema sumariamente

            // Regra Anti-Órfãos V2 (Evita clientes não vinculados exibidos no painel Operacional)
            const client = db.clientes.find(c => c.id === ex.clienteId);
            if (!client) return false;

            const rotinaObj = db.rotinasBase.find(r => r.nome === ex.rotina);
            if (!rotinaObj) return false;

            // Só esconde "órfãos" se for a competência atual ou futural. 
            // O passado (Ex: Janeiro) fica salvo para Histórico e Auditoria mesmo que o cliente tenha sido removido em Março.
            const isHistorico = currentComp && ex.competencia < currentComp;

            if (!isHistorico) {
                const rotinasDoCliente = client.rotinasSelecionadas || [];
                const isEventual = rotinaObj.frequencia && rotinaObj.frequencia.toLowerCase() === 'eventual';

                if (!isEventual && !rotinasDoCliente.includes(rotinaObj.id)) {
                    return false; // A rotina não pertence mais ao cliente. Omitir.
                }
            }

            return true;
        }).map(ex => {
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

            const rotinaBase = db.rotinasBase.find(r => r.nome === ex.rotina);

            return {
                ...ex,
                clientName: client ? client.razaoSocial : 'Desconhecido',
                cnpj: client ? client.cnpj : '',
                regime: client ? client.regime : '',
                setor: rotinaBase ? rotinaBase.setor : 'Geral',
                statusAuto,
                semaforo,
                pendente
            };
        });

        if (userFilter !== 'All') {
            execs = execs.filter(e => {
                if (!e.responsavel) return false;
                const names = e.responsavel.split(",").map(n => n.trim());
                return names.includes(userFilter);
            });
        }

        return execs;
    },

    getKPIs(competencia = null) {
        let execs = this.getExecucoesWithDetails('All');
        if (competencia) {
            execs = execs.filter(e => e.competencia === competencia);
        }
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
            ativos: db.clientes.filter(c => c.ativo !== false).length,
            inativos: db.clientes.filter(c => c.ativo === false).length,
            simples: db.clientes.filter(c => c.regime === 'Simples Nacional').length,
            presumido: db.clientes.filter(c => c.regime === 'Lucro Presumido').length,
            real: db.clientes.filter(c => c.regime === 'Lucro Real').length,
            mei: db.clientes.filter(c => c.regime === 'MEI').length
        };
    },

    getCriticalBottlenecks(competencia = null) {
        let execs = this.getExecucoesWithDetails('All');
        if (competencia) {
            execs = execs.filter(e => e.competencia === competencia);
        }
        return execs
            .filter(e => e.semaforo === 'red' && e.ehPai && !e.feito)
            .sort((a, b) => new Date(a.diaPrazo || new Date()) - new Date(b.diaPrazo || new Date()));
    },

    // Disparadores de Ação - MOCK DA API
    // Em uma restruturação profunda real, teríamos um app.put('/api/execucoes/{id}') no Python
    async toggleExecucaoFeito(id, isFeito) {
        const ex = db.execucoes.find(e => e.id === id);
        const username = (typeof window.LOGGED_USER !== 'undefined' && window.LOGGED_USER) ? window.LOGGED_USER.nome : "Sistema";
        ex.feito = isFeito;
        ex.feitoEm = isFeito ? new Date().toISOString().split('T')[0] : null;
        ex.baixadoPor = isFeito ? username : null;

        if (isFeito) ex.subitems.forEach(s => s.done = true);
        else ex.subitems.forEach(s => s.done = false);

        try {
            await apiFetch(`${API_BASE}/execucoes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feito: ex.feito,
                    feito_em: ex.feitoEm,
                    baixado_por: ex.baixadoPor, // Persistindo quem baixou
                    subitems: ex.subitems
                })
            });
        } catch (e) {
            console.error("Erro apiFetch toggleExecucaoFeito:", e);
        }

        this.registerLog("Ação de Rotina", `Marcou rotina '${ex.rotina}' como ${isFeito ? 'Concluída' : 'Pendente'}`);

        if (isFeito) {
            await Store.checkEmployeeCompetenciaCompletion(ex.competencia);
        }
    },

    async deleteExecucao(id) {
        db.execucoes = db.execucoes.filter(e => e.id !== id);
        try {
            await apiFetch(`${API_BASE}/execucoes/${id}`, { method: 'DELETE' });
        } catch (e) {
            console.error("Erro ao excluir execução via API:", e);
        }
    },

    async updateChecklist(execId, subId, isDone) {
        const ex = db.execucoes.find(e => e.id === execId);
        const username = (typeof window.LOGGED_USER !== 'undefined' && window.LOGGED_USER) ? window.LOGGED_USER.nome : "Sistema";
        const sub = ex.subitems.find(s => s.id === subId);
        if (sub) sub.done = isDone;

        const allDone = ex.subitems.every(s => s.done);
        if (allDone && !ex.feito) {
            ex.feito = true;
            ex.feitoEm = new Date().toISOString().split('T')[0];
            ex.baixadoPor = username;
        } else if (!allDone && ex.feito) {
            ex.feito = false;
            ex.feitoEm = null;
            ex.baixadoPor = null;
        }

        try {
            await apiFetch(`${API_BASE}/execucoes/${execId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feito: ex.feito,
                    feito_em: ex.feitoEm,
                    baixado_por: ex.baixadoPor,
                    subitems: ex.subitems
                })
            });
        } catch (e) {
            console.error("Erro apiFetch updateChecklist:", e);
        }

        this.registerLog("Atualizou Checklist", `Checklist item id ${subId} (rotina ${ex.rotina}) - ${isDone ? 'Feito' : 'Desfeito'}`);

        if (allDone && ex.feito) {
            await Store.checkEmployeeCompetenciaCompletion(ex.competencia);
        }
    },

    async checkEmployeeCompetenciaCompletion(competenciaId) {
        const username = (typeof window.LOGGED_USER !== 'undefined' && window.LOGGED_USER) ? window.LOGGED_USER.nome : "Sistema";

        // Espelhar exatamente o que o usuário vê na interface (ignora órfãos)
        // Usar Store. ao invés de this. para evitar problemas de contexto (this undefined) em disparos assíncronos
        let execsUser = Store.getExecucoesWithDetails(username).filter(e => e.competencia === competenciaId);

        if (execsUser.length === 0) {
            return; // Nenhuma rotina atribuída
        }

        const incompletas = execsUser.filter(e => !e.feito);

        if (incompletas.length === 0) {
            console.log(`[Early Release] ${username} concluiu todas as tarefas da competência ${competenciaId}! Liberando próxima...`);

            // Calcular próxima competência
            let [y, m] = competenciaId.split('-');
            let dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
            dateObj.setMonth(dateObj.getMonth() + 1); // Próximo mês
            const nextY = dateObj.getFullYear();
            const nextMNum = (dateObj.getMonth() + 1).toString().padStart(2, '0');
            const nextCompId = `${nextY}-${nextMNum}`;
            const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            const nextExt = `${monthNames[dateObj.getMonth()]} ${nextY}`;

            // Verifica se a próxima competência já existe nos meses do sistema
            let existsM = db.meses.find(mObj => mObj.id === nextCompId);
            if (!existsM) {
                const newMonth = {
                    id: nextCompId,
                    mes: nextExt,
                    ativo: false, // Falso para não virar a competência global de todo mundo
                    percent_concluido: 0, atrasados: 0, concluidos: 0, total_execucoes: 0, vencendo: 0
                };

                try {
                    const res = await apiFetch(`${API_BASE}/meses`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newMonth)
                    });
                    if (res.ok) {
                        const data = await res.json();
                        db.meses.push(data[0]);
                        existsM = data[0];
                    }
                } catch (e) { console.error("Erro ao criar mês de liberação antecipada", e); }
            }

            // Exige atualização visual dos Selects caso o mes não estivesse lá ainda
            if (typeof window.updateCompetenciaSelects === 'function') {
                window.updateCompetenciaSelects(nextCompId);
            }

            for (let cliente of db.clientes) {
                const routinesToProcess = cliente.rotinasSelecionadas || [];
                for (const rotId of routinesToProcess) {
                    const rotina = db.rotinasBase.find(r => r.id === rotId);
                    if (!rotina) continue;

                    // Filtro por responsável
                    if (!rotina.responsavel || !rotina.responsavel.includes(username)) continue;

                    // REGRA CRÍTICA: Não replicar rotinas eventuais
                    if ((rotina.frequencia || '').toLowerCase() === 'eventual') continue;

                    await this.gerarExecucaoParaCompetencia(cliente, rotina, nextCompId);
                }
            }


            // Sempre alertar sobre a liberação usando o novo Overlay Full Screen
            if (typeof window.showSuccessOverlay === 'function') {
                window.showSuccessOverlay('Mês Liberado!', `A competência ${nextExt} foi gerada nas suas tarefas.`);
            } else if (typeof window.showFeedbackToast === 'function') {
                window.showFeedbackToast(`Parabéns! Você concluiu suas demandas. A competência ${nextExt} foi liberada!`, 'success');
            } else {
                window.showNotify("Parabéns!", `Você concluiu suas demandas. A competência ${nextExt} foi liberada!`, "success");
            }

            // Forçar re-render dos paineis para a nova competência aparecer e as tarefas somarem aos KPIs
            if (typeof renderOperacional === 'function') renderOperacional();
            if (typeof renderMeuDesempenho === 'function') renderMeuDesempenho();
            if (typeof renderDashboard === 'function') renderDashboard();
        }
    },

    // --- GERENCIAMENTO DE COMPETÊNCIAS (Admin) ---
    async addCompetenciaManual(anoMesId) {
        // anoMesId format: YYYY-MM
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const [y, mStr] = anoMesId.split('-');
        const monthIndex = parseInt(mStr) - 1;
        const nomeExtenso = `${monthNames[monthIndex]} ${y}`;

        // Verifica se já existe
        if (db.meses.find(m => m.id === anoMesId)) {
            window.showNotify("Aviso", `A competência ${anoMesId} já existe no sistema.`, "info");
            return false;
        }

        const newMonth = {
            id: anoMesId,
            mes: nomeExtenso,
            ativo: false,
            percent_concluido: 0, atrasados: 0, concluidos: 0, total_execucoes: 0, vencendo: 0
        };

        try {
            const res = await apiFetch(`${API_BASE}/meses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newMonth)
            });
            if (res.ok) {
                const data = await res.json();
                db.meses.push(data[0]);
                this.registerLog("Gestão de Competências", `Injetou manualmente a nova competência: ${anoMesId}`);

                // Gera ativamente as obrigações para todos os clientes nessa competência
                showLoading("Processando Mês", `Gerando estrutura mensal de ${nomeExtenso}...`);
                for (let cliente of db.clientes) {
                    const routinesToProcess = cliente.rotinasSelecionadas || [];
                    for (const rotId of routinesToProcess) {
                        const rotina = db.rotinasBase.find(r => r.id === rotId);
                        if (!rotina) continue;

                        // REGRA CRÍTICA: Não replicar rotinas eventuais
                        if ((rotina.frequencia || '').toLowerCase() === 'eventual') continue;

                        await this.gerarExecucaoParaCompetencia(cliente, rotina, anoMesId);
                    }
                }

                hideLoading();
                return true;
            }
        } catch (e) {
            console.error(e);
            hideLoading();
        }
        return false;
    },

    async deleteCompetencia(compId) {
        const compIdStr = String(compId).trim();
        console.log("[Store] Solicitando exclusão da competência:", compIdStr);

        // Configurações diretas do Supabase para bypass do backend Python quando necessário
        const SUPABASE_URL = "https://khbdbuoryxqiprlkdcpz.supabase.co";
        const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYmRidW9yeXhxaXBybGtkY3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODU4ODcsImV4cCI6MjA4NzI2MTg4N30.1rr3_-LVO6b2PR96lJl8d7vVfHseWwUeAQDY4tdJR-M";

        const supabaseHeaders = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };

        try {
            // Estratégia 1: Tentar via backend Python (que cuida das execuções vinculadas)
            const res = await apiFetch(`${API_BASE}/meses/${compIdStr}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' }
            });

            // Capturar o body da resposta para diagnóstico
            let responseBody = null;
            try { responseBody = await res.json(); } catch (_) { }

            console.log(`[Store] Resposta do backend DELETE /meses/${compIdStr}:`, res.status, responseBody);

            if (res.ok) {
                // Backend funcionou! Atualizar cache local e retornar sucesso
                console.log("[Store] Exclusão confirmada pelo backend Python.");
            } else {
                // Backend falhou — tentar diretamente no Supabase REST API
                console.warn(`[Store] Backend falhou (${res.status}). Tentando DELETE direto no Supabase...`);

                // Passo 1: Deletar execuções vinculadas diretamente no Supabase
                try {
                    const delExecRes = await fetch(
                        `${SUPABASE_URL}/rest/v1/execucoes?competencia=eq.${encodeURIComponent(compIdStr)}`,
                        { method: 'DELETE', headers: supabaseHeaders }
                    );
                    console.log(`[Store] DELETE execucoes direto no Supabase: ${delExecRes.status}`);
                } catch (execErr) {
                    console.warn("[Store] Aviso ao deletar execuções diretamente:", execErr);
                }

                // Passo 2: Deletar o mês diretamente no Supabase
                const directRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/meses?id=eq.${encodeURIComponent(compIdStr)}`,
                    { method: 'DELETE', headers: supabaseHeaders }
                );

                if (!directRes.ok) {
                    let directError = null;
                    try { directError = await directRes.json(); } catch (_) { }
                    const detail = directError?.message || directError?.hint || directError?.code || `HTTP ${directRes.status}`;
                    console.error("[Store] DELETE direto no Supabase também falhou:", detail, directError);
                    window.showNotify("Erro ao Excluir", `Não foi possível excluir: ${detail}`, "error");
                    return false;
                }

                console.log("[Store] Exclusão confirmada diretamente pelo Supabase.");
            }

            // Atualizar Cache Local após qualquer caminho de sucesso
            const initialMesesCount = db.meses.length;
            db.meses = db.meses.filter(m => String(m.id).trim() !== compIdStr);

            const initialExecsCount = db.execucoes.length;
            db.execucoes = db.execucoes.filter(e => String(e.competencia).trim() !== compIdStr);

            console.log(`[Store] Cache local sincronizado: Meses (${initialMesesCount} -> ${db.meses.length}), Execuções (${initialExecsCount} -> ${db.execucoes.length})`);

            // Registrar no log do sistema
            this.registerLog("Gestão de Competências", `Excluiu a competência: ${compIdStr} e todas as tarefas vinculadas.`);

            return true;

        } catch (e) {
            console.error("[Store] Falha crítica na exclusão da competência:", e);
            window.showNotify("Erro de Conexão", "Não foi possível conectar ao servidor para excluir a competência.", "error");
            return false;
        }
    },

    async addClient(clientData) {
        const {
            razaoSocial, cnpj, regime, responsavelFiscal, rotinasSelecionadasIds, driveLink,
            codigo: customCodigo, ie, im, dataAbertura, tipoEmpresa, contatoNome, email, telefone,
            loginEcac, senhaEcac, loginSefaz, senhaSefaz, loginPref, senhaPref, loginDominio, senhaDominio, outrosAcessos
        } = clientData;

        const codigo = customCodigo || `C${(db.clientes.length + 1).toString().padStart(3, '0')}`;

        const res = await apiFetch(`${API_BASE}/clientes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                razao_social: razaoSocial,
                cnpj,
                codigo,
                regime,
                responsavel_fiscal: responsavelFiscal || "",
                rotinas_selecionadas: rotinasSelecionadasIds || [],
                drive_link: driveLink || "",
                // Novos campos
                inscricao_estadual: ie,
                inscricao_municipal: im,
                data_abertura: dataAbertura,
                tipo_empresa: tipoEmpresa,
                contato_nome: contatoNome,
                email,
                telefone,
                login_ecac: loginEcac,
                senha_ecac: senhaEcac,
                login_sefaz: loginSefaz,
                senha_sefaz: senhaSefaz,
                login_pref: loginPref,
                senha_pref: senhaPref,
                login_dominio: loginDominio,
                senha_dominio: senhaDominio,
                outros_acessos: outrosAcessos,
                ativo: clientData.ativo !== false
            })
        });

        if (res.ok) {
            const savedData = await res.json();
            const newClient = savedData[0];
            const clientObj = {
                id: newClient.id, razaoSocial, cnpj, codigo, regime,
                responsavelFiscal, rotinasSelecionadas: rotinasSelecionadasIds, driveLink,
                ie, im, dataAbertura, tipoEmpresa, contatoNome, email, telefone,
                loginEcac, senhaEcac, loginSefaz, senhaSefaz, loginPref, senhaPref, loginDominio, senhaDominio, outrosAcessos,
                ativo: newClient.ativo !== false
            };
            db.clientes.push(clientObj);
            await this.engineRotinas(db.clientes[db.clientes.length - 1]);
            this.sendMensagem("Sistema", responsavelFiscal, `Novo cliente cadastrado: ${razaoSocial}.`);
            this.registerLog("Cadastrou Cliente", razaoSocial);
            return clientObj;
        } else {
            const errorMsg = await res.text();
            console.error('Erro API addClient:', res.status, errorMsg);
            window.showNotify("Erro ao Cadastrar", `Erro ao cadastrar cliente (${res.status}). Verifique a estrutura do banco.`, "error");
            return null;
        }


    },

    async addFuncionario(nome, setor, permissao, senha, cargo_id = null, ativo = true) {
        const todos = db.funcionarios;
        if (todos.some(f => f.nome.trim().toLowerCase() === nome.trim().toLowerCase())) {
            console.error("Erro Store: Nome de funcionário duplicado.");
            return false;
        }

        const res = await apiFetch(`${API_BASE}/funcionarios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, setor, permissao, senha, cargo_id, ativo })
        });
        if (res.ok) {
            const data = await res.json();
            db.funcionarios.push({ id: data[0].id, nome, setor, permissao, senha, cargo_id, ativo });
            this.registerLog("Gestão de Equipe", `Novo membro cadastrado: ${nome}`);
            return true;
        }
        return false;
    },

    async editFuncionario(id, nome, setor, permissao, senha, cargo_id, ativo) {
        const todos = db.funcionarios;
        if (todos.some(f => f.id != id && f.nome.trim().toLowerCase() === nome.trim().toLowerCase())) {
            console.error("Erro Store: Nome de funcionário duplicado na edição.");
            return false;
        }

        const res = await apiFetch(`${API_BASE}/funcionarios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, setor, permissao, senha, cargo_id, ativo })
        });
        if (res.ok) {
            const index = db.funcionarios.findIndex(f => f.id == id);
            if (index !== -1) {
                db.funcionarios[index] = { ...db.funcionarios[index], nome, setor, permissao, senha, cargo_id, ativo };
                this.registerLog("Gestão de Equipe", `Membro editado: ${nome} (Ativo: ${ativo})`);
                return true;
            }
        }
        return false;
    },

    async deleteFuncionario(id) {
        try {
            const res = await apiFetch(`${API_BASE}/funcionarios/${id}`, { method: 'DELETE' });
            if (res.ok) {
                db.funcionarios = db.funcionarios.filter(f => f.id == id ? false : true);
                this.registerLog("Gestão de Equipe", `Conta de funcionário removida (ID: ${id})`);
                return true;
            }
        } catch (e) {
            console.error("Erro Store deleteFuncionario:", e);
        }
        return false;
    },

    async addSetor(nome) {
        const res = await apiFetch(`${API_BASE}/setores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome })
        });
        if (res.ok) {
            const data = await res.json();
            db.setores.push(data[0].nome);
            this.registerLog("Gestão de Setores", `Novo setor cadastrado: ${nome}`);
        }
    },

    async deleteSetor(nome) {
        const res = await apiFetch(`${API_BASE}/setores/${encodeURIComponent(nome)}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            db.setores = db.setores.filter(s => s !== nome);
            this.registerLog("Gestão de Setores", `Setor excluído: ${nome}`);
        }
    },

    async addRotinaBase(nome, setor, frequencia, diaPrazoPadrao, checklistPadrao, selectedClientIds = [], responsavel = "") {
        try {
            const res = await apiFetch(`${API_BASE}/rotinas_base`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome, setor, frequencia,
                    dia_prazo_padrao: diaPrazoPadrao,
                    checklist_padrao: checklistPadrao || [],
                    responsavel
                })
            });
            if (res.ok) {
                const data = await res.json();
                db.rotinasBase.push({
                    id: data[0].id, nome, setor, frequencia, diaPrazoPadrao, checklistPadrao, responsavel
                });
                this.registerLog("Gestão de Rotinas", `Nova rotina base criada: ${nome}`);
                await this.updateClientesDaRotina(data[0].id, selectedClientIds);
                return data[0];
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.error('API POST erro:', res.status, errorData);
                window.showNotify("Erro ao Salvar", `Erro ao salvar rotina (${res.status}). Verifique a estrutura do banco.`, "error");

                const localId = Date.now();
                const newRot = {
                    id: localId, nome, setor, frequencia, diaPrazoPadrao, checklistPadrao, responsavel
                };
                db.rotinasBase.push(newRot);
                this.registerLog("Gestão de Rotinas", `Nova rotina base criada: ${nome} (Offline)`);
                await this.updateClientesDaRotina(localId, selectedClientIds);
                return newRot;
            }
        } catch (e) {
            console.error("Erro ao adicionar rotina base via API:", e);
            const localId = Date.now();
            const newRot = {
                id: localId, nome, setor, frequencia, diaPrazoPadrao, checklistPadrao, responsavel
            };
            db.rotinasBase.push(newRot);
            this.registerLog("Gestão de Rotinas", `Nova rotina base criada: ${nome} (Offline)`);
            this.updateClientesDaRotina(localId, selectedClientIds);
            return newRot;
        }
    },

    async deleteRotinaBase(id) {
        const rotinaIndex = db.rotinasBase.findIndex(r => r.id === id);
        if (rotinaIndex === -1) return;

        const rotinaNome = db.rotinasBase[rotinaIndex].nome;

        // Excluir todas as execuções vinculadas a esta rotina
        const execucoesVinculadas = db.execucoes.filter(e => e.rotina === rotinaNome);
        for (const exec of execucoesVinculadas) {
            try {
                await fetch(`${API_BASE}/execucoes/${exec.id}`, { method: 'DELETE' });
            } catch (e) {
                console.error(`[deleteRotinaBase] Erro ao excluir execução ${exec.id} da rotina ${rotinaNome}:`, e);
            }
        }
        // Remover do cache local
        db.execucoes = db.execucoes.filter(e => e.rotina !== rotinaNome);

        try {
            const res = await apiFetch(`${API_BASE}/rotinas_base/${id}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                console.warn('API DELETE endpoint para rotinas falhou ou não existe. Removendo localmente.', res.status);
            }

            db.rotinasBase.splice(rotinaIndex, 1);
            this.registerLog("Gestão de Rotinas", `Rotina base excluída: ${rotinaNome}`);
        } catch (e) {
            console.error("Erro ao excluir rotina base via API, fallback local:", e);
            db.rotinasBase.splice(rotinaIndex, 1);
            this.registerLog("Gestão de Rotinas", `Rotina base excluída: ${rotinaNome} (Offline)`);
        }
    },

    // Mocks para edição - em uma refatoração completa, estes seriam requisições PUT
    async editClient(id, clientData) {
        const {
            razaoSocial, cnpj, regime, responsavelFiscal, driveLink,
            codigo, ie, im, dataAbertura, tipoEmpresa, contatoNome, email, telefone,
            loginEcac, senhaEcac, loginSefaz, senhaSefaz, loginPref, senhaPref, loginDominio, senhaDominio, outrosAcessos
        } = clientData;

        // Fallback robusto para quando a chamada não envia o novo campo redundante
        const finalRotinasIds = clientData.rotinasSelecionadasIds || clientData.rotinasSelecionadas || [];

        const c = db.clientes.find(x => x.id === parseInt(id));
        if (c) {
            // Determinar rotinas adicionadas e removidas
            const oldRotinas = c.rotinasSelecionadas || [];
            const newRotinasIds = finalRotinasIds.filter(rId => !oldRotinas.includes(rId));
            const removedRotinasIds = oldRotinas.filter(rId => !finalRotinasIds.includes(rId));

            // Atualizar objeto local
            Object.assign(c, {
                razaoSocial, cnpj, regime, responsavelFiscal, rotinasSelecionadas: finalRotinasIds, driveLink,
                codigo, ie, im, dataAbertura, tipoEmpresa, contatoNome, email, telefone,
                loginEcac, senhaEcac, loginSefaz, senhaSefaz, loginPref, senhaPref, loginDominio, senhaDominio, outrosAcessos,
                ativo: clientData.ativo
            });

            // Lidar com remoções
            if (removedRotinasIds.length > 0) {
                const month = db.meses.find(m => m.ativo);
                if (month) {
                    const currentComp = month.id;
                    for (const rotId of removedRotinasIds) {
                        const rotina = db.rotinasBase.find(r => r.id === rotId);
                        if (rotina) {
                            // Encontra todas as execuções (da competência atual ou futuras)
                            // Isso garante que limpa tanto as obrigações deste mês quanto as 
                            // que foram geradas antecipadamente (Early Release) para o mês que vem.
                            const tasksToDelete = db.execucoes.filter(e =>
                                e.clienteId === c.id &&
                                e.rotina === rotina.nome &&
                                e.competencia >= currentComp
                            );

                            for (const task of tasksToDelete) {
                                await this.deleteExecucao(task.id);
                            }
                        }
                    }
                }
            }

            // Persistir alterações do cliente
            try {
                const res = await apiFetch(`${API_BASE}/clientes/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        razao_social: razaoSocial,
                        cnpj, regime,
                        responsavel_fiscal: responsavelFiscal,
                        rotinas_selecionadas: finalRotinasIds,
                        drive_link: driveLink,
                        codigo,
                        inscricao_estadual: ie,
                        inscricao_municipal: im,
                        data_abertura: dataAbertura,
                        tipo_empresa: tipoEmpresa,
                        contato_nome: contatoNome,
                        email, telefone,
                        login_ecac: loginEcac,
                        senha_ecac: senhaEcac,
                        login_sefaz: loginSefaz,
                        senha_sefaz: senhaSefaz,
                        login_pref: loginPref,
                        senha_pref: senhaPref,
                        login_dominio: loginDominio,
                        senha_dominio: senhaDominio,
                        outros_acessos: outrosAcessos,
                        ativo: clientData.ativo
                    })
                });
                if (!res.ok) {
                    const errorMsg = await res.text();
                    console.warn('API PUT cliente falhou.', res.status, errorMsg);
                    window.showNotify("Erro ao Salvar", `Erro ao salvar alterações (${res.status}). Verifique a estrutura do banco.`, "error");
                }


            } catch (e) {
                console.error("Erro ao editar cliente via API:", e);
            }

            this.registerLog("Editou Cliente", razaoSocial);

            // Lidar com adições
            if (newRotinasIds.length > 0) {
                const tempClient = { ...c, rotinasSelecionadas: newRotinasIds };
                await this.engineRotinas(tempClient);
            }
        }
    },

    async deleteClient(id) {
        const clientIndex = db.clientes.findIndex(c => c.id === id);
        if (clientIndex === -1) return;
        const cName = db.clientes[clientIndex].razaoSocial;

        try {
            const res = await apiFetch(`${API_BASE}/clientes/${id}`, { method: 'DELETE' });
            if (!res.ok) console.warn('API DELETE falhou.', res.status);

            db.clientes.splice(clientIndex, 1);
            this.registerLog("Gestão de Clientes", `Cliente excluído: ${cName}`);
        } catch (e) {
            console.error(e);
            db.clientes.splice(clientIndex, 1);
            this.registerLog("Gestão de Clientes", `Cliente excluído: ${cName} (Offline)`);
        }
    },


    async saveMarketingPost(postData) {
        const isEdit = !!postData.id;
        const url = isEdit ? `${API_BASE}/marketing_posts/${postData.id}` : `${API_BASE}/marketing_posts`;
        const method = isEdit ? 'PUT' : 'POST';

        const res = await apiFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData)
        });

        if (res.ok) {
            const data = await res.json();
            const savedPost = Array.isArray(data) ? data[0] : data;
            if (isEdit) {
                const idx = db.marketing_posts.findIndex(p => p.id === savedPost.id);
                if (idx !== -1) db.marketing_posts[idx] = savedPost;
            } else {
                db.marketing_posts.push(savedPost);
            }
            return savedPost;
        }
        return null;
    },

    async saveMarketingCampanha(campData) {
        const isEdit = !!campData.id;
        const url = isEdit ? `${API_BASE}/marketing_campanhas/${campData.id}` : `${API_BASE}/marketing_campanhas`;
        const method = isEdit ? 'PUT' : 'POST';

        const res = await apiFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(campData)
        });

        if (res.ok) {
            const data = await res.json();
            const savedCamp = Array.isArray(data) ? data[0] : data;
            if (isEdit) {
                const idx = db.marketing_campanhas.findIndex(c => c.id === savedCamp.id);
                if (idx !== -1) db.marketing_campanhas[idx] = savedCamp;
            } else {
                db.marketing_campanhas.push(savedCamp);
            }
            return savedCamp;
        }
        return null;
    },

    async editRotinaBase(id, nome, setor, frequencia, diaPrazoPadrao, checklistPadrao, selectedClientIds = [], responsavel = "") {
        const r = db.rotinasBase.find(x => x.id === parseInt(id));
        if (r) {
            r.nome = nome;
            r.setor = setor;
            r.frequencia = frequencia;
            r.diaPrazoPadrao = diaPrazoPadrao;
            r.checklistPadrao = checklistPadrao;
            r.responsavel = responsavel;

            try {
                const res = await apiFetch(`${API_BASE}/rotinas_base/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nome,
                        setor,
                        frequencia,
                        dia_prazo_padrao: diaPrazoPadrao,
                        checklist_padrao: checklistPadrao,
                        responsavel
                    })
                });
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    console.error('API PUT erro:', res.status, errorData);
                    window.showNotify("Erro ao Atualizar", `Erro ao atualizar rotina no banco de dados (${res.status}).`, "error");
                }
            } catch (e) {
                console.error("Erro ao editar rotina base via API:", e);
            }

            this.registerLog("Editou Rotina Base", nome);
            await this.updateClientesDaRotina(parseInt(id), selectedClientIds);
            return true;
        }
        return false;
    },

    async updateClientesDaRotina(rotinaId, selectedClientIds) {
        for (const cliente of db.clientes) {
            const rotinasAtual = cliente.rotinasSelecionadas || [];
            const hasRotina = rotinasAtual.includes(rotinaId);
            const shouldHaveRotina = selectedClientIds.includes(cliente.id);

            if (hasRotina && !shouldHaveRotina) {
                const novasRotinas = rotinasAtual.filter(id => id !== rotinaId);
                console.log(`[Store] Removendo rotina ${rotinaId} do cliente ${cliente.razaoSocial}`);
                await this.editClient(cliente.id, {
                    ...cliente,
                    rotinasSelecionadasIds: novasRotinas
                });
            } else if (!hasRotina && shouldHaveRotina) {
                const novasRotinas = [...rotinasAtual, rotinaId];
                console.log(`[Store] Adicionando rotina ${rotinaId} ao cliente ${cliente.razaoSocial}`);
                await this.editClient(cliente.id, {
                    ...cliente,
                    rotinasSelecionadasIds: novasRotinas
                });
            }
        }
    },

    // --- CARGOS (RBAC) ---
    async addCargo(nome_cargo, telas_permitidas) {
        try {
            const res = await apiFetch(`${API_BASE}/cargos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome_cargo, telas_permitidas: telas_permitidas || [] })
            });
            if (res.ok) {
                const data = await res.json();
                db.cargos.push(data[0]);
                this.registerLog("Segurança", `Novo Cargo Criado: ${nome_cargo}`);
                return true;
            }
        } catch (e) { console.error(e); }
        return false;
    },

    async updateCargo(id, nome_cargo, telas_permitidas) {
        try {
            const res = await apiFetch(`${API_BASE}/cargos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome_cargo, telas_permitidas: telas_permitidas || [] })
            });
            if (res.ok) {
                const data = await res.json();
                const index = db.cargos.findIndex(c => c.id === id);
                if (index !== -1) {
                    db.cargos[index] = data[0];
                    this.registerLog("Segurança", `Permissões atualizadas para o cargo: ${nome_cargo}`);
                    return true;
                }
            }
        } catch (e) { console.error(e); }
        return false;
    },

    async deleteCargo(id) {
        try {
            const index = db.cargos.findIndex(c => c.id === id);
            if (index === -1) return false;
            const cargoNome = db.cargos[index].nome_cargo;

            const res = await apiFetch(`${API_BASE}/cargos/${id}`, { method: 'DELETE' });
            if (res.ok) {
                db.cargos.splice(index, 1);
                this.registerLog("Segurança", `Cargo Excluído: ${cargoNome}`);
                return true;
            }
        } catch (e) { console.error(e); }
        return false;
    },

    getAuthBySession(sessionId) {
        console.log("--- DEBUG SESSÃO --- ID:", sessionId);
        if (!sessionId || sessionId === "null") return null;
        if (!Array.isArray(db.funcionarios)) {
            console.warn("DB_ERRO: Tabela de funcionários não carregada.");
            return null;
        }

        const tempAuth = db.funcionarios.find(f => String(f.id) === String(sessionId));
        if (!tempAuth || tempAuth.ativo === false) {
            console.warn("LOGIN_BLOCK: Funcionário não encontrado ou inativo para ID:", sessionId);
            return null;
        }

        let auth = { ...tempAuth };
        auth.telas_permitidas = [];

        // 1. Carregar permissões do Cargo (se existir)
        if (Array.isArray(db.cargos) && db.cargos.length > 0) {
            const cargo = db.cargos.find(c => c.id === auth.cargo_id || (auth.permissao && c.nome_cargo === auth.permissao));
            if (cargo && cargo.telas_permitidas) {
                auth.telas_permitidas = Array.isArray(cargo.telas_permitidas) ? cargo.telas_permitidas :
                    (typeof cargo.telas_permitidas === 'string' ? JSON.parse(cargo.telas_permitidas) : []);
            }
        }

        // 2. BLINDAGEM ADMINISTRATIVA (Override Absoluto)
        const isGerente = auth.permissao && auth.permissao.toLowerCase() === 'gerente';
        const isAdminNome = auth.nome && (auth.nome.toLowerCase() === 'manager' || auth.nome.toLowerCase() === 'admin');

        if (isGerente || isAdminNome) {
            console.log(`BLINDAGEM: Perfil administrativo detectado (${auth.permissao}). Forçando abas de gestão.`);
            const adminScreens = ['dashboard', 'operacional', 'clientes', 'equipe', 'rotinas', 'mensagens', 'marketing', 'settings', 'competencias', 'meu-desempenho'];

            // Garantir que todas as telas de admin estejam presentes
            adminScreens.forEach(s => {
                if (!auth.telas_permitidas.includes(s)) auth.telas_permitidas.push(s);
            });
        }

        // 3. Fallback para funcionários comuns
        if (auth.telas_permitidas.length === 0) {
            auth.telas_permitidas = ['operacional', 'meu-desempenho', 'mensagens'];
        }

        console.log(`SESSION_OK: Logado como ${auth.nome} [${auth.permissao}]. Telas Ativas:`, auth.telas_permitidas);
        return auth;
    },

    async login(username, password) {
        try {
            const res = await apiFetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (res.ok) {
                const data = await res.json();
                const auth = data.user;
                // Frontend agora confia no Payload do Backend que já processou 
                // Seguranca, Cargos e Telas Permitidas
                if (auth && auth.telas_permitidas) {
                    this.registerLog("Acesso", `${auth.nome} fez login no sistema via JWT.`);
                    return auth;
                } else {
                    console.warn("Payload de login malformado", auth);
                }
            } else {
                const errorData = await res.json();
                window.showNotify("Erro", errorData.detail || "Usuário ou senha inválidos", "error");
            }
        } catch (e) {
            console.error("Erro no login:", e);
            window.showNotify("Erro", "Falha de conexão com o servidor.", "error");
        }
        return null;
    },

    // Envio de mensagens com persistência no Supabase
    async sendMensagem(remetente, destinatario, texto, assunto = 'Sem Assunto') {
        const now = new Date().toISOString();
        const payload = {
            remetente,
            destinatario,
            texto,
            assunto: assunto || 'Sem Assunto',
            lida: false,
            data: now,
            excluido_por: [],
            favorito: false
        };
        try {
            const res = await apiFetch(`${API_BASE}/mensagens`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const data = await res.json();
                const savedId = (data && data[0]) ? data[0].id : Date.now();
                db.mensagens.push({ ...payload, excluidoPor: [], id: savedId });
            } else {
                // Fallback local se API falhar
                db.mensagens.push({ ...payload, excluidoPor: [], id: Date.now() });
                console.warn("API falhou ao salvar mensagem, salvo localmente.");
            }
        } catch (e) {
            console.error("Erro ao enviar msg API:", e);
            db.mensagens.push({ ...payload, excluidoPor: [], id: Date.now() });
        }
    },

    async deleteMensagem(id, usuario) {
        const m = db.mensagens.find(msg => msg.id == id);
        if (m) {
            if (!m.excluidoPor) m.excluidoPor = [];
            if (!m.excluidoPor.includes(usuario)) {
                m.excluidoPor.push(usuario);
            }
            try {
                // Soft delete: envia lista de usuários que excluíram (msg permanece no banco)
                const res = await apiFetch(`${API_BASE}/mensagens/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ excluido_por: m.excluidoPor })
                });
                if (!res.ok) {
                    console.warn(`API PUT mensagem ${id} retornou status ${res.status}`);
                }
            } catch (e) {
                console.warn("Falha ao registrar exclusão na API:", e);
            }
            this.registerLog("Excluiu Mensagem (Soft)", `Usuário: ${usuario}, MsgID: ${id}`);
            return true;
        }
        return false;
    },

    getMensagensPara(usuario) {
        return db.mensagens
            .filter(m => m.destinatario === usuario && !(m.excluidoPor || []).includes(usuario))
            .sort((a, b) => new Date(b.data) - new Date(a.data));
    },

    getMensagensEnviadas(usuario) {
        return db.mensagens
            .filter(m => m.remetente === usuario && !(m.excluidoPor || []).includes(usuario))
            .sort((a, b) => new Date(b.data) - new Date(a.data));
    },

    getUnreadCount(usuario) {
        return db.mensagens.filter(m =>
            m.destinatario === usuario &&
            !m.lida &&
            !(m.excluidoPor || []).includes(usuario)
        ).length;
    },

    getUnreadInboxCount(usuario) {
        return db.mensagens.filter(m =>
            m.destinatario === usuario &&
            !m.lida &&
            m.remetente !== 'Sistema' &&
            !(m.excluidoPor || []).includes(usuario)
        ).length;
    },

    getUnreadSystemCount(usuario) {
        return db.mensagens.filter(m =>
            m.destinatario === usuario &&
            !m.lida &&
            m.remetente === 'Sistema' &&
            !(m.excluidoPor || []).includes(usuario)
        ).length;
    },

    async markMensagemLida(id) {
        const m = db.mensagens.find(x => x.id === id);
        if (m) {
            m.lida = true;
            try {
                await fetch(`${API_BASE}/mensagens/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lida: true })
                });
            } catch (e) { console.error("Falha ao marcar msg lida", e); }
        }
    },

    async criarExecucaoEventual(rotinaId, clienteId) {
        const rotina = db.rotinasBase.find(r => r.id === parseInt(rotinaId));
        const cliente = db.clientes.find(c => c.id === parseInt(clienteId));

        if (!rotina || !cliente) {
            console.error('[criarExecucaoEventual] Rotina ou cliente não encontrado.');
            return { ok: false, msg: 'Rotina ou cliente não encontrado.' };
        }

        const month = db.meses.find(m => m.ativo);
        const currentComp = month ? month.id : new Date().toISOString().slice(0, 7);

        // Verifica duplicidade: mesma rotina + cliente + competência já pendente
        const jaExiste = db.execucoes.find(e =>
            e.clienteId === cliente.id &&
            e.rotina === rotina.nome &&
            e.competencia === currentComp &&
            !e.feito
        );
        if (jaExiste) {
            return { ok: false, msg: `Já existe uma demanda "${rotina.nome}" pendente para ${cliente.razaoSocial} neste mês.` };
        }

        // Prazo: hoje + diaPrazoPadrao dias corridos
        const diasSLA = parseInt(rotina.diaPrazoPadrao) || 0;
        const prazoEvt = new Date();
        prazoEvt.setDate(prazoEvt.getDate() + diasSLA);
        const dateStr = prazoEvt.toISOString().split('T')[0];

        // Normalizar checklist
        const subitems = (rotina.checklistPadrao || []).map((item, idx) => ({
            id: idx + 1,
            texto: typeof item === 'string' ? item : item.texto,
            done: false
        }));

        try {
            const res = await apiFetch(`${API_BASE}/execucoes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente_id: cliente.id,
                    rotina: rotina.nome,
                    competencia: currentComp,
                    dia_prazo: dateStr,
                    drive_link: cliente.driveLink || '',
                    responsavel: rotina.responsavel || 'Automático',
                    subitems: subitems,
                    eh_pai: true,
                    feito: false,
                    iniciado_em: new Date().toISOString().split('T')[0],
                    checklist_gerado: true
                })
            });

            if (res.ok) {
                const data = await res.json();
                const newId = data[0] ? data[0].id : Date.now();
                db.execucoes.push({
                    id: newId,
                    clienteId: cliente.id,
                    rotina: rotina.nome,
                    competencia: currentComp,
                    diaPrazo: dateStr,
                    driveLink: cliente.driveLink || '',
                    feito: false,
                    feitoEm: null,
                    responsavel: rotina.responsavel || 'Automático',
                    iniciadoEm: new Date().toISOString().split('T')[0],
                    checklistGerado: true,
                    ehPai: true,
                    subitems: subitems
                });
                // Rotinas eventuais nao vinculam o cliente permanentemente.
                // A execucao fica salva apenas na competencia atual (historico/auditoria).
                this.registerLog('Demanda Eventual', `Criada demanda "${rotina.nome}" para ${cliente.razaoSocial} (prazo: ${dateStr})`);
                return { ok: true };
            } else {
                console.error('[criarExecucaoEventual] Erro API:', res.status);
                return { ok: false, msg: `Erro ao criar demanda (${res.status}).` };
            }
        } catch (e) {
            console.error('[criarExecucaoEventual] Erro de rede:', e);
            return { ok: false, msg: 'Erro de conexão ao criar demanda.' };
        }
    },

    async engineRotinas(cliente) {

        // Construir rotinas para o mês ativo
        const month = db.meses.find(m => m.ativo);
        if (!month) {
            console.warn("Rotinas Engine abortado: Nenhum mês ativo definido no sistema.");
            return;
        }

        const currentComp = month.id; // p. ex. "2026-02"
        const routinesToProcess = cliente.rotinasSelecionadas || [];
        if (routinesToProcess.length === 0) return;

        console.log(`[Engine] Processando ${routinesToProcess.length} rotinas para o cliente ${cliente.razaoSocial}`);

        for (const rotId of routinesToProcess) {
            const rotina = db.rotinasBase.find(r => r.id === rotId);
            if (!rotina) continue;

            // Rotinas eventuais são criadas apenas manualmente pelo painel operacional — nunca auto-geradas
            if ((rotina.frequencia || '').toLowerCase() === 'eventual') {
                console.log(`[Engine] Pulando rotina eventual "${rotina.nome}" — criação manual apenas.`);
                continue;
            }

            // Calcular data de prazo conforme a frequência da rotina
            let dateStr;
            if (rotina.frequencia === 'Eventual') {
                // Para rotinas eventuais: prazo = hoje + diaPrazoPadrao dias corridos
                const diasSLA = parseInt(rotina.diaPrazoPadrao) || 0;
                const prazoEvt = new Date();
                prazoEvt.setDate(prazoEvt.getDate() + diasSLA);
                dateStr = prazoEvt.toISOString().split('T')[0];
            } else if (rotina.frequencia === 'Anual' && rotina.diaPrazoPadrao.toString().includes('/')) {
                // Para rotinas anuais no formato DD/MM: usa o ano atual
                const [diaAnual, mesAnual] = rotina.diaPrazoPadrao.toString().split('/');
                const anoAtual = new Date().getFullYear();
                dateStr = `${anoAtual}-${mesAnual.padStart(2, '0')}-${diaAnual.padStart(2, '0')}`;
            } else {
                // Para rotinas mensais: dia fixo no mês da execução (competência + 1 mês)
                let [y, mStr] = currentComp.split('-');
                let execDate = new Date(parseInt(y), parseInt(mStr) - 1, 1);
                execDate.setMonth(execDate.getMonth() + 1);
                let execY = execDate.getFullYear();
                let execM = (execDate.getMonth() + 1).toString().padStart(2, '0');
                let dia = rotina.diaPrazoPadrao.toString().padStart(2, '0');
                dateStr = `${execY}-${execM}-${dia}`;
            }

            // Checklists podem ser arrays de strings ou objetos. Normalizar para objetos em "execuções".
            const subitems = (rotina.checklistPadrao || []).map((item, idx) => {
                const text = typeof item === 'string' ? item : item.texto;
                return {
                    id: idx + 1,
                    texto: text,
                    done: false
                };
            });

            // Verificar se a tarefa já existe para evitar duplicação
            const exists = db.execucoes.find(e =>
                e.clienteId === cliente.id &&
                e.rotina === rotina.nome &&
                e.competencia === currentComp
            );

            if (exists) {
                console.log(`[Engine] Tarefa já existe: ${cliente.razaoSocial} - ${rotina.nome} (${currentComp})`);
                continue;
            }

            // Enviar tarefa para a API
            try {
                const res = await apiFetch(`${API_BASE}/execucoes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cliente_id: cliente.id,
                        rotina: rotina.nome,
                        competencia: currentComp,
                        dia_prazo: dateStr,
                        drive_link: cliente.driveLink,
                        responsavel: rotina.responsavel || "Automático",
                        subitems: subitems,
                        eh_pai: true,
                        feito: false,
                        iniciado_em: new Date().toISOString().split('T')[0],
                        checklist_gerado: true
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    const newId = data[0] ? data[0].id : Date.now();
                    db.execucoes.push({
                        id: newId,
                        clienteId: cliente.id,
                        rotina: rotina.nome,
                        competencia: currentComp,
                        diaPrazo: dateStr,
                        driveLink: cliente.driveLink,
                        feito: false,
                        feitoEm: null,
                        responsavel: rotina.responsavel || "Automático",
                        iniciadoEm: new Date().toISOString().split('T')[0],
                        checklistGerado: true,
                        ehPai: true,
                        subitems: subitems
                    });
                    console.log(`[Engine] Tarefa criada com sucesso: ${rotina.nome} (ID: ${newId})`);
                } else {
                    console.warn(`[Engine] Falha ao criar tarefa para ${rotina.nome}. Status: ${res.status}`);
                }
            } catch (e) {
                console.error(`[Engine] Erro de rede ao criar tarefa para ${rotina.nome}:`, e);
            }
        }
    },

    // -----------------------------------------------------------------
    // MÉTODOS DE MARKETING
    // -----------------------------------------------------------------
    async saveMarketingPost(postData) {
        const isEdit = !!postData.id;
        const url = isEdit ? `${API_BASE}/marketing_posts/${postData.id}` : `${API_BASE}/marketing_posts`;
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await apiFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postData)
            });

            if (res.ok) {
                const data = await res.json();
                const savedPost = Array.isArray(data) ? data[0] : data;
                if (isEdit) {
                    const idx = db.marketing_posts.findIndex(p => p.id === savedPost.id);
                    if (idx !== -1) db.marketing_posts[idx] = savedPost;
                } else {
                    db.marketing_posts.push(savedPost);
                }
                this.registerLog("Comunicação", `${isEdit ? 'Atualizou' : 'Criou'} conteúdo: ${postData.titulo}`);
                return savedPost;
            }
        } catch (e) { console.error("Erro ao salvar post marketing:", e); }
        return null;
    },

    async updateMarketingPostStatus(id, newStatus) {
        const post = db.marketing_posts.find(p => p.id === id);
        if (post) {
            post.status = newStatus;
            try {
                await fetch(`${API_BASE}/marketing_posts/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });
                this.registerLog("Comunicação", `Moveu card #${id} para '${newStatus}'`);
            } catch (e) { console.error(e); }
        }
    },

    async saveMarketingCampanha(campData) {
        const isEdit = !!campData.id;
        const url = isEdit ? `${API_BASE}/marketing_campanhas/${campData.id}` : `${API_BASE}/marketing_campanhas`;
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await apiFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(campData)
            });

            if (res.ok) {
                const data = await res.json();
                const savedCamp = Array.isArray(data) ? data[0] : data;
                if (isEdit) {
                    const idx = db.marketing_campanhas.findIndex(c => c.id === savedCamp.id);
                    if (idx !== -1) db.marketing_campanhas[idx] = savedCamp;
                } else {
                    db.marketing_campanhas.push(savedCamp);
                }
                this.registerLog("Campanha", `${isEdit ? 'Atualizou' : 'Lançou'} campanha: ${campData.nome}`);
                return savedCamp;
            }
        } catch (e) { console.error("Erro ao salvar campanha:", e); }
        return null;
    },

    async addMarketingEquipeMember(memberData) {
        try {
            const res = await apiFetch(`${API_BASE}/marketing_equipe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(memberData)
            });
            if (res.ok) {
                const data = await res.json();
                db.marketing_equipe.push(data[0]);
                return data[0];
            }
        } catch (e) { console.error(e); }
        return null;
    },

    async deleteMarketingEquipeMember(id) {
        try {
            const res = await apiFetch(`${API_BASE}/marketing_equipe/${id}`, { method: 'DELETE' });
            if (res.ok) {
                // Remover do cache local
                db.marketing_equipe = db.marketing_equipe.filter(m => m.id !== id);
                return true;
            }
        } catch (e) {
            console.error("Erro Store deleteMarketingEquipeMember:", e);
        }
        return false;
    },

    async updateBranding(configData) {
        // Objeto db.config já é atualizado localmente pela UI se necessário,
        // mas aqui garantimos o PUT para o banco (global_config/1 assumido)
        try {
            const res = await apiFetch(`${API_BASE}/global_config/1`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    brand_name: configData.brandName,
                    brand_logo_url: configData.brandLogoUrl,
                    accent_color: configData.accentColor,
                    slogan: configData.slogan,
                    theme: configData.theme,
                    menu_order: configData.menuOrder || db.config.menuOrder
                })
            });
            if (res.ok) {
                db.config = { ...db.config, ...configData };
                this.registerLog("Sistema", `Identidade visual atualizada.`);
                return true;
            }
        } catch (e) { console.error(e); }
        return false;
    },

    async updateGlobalConfig(newConfig) {
        // Garantir que a ordem do menu seja uma string JSON para o banco se for array
        let menuOrderValue = newConfig.menu_order || newConfig.menuOrder || db.config.menuOrder;

        // Atualização Otimista: Salvar localmente primeiro
        const finalOrder = Array.isArray(menuOrderValue) ? menuOrderValue : (typeof menuOrderValue === 'string' ? JSON.parse(menuOrderValue) : []);
        db.config = {
            ...db.config,
            ...newConfig,
            menuOrder: finalOrder,
            menu_order: finalOrder
        };

        try {
            const res = await apiFetch(`${API_BASE}/global_config/1`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    brand_name: newConfig.brandName || db.config.brandName,
                    brand_logo_url: newConfig.brandLogoUrl || db.config.brandLogoUrl,
                    accent_color: newConfig.accentColor || db.config.accentColor,
                    slogan: newConfig.slogan || db.config.slogan,
                    theme: newConfig.theme || db.config.theme,
                    menu_order: Array.isArray(menuOrderValue) ? JSON.stringify(menuOrderValue) : menuOrderValue
                })
            });
            if (res.ok) {
                this.registerLog("Sistema", `Configurações globais atualizadas.`);
                return true;
            } else {
                console.warn(`API PUT global_config/1 falhou com status ${res.status}. Dados salvos localmente.`);
                return true; // Retorna true para o frontend re-renderizar
            }
        } catch (e) {
            console.error("Erro ao atualizar config global:", e);
            return true; // Retornar true permite funcionamento offline visual
        }
    }
};

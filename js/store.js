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
    config: { autoBackup: false, lastBackupData: null },
    cargos: [] // New generic permissions table
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
                clientesRes, mesesRes, execucoesRes, mensagensRes, logsRes, cargosRes
            ] = await Promise.all([
                fetch(`${API_BASE}/setores`),
                fetch(`${API_BASE}/funcionarios`),
                fetch(`${API_BASE}/rotinas_base`),
                fetch(`${API_BASE}/clientes`),
                fetch(`${API_BASE}/meses`),
                fetch(`${API_BASE}/execucoes`),
                fetch(`${API_BASE}/mensagens`),
                fetch(`${API_BASE}/logs`),
                fetch(`${API_BASE}/cargos`)
            ]);

            db.setores = (await setoresRes.json()).map(s => s.nome) || [];
            db.funcionarios = await funcionariosRes.json() || [];
            db.rotinasBase = await rotinasBaseRes.json() || [];
            db.clientes = await clientesRes.json() || [];
            db.meses = await mesesRes.json() || [];
            db.execucoes = await execucoesRes.json() || [];
            db.mensagens = await mensagensRes.json() || [];
            db.logs = await logsRes.json() || [];

            // Try to set cargos (can fail if table doesn't exist yet, fallback to empty array)
            try {
                const cargosData = await cargosRes.json();
                db.cargos = Array.isArray(cargosData) ? cargosData : [];
            } catch (e) {
                db.cargos = [];
            }

            // Map python rotinasBase to expected camelCase names for legacy frontend compatibility
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
            // Fallback for visual offline testing if needed, or notify user
            alert("Erro de conexão com o banco de dados. Tente atualizar a página.");
            return false;
        }
    },

    // As in local storage, but now wait for fetch
    async loadFromStorage() {
        const loaded = await this.fetchAllData();
        if (loaded) {
            await this.checkCompetenciaRollover();
        }
        return loaded;
    },

    async checkCompetenciaRollover() {
        if (!db.meses) db.meses = [];

        const now = new Date();
        const year = now.getFullYear();
        const monthNum = (now.getMonth() + 1).toString().padStart(2, '0');
        const currentCompId = `${year}-${monthNum}`;
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const currentExt = `${monthNames[now.getMonth()]} ${year}`;

        // Check if current real-world month exists in DB
        const exists = db.meses.find(m => m.id === currentCompId);

        if (!exists) {
            console.log(`[Rollover] Mês ${currentCompId} não existe. Iniciando virada de competência...`);

            // Deactivate old active months
            const oldActives = db.meses.filter(m => m.ativo);
            for (let m of oldActives) {
                m.ativo = false;
                try {
                    await fetch(`${API_BASE}/meses/${m.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ativo: false })
                    });
                } catch (e) {
                    console.error("Erro ao desativar mês antigo:", e);
                }
            }

            // Create new month
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
                const res = await fetch(`${API_BASE}/meses`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newMonth)
                });

                if (res.ok) {
                    // It returns array, map back
                    const data = await res.json();
                    db.meses.push(data[0]);
                    this.registerLog("Sistema", `Competência virada para ${currentExt}`);

                    // Bootstrapping engine: Trigger creation of tasks for all clients
                    console.log(`[Rollover] Gerando tarefas para ${db.clientes.length} clientes...`);
                    // We must wait a tiny bit to assure month was pushed locally
                    for (let cliente of db.clientes) {
                        this.engineRotinas(cliente);
                    }
                }
            } catch (e) {
                console.error("Erro ao criar nova competência:", e);
            }
        } else if (!exists.ativo) {
            // Fix edge case where month exists but is not marked active
            exists.ativo = true;
            await fetch(`${API_BASE}/meses/${exists.id}`, {
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

    // Action Disparators - API MOCK
    // In a real deep restructuring we would have an app.put('/api/execucoes/{id}') on Python
    async toggleExecucaoFeito(id, isFeito) {
        const ex = db.execucoes.find(e => e.id === id);
        const username = (typeof LOGGED_USER !== 'undefined' && LOGGED_USER) ? LOGGED_USER.nome : "Sistema";
        ex.feito = isFeito;
        ex.feitoEm = isFeito ? new Date().toISOString().split('T')[0] : null;
        ex.baixadoPor = isFeito ? username : null;

        if (isFeito) ex.subitems.forEach(s => s.done = true);
        else ex.subitems.forEach(s => s.done = false);

        await fetch(`${API_BASE}/execucoes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                feito: ex.feito,
                feito_em: ex.feitoEm,
                baixado_por: ex.baixadoPor, // Persistindo quem baixou
                subitems: ex.subitems
            })
        });

        this.registerLog("Ação de Rotina", `Marcou rotina '${ex.rotina}' como ${isFeito ? 'Concluída' : 'Pendente'}`);
    },

    async deleteExecucao(id) {
        db.execucoes = db.execucoes.filter(e => e.id !== id);
        try {
            await fetch(`${API_BASE}/execucoes/${id}`, { method: 'DELETE' });
        } catch (e) {
            console.error("Erro ao excluir execução via API:", e);
        }
    },

    async updateChecklist(execId, subId, isDone) {
        const ex = db.execucoes.find(e => e.id === execId);
        const username = (typeof LOGGED_USER !== 'undefined' && LOGGED_USER) ? LOGGED_USER.nome : "Sistema";
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

        await fetch(`${API_BASE}/execucoes/${execId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                feito: ex.feito,
                feito_em: ex.feitoEm,
                baixado_por: ex.baixado_por,
                subitems: ex.subitems
            })
        });

        this.registerLog("Atualizou Checklist", `Checklist item id ${subId} (rotina ${ex.rotina}) - ${isDone ? 'Feito' : 'Desfeito'}`);
    },

    async addClient(clientData) {
        const {
            razaoSocial, cnpj, regime, responsavelFiscal, rotinasSelecionadasIds, driveLink,
            codigo: customCodigo, ie, im, dataAbertura, tipoEmpresa, contatoNome, email, telefone,
            loginEcac, senhaEcac, loginSefaz, senhaSefaz, loginPref, senhaPref, loginDominio, senhaDominio, outrosAcessos
        } = clientData;

        const codigo = customCodigo || `C${(db.clientes.length + 1).toString().padStart(3, '0')}`;

        const res = await fetch(`${API_BASE}/clientes`, {
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
            alert(`Erro ao cadastrar cliente (${res.status}): ${errorMsg}\n\nVerifique se a tabela no Supabase tem todas as colunas necessárias.`);
            return null;
        }


    },

    async addFuncionario(nome, setor, permissao, senha, ativo = true) {
        const res = await fetch(`${API_BASE}/funcionarios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, setor, permissao, senha, ativo })
        });
        if (res.ok) {
            const data = await res.json();
            db.funcionarios.push({ id: data[0].id, nome, setor, permissao, senha, ativo });
            this.registerLog("Gestão de Equipe", `Novo membro cadastrado: ${nome}`);
        }
    },

    async editFuncionario(id, nome, setor, permissao, senha, ativo) {
        const res = await fetch(`${API_BASE}/funcionarios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, setor, permissao, senha, ativo })
        });
        if (res.ok) {
            const index = db.funcionarios.findIndex(f => f.id === parseInt(id));
            if (index !== -1) {
                db.funcionarios[index] = { ...db.funcionarios[index], nome, setor, permissao, senha, ativo };
                this.registerLog("Gestão de Equipe", `Membro editado: ${nome} (Ativo: ${ativo})`);
            }
        }
    },

    async addSetor(nome) {
        const res = await fetch(`${API_BASE}/setores`, {
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
        const res = await fetch(`${API_BASE}/setores/${encodeURIComponent(nome)}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            db.setores = db.setores.filter(s => s !== nome);
            this.registerLog("Gestão de Setores", `Setor excluído: ${nome}`);
        }
    },

    async addRotinaBase(nome, setor, frequencia, diaPrazoPadrao, checklistPadrao, selectedClientIds = [], responsavel = "") {
        try {
            const res = await fetch(`${API_BASE}/rotinas_base`, {
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
                alert(`Erro ao salvar rotina no banco de dados (${res.status}). Verifique se as colunas necessárias existem.`);

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
        // if (typeof LOGGED_USER === 'undefined' || !LOGGED_USER || LOGGED_USER.permissao !== 'Gerente') {
        //    console.warn("Ação de exclusão bloqueada devido a nível de permissão.");
        //    return;
        // }

        const rotinaIndex = db.rotinasBase.findIndex(r => r.id === id);
        if (rotinaIndex === -1) return;

        const rotinaNome = db.rotinasBase[rotinaIndex].nome;

        try {
            const res = await fetch(`${API_BASE}/rotinas_base/${id}`, {
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

    // Mocks for edit - in a full refactor these would be PUT requests
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
            // Determine added and removed routines
            const oldRotinas = c.rotinasSelecionadas || [];
            const newRotinasIds = finalRotinasIds.filter(rId => !oldRotinas.includes(rId));
            const removedRotinasIds = oldRotinas.filter(rId => !finalRotinasIds.includes(rId));

            // Update local object
            Object.assign(c, {
                razaoSocial, cnpj, regime, responsavelFiscal, rotinasSelecionadas: finalRotinasIds, driveLink,
                codigo, ie, im, dataAbertura, tipoEmpresa, contatoNome, email, telefone,
                loginEcac, senhaEcac, loginSefaz, senhaSefaz, loginPref, senhaPref, loginDominio, senhaDominio, outrosAcessos,
                ativo: clientData.ativo
            });

            // Handle Removals
            if (removedRotinasIds.length > 0) {
                const month = db.meses.find(m => m.ativo);
                if (month) {
                    const currentComp = month.id;
                    for (const rotId of removedRotinasIds) {
                        const rotina = db.rotinasBase.find(r => r.id === rotId);
                        if (rotina) {
                            const taskToDelete = db.execucoes.find(e => e.clienteId === c.id && e.rotina === rotina.nome && e.competencia === currentComp);
                            if (taskToDelete) {
                                await this.deleteExecucao(taskToDelete.id);
                            }
                        }
                    }
                }
            }

            // Persist Client Changes
            try {
                const res = await fetch(`${API_BASE}/clientes/${id}`, {
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
                    alert(`Erro ao salvar alterações do cliente (${res.status}): ${errorMsg}\n\nIsso geralmente ocorre se faltarem colunas no banco de dados Supabase.`);
                }


            } catch (e) {
                console.error("Erro ao editar cliente via API:", e);
            }

            this.registerLog("Editou Cliente", razaoSocial);

            // Handle Additions
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
            const res = await fetch(`${API_BASE}/clientes/${id}`, { method: 'DELETE' });
            if (!res.ok) console.warn('API DELETE falhou.', res.status);

            db.clientes.splice(clientIndex, 1);
            this.registerLog("Gestão de Clientes", `Cliente excluído: ${cName}`);
        } catch (e) {
            console.error(e);
            db.clientes.splice(clientIndex, 1);
            this.registerLog("Gestão de Clientes", `Cliente excluído: ${cName} (Offline)`);
        }
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
                const res = await fetch(`${API_BASE}/rotinas_base/${id}`, {
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
                    alert(`Erro ao atualizar rotina no banco de dados (${res.status}).`);
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
            const res = await fetch(`${API_BASE}/cargos`, {
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
            const res = await fetch(`${API_BASE}/cargos/${id}`, {
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

            const res = await fetch(`${API_BASE}/cargos/${id}`, { method: 'DELETE' });
            if (res.ok) {
                db.cargos.splice(index, 1);
                this.registerLog("Segurança", `Cargo Excluído: ${cargoNome}`);
                return true;
            }
        } catch (e) { console.error(e); }
        return false;
    },

    getAuthBySession(sessionId) {
        if (!sessionId) return null;
        if (sessionId === '999' || sessionId === 999) {
            return { id: 999, nome: 'Manager', setor: 'Todos', permissao: 'Gerente', telas_permitidas: ['dashboard', 'operacional', 'clientes', 'equipe', 'rotinas', 'mensagens', 'settings'] };
        }

        const tempAuth = db.funcionarios.find(f => f.id === parseInt(sessionId));
        if (!tempAuth || tempAuth.ativo === false) return null;

        let auth = { ...tempAuth };
        auth.telas_permitidas = [];

        if (db.cargos && db.cargos.length > 0) {
            const cargo = db.cargos.find(c => c.id === auth.cargo_id || c.nome_cargo === auth.permissao);
            if (cargo && cargo.telas_permitidas) {
                auth.telas_permitidas = cargo.telas_permitidas;
            }
        }

        if (auth.telas_permitidas.length === 0) {
            if (auth.permissao === 'Gerente') {
                auth.telas_permitidas = ['dashboard', 'operacional', 'clientes', 'equipe', 'rotinas', 'mensagens', 'settings'];
            } else {
                auth.telas_permitidas = ['operacional', 'meu-desempenho', 'mensagens'];
            }
        }

        return auth;
    },

    login(username, password) {
        let auth = null;
        if (username === 'Manager' && password === '123') {
            auth = this.getAuthBySession('999');
        } else {
            const tempAuth = db.funcionarios.find(f => f.nome === username && f.senha === password);
            if (tempAuth) {
                auth = this.getAuthBySession(tempAuth.id);
            }
        }

        if (auth) {
            this.registerLog("Acesso", `${auth.nome} fez login no sistema.`);
            return auth;
        }
        return null;
    },

    // Additional methods mock
    async sendMensagem(remetente, destinatario, texto, assunto = 'Sem Assunto') {
        const m = { id: Date.now(), remetente, destinatario, texto, assunto, lida: false, data: new Date().toISOString() };
        db.mensagens.push(m);
        try {
            await fetch(`${API_BASE}/mensagens`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ remetente, destinatario, texto, assunto, lida: false })
            });
        } catch (e) { console.error("Erro ao enviar msg API:", e); }
    },

    async deleteMensagem(id) {
        const idx = db.mensagens.findIndex(m => m.id == id);
        if (idx !== -1) {
            const m = db.mensagens[idx];
            db.mensagens.splice(idx, 1);
            try {
                const res = await fetch(`${API_BASE}/mensagens/${id}`, { method: 'DELETE' });
                if (!res.ok) throw new Error("API Delete Failed");
            } catch (e) {
                console.warn("Falha ao deletar msg API, revertendo local:", e);
                db.mensagens.push(m); // Rollback shallow
                return false;
            }
            this.registerLog("Excluiu Mensagem", `ID: ${id}`);
            return true;
        }
        return false;
    },

    getMensagensPara(usuario) {
        return db.mensagens.filter(m => m.destinatario === usuario).sort((a, b) => new Date(b.data) - new Date(a.data));
    },

    getUnreadCount(usuario) {
        return db.mensagens.filter(m => m.destinatario === usuario && !m.lida).length;
    },

    getUnreadInboxCount(usuario) {
        return db.mensagens.filter(m => m.destinatario === usuario && !m.lida && m.remetente !== 'Sistema').length;
    },

    getUnreadSystemCount(usuario) {
        return db.mensagens.filter(m => m.destinatario === usuario && !m.lida && m.remetente === 'Sistema').length;
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

    async engineRotinas(cliente) {
        // Build routines for the active month
        const month = db.meses.find(m => m.ativo);
        if (!month) {
            console.warn("Rotinas Engine abortado: Nenhum mês ativo definido no sistema.");
            return;
        }

        const currentComp = month.id; // e.g. "2026-02"
        const routinesToProcess = cliente.rotinasSelecionadas || [];
        if (routinesToProcess.length === 0) return;

        console.log(`[Engine] Processando ${routinesToProcess.length} rotinas para o cliente ${cliente.razaoSocial}`);

        for (const rotId of routinesToProcess) {
            const rotina = db.rotinasBase.find(r => r.id === rotId);
            if (!rotina) continue;

            // Format deadline date for PostgreSQL (YYYY-MM-DD)
            let [y, mStr] = currentComp.split('-');
            let dia = rotina.diaPrazoPadrao.toString().padStart(2, '0');
            let dateStr = `${y}-${mStr}-${dia}`;

            // Checklists might be arrays of strings or objects. Normalize to objects for 'execucoes'.
            const subitems = (rotina.checklistPadrao || []).map((item, idx) => {
                const text = typeof item === 'string' ? item : item.texto;
                return {
                    id: idx + 1,
                    texto: text,
                    done: false
                };
            });

            // Verify if task already exists to avoid duplication
            const exists = db.execucoes.find(e =>
                e.clienteId === cliente.id &&
                e.rotina === rotina.nome &&
                e.competencia === currentComp
            );

            if (exists) {
                console.log(`[Engine] Tarefa já existe: ${cliente.razaoSocial} - ${rotina.nome} (${currentComp})`);
                continue;
            }

            // Dispatch task to API
            try {
                const res = await fetch(`${API_BASE}/execucoes`, {
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
    }
};

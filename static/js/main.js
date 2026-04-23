document.addEventListener('DOMContentLoaded', function () {

    // ─────────────────────────────────────────────────────────────
    //  UPLOAD COM BARRA DE PROGRESSO (XMLHttpRequest)
    // ─────────────────────────────────────────────────────────────
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        const fileInput = document.getElementById('fileInput');
        const fileNameDisplay = document.getElementById('fileName');

        if (fileInput && fileNameDisplay) {
            fileInput.addEventListener('change', () => {
                if (fileInput.files && fileInput.files.length > 0) {
                    fileNameDisplay.textContent = fileInput.files[0].name;
                    fileNameDisplay.classList.add('has-file');
                } else {
                    fileNameDisplay.textContent = 'Nenhum arquivo selecionado';
                    fileNameDisplay.classList.remove('has-file');
                }
            });
        }

        uploadForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const formData = new FormData(uploadForm);
            const loadingOverlay = document.getElementById('global-loading');
            const loadingMsg = document.getElementById('loading-msg');
            const progressWrap = document.getElementById('upload-progress-wrap');
            const progressBar = document.getElementById('upload-progress-bar');
            const progressPct = document.getElementById('upload-progress-pct');

            // Exibe loading com barra de progresso
            if (loadingOverlay) loadingOverlay.style.display = 'flex';
            if (progressWrap) progressWrap.style.display = 'block';
            if (loadingMsg) loadingMsg.textContent = 'Enviando arquivo...';

            const xhr = new XMLHttpRequest();

            // Progresso do upload
            xhr.upload.addEventListener('progress', function (evt) {
                if (evt.lengthComputable) {
                    const pct = Math.round((evt.loaded / evt.total) * 100);
                    if (progressBar) progressBar.style.width = pct + '%';
                    if (progressPct) progressPct.textContent = pct + '%';
                    if (pct === 100 && loadingMsg) {
                        loadingMsg.textContent = 'Processando dados, aguarde...';
                        if (progressWrap) progressWrap.style.display = 'none';
                    }
                }
            });

            xhr.addEventListener('load', function () {
                if (loadingOverlay) loadingOverlay.style.display = 'none';

                try {
                    const resp = JSON.parse(xhr.responseText);
                    if (resp.status === 'ok') {
                        // Monta a interface sem recarregar a página inteira
                        buildMainApp(resp.colunas, resp.total_linhas);
                    } else {
                        alert('Erro ao processar arquivo: ' + resp.message);
                    }
                } catch (err) {
                    alert('Resposta inesperada do servidor.');
                    console.error(err);
                }
            });

            xhr.addEventListener('error', function () {
                if (loadingOverlay) loadingOverlay.style.display = 'none';
                alert('Erro de conexão ao enviar o arquivo.');
            });

            xhr.open('POST', '/upload', true);
            xhr.send(formData);
        });
    }

    // ─────────────────────────────────────────────────────────────
    //  MONTA A INTERFACE PRINCIPAL VIA AJAX (sem reload de página)
    // ─────────────────────────────────────────────────────────────
    function buildMainApp(colunas, totalLinhas) {
        // Esconde upload, monta main dinamicamente
        document.querySelector('.upload-container') && (document.querySelector('.upload-container').style.display = 'none');

        // Constrói o HTML das colunas
        const thIndex = `<th style="display:none">_Index_</th>`;
        const thCols = colunas.map(c => `<th data-col-name="${escHtml(c)}">${escHtml(c)}</th>`).join('');

        const checkboxes = colunas.map(c =>
            `<label><input type="checkbox" name="colunas" value="${escHtml(c)}" checked> ${escHtml(c)}</label>`
        ).join('');

        const selectOptions = colunas.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');

        const mainHtml = `
        <main class="main-container" id="mainApp">
          <aside class="sidebar">
            <button type="button" class="btn btn-secondary" id="btnTrocarArquivo" style="width:100%;margin-bottom:1.5rem;">
              <i class="fas fa-arrow-left"></i> Trocar Arquivo
            </button>
            <h2>Filtros</h2>
            <form id="filterForm">
              <input type="text" name="busca" placeholder="Pesquisar em todas as colunas..." list="sugestoes">
              <div id="search-feedback" style="display:none; font-size:0.78rem; margin-top:0.35rem; padding:0.3rem 0.6rem; border-radius:6px;"></div>
              <datalist id="sugestoes"></datalist>
              <br>
              ${checkboxes}
              <br>
              <label><input type="checkbox" name="remover_caracteres" value="1" id="checkRemoverCaracteres"> Limpar pontuação ( ) - e espaços</label>
              <select name="coluna_limpar" id="selectColunaLimpar" disabled style="opacity:0.45;cursor:not-allowed;margin-top:0.4rem;">
                <option value="">Escolha a coluna...</option>
                <option value="TODAS">Todas (CUIDADO com espaços)</option>
                ${selectOptions}
              </select>
              <hr style="margin:1rem 0;border:0;border-top:1px solid #e2e8f0;">
              <label class="dedup-toggle"><input type="checkbox" name="remover_duplicados" value="1" id="checkRemoverDuplicados"> Remover linhas duplicadas</label>
            </form>
          </aside>
          <section class="content">
            <h2>Prévia dos Dados
              <span id="badge-total" style="font-size:0.75rem;background:rgba(59,130,246,0.2);color:#93c5fd;padding:0.2rem 0.7rem;border-radius:999px;margin-left:0.5rem;font-weight:500;vertical-align:middle;">${totalLinhas} linhas</span>
              <span id="badge-loading" style="display:none;font-size:0.72rem;color:#94a3b8;margin-left:0.4rem;vertical-align:middle;"><i class="fas fa-circle-notch fa-spin" style="font-size:0.8rem;"></i></span>
            </h2>
            <div class="table-container">
              <table id="previewTable" class="display" style="width:100%">
                <thead><tr>${thIndex}${thCols}</tr></thead>
                <tbody></tbody>
              </table>
            </div>
            <br>
            <div style="display:flex;gap:1rem;flex-wrap:wrap;">
              <form id="downloadForm" action="/baixar" method="POST">
                <input type="hidden" name="col_order" id="colOrderInput">
                <button type="submit" class="btn"><i class="fas fa-download"></i> Baixar Excel Filtrado</button>
              </form>
              <form id="splitForm" action="/dividir_baixar" method="POST" style="display:flex;gap:0.5rem;align-items:center;">
                <input type="hidden" name="col_order" id="colOrderInputSplit">
                <label for="num_parts" style="margin-bottom:0;">Dividir em:</label>
                <input type="number" name="num_parts" id="num_parts" min="2" max="100" value="3" required style="width:60px;padding:0.5rem;border-radius:6px;border:1px solid #ccc;font-family:inherit;">
                <span style="margin-right:0.5rem;">partes</span>
                <button type="submit" class="btn" style="background-color:#10b981;"><i class="fas fa-file-archive"></i> Baixar ZIP com CSVs</button>
              </form>
            </div>
          </section>
        </main>`;

        // Injeta no body (após o header)
        const header = document.querySelector('header');
        const wrapper = document.createElement('div');
        wrapper.innerHTML = mainHtml;
        header.insertAdjacentElement('afterend', wrapper.firstElementChild);

        initMainLogic(colunas);
    }

    function escHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ─────────────────────────────────────────────────────────────
    //  LÓGICA PRINCIPAL (DataTable server-side + filtros + edição)
    // ─────────────────────────────────────────────────────────────
    let dataTableInstance = null;
    let currentColunasEscolhidas = null;
    let userColumnOrder = []; // persiste a ordem definida pelo usuário via ColReorder

    function initMainLogic(colunasParam) {
        // Suporte à tela carregada via Jinja (GET com colunas) OU via buildMainApp
        const mainApp = document.getElementById('mainApp');
        if (!mainApp) return;

        const colunasAll = colunasParam || JSON.parse(mainApp.dataset.colunas || '[]');
        currentColunasEscolhidas = colunasParam || JSON.parse(mainApp.dataset.colunasEscolhidas || '[]');

        initDataTable(currentColunasEscolhidas);
        bindFilterForm(colunasAll);
        bindDownloadForms();
        bindTrocarArquivo();
    }

    // ─── DataTable com Server-Side Processing ───
    function initDataTable(colunasEscolhidas) {
        const tableContainer = document.querySelector('.table-container');
        if (!tableContainer) return;

        // Salva a ordem atual de colunas (nome dos <th>) antes de destruir
        // Isso preserva o reorder feito pelo usuário via drag-and-drop
        const existingTable = document.getElementById('previewTable');
        if (existingTable && $.fn.DataTable.isDataTable(existingTable)) {
            // Lê os <th> na ordem visual atual (ColReorder já reordenou o DOM)
            const ths = existingTable.querySelectorAll('thead th');
            userColumnOrder = Array.from(ths)
                .map(th => th.dataset.colName || th.textContent.trim())
                .filter(name => name && name !== '_Index_');

            $(existingTable).off('dblclick', 'tbody td');
            $(existingTable).DataTable().destroy(true);
        }
        dataTableInstance = null;

        // Reordena colunasEscolhidas conforme a última ordem do usuário:
        // - colunas já posicionadas mantêm sua posição relativa
        // - colunas recém-ativadas (não estavam no userColumnOrder) vão para o final
        if (userColumnOrder.length > 0) {
            const ordered = userColumnOrder.filter(c => colunasEscolhidas.includes(c));
            const newOnes = colunasEscolhidas.filter(c => !userColumnOrder.includes(c));
            colunasEscolhidas = [...ordered, ...newOnes];
        }

        // Recria o elemento <table> do zero (limpa qualquer resíduo de plugins)
        const thIndex = '<th style="display:none">_Index_</th>';
        const thCols = colunasEscolhidas.map(c =>
            `<th data-col-name="${escHtml(c)}">${escHtml(c)}</th>`
        ).join('');
        tableContainer.innerHTML =
            `<table id="previewTable" class="display" style="width:100%">
               <thead><tr>${thIndex}${thCols}</tr></thead>
               <tbody></tbody>
             </table>`;

        const previewTable = document.getElementById('previewTable');

        // Colunas visíveis: índice oculto (0) + colunas escolhidas
        const columns = [{ data: 0, visible: false }].concat(
            colunasEscolhidas.map((_, i) => ({ data: i + 1 }))
        );

        dataTableInstance = $(previewTable).DataTable({
            serverSide: true,
            processing: true,
            ajax: {
                url: '/dados',
                type: 'GET',
                data: function (d) { return d; }
            },
            columns: columns,
            language: {
                url: "//cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json"
            },
            pageLength: 50,
            lengthMenu: [25, 50, 100, 250, 500],
            ordering: true,
            info: true,
            lengthChange: true,
            responsive: false,
            scrollX: true,
            colReorder: true,
            fixedColumns: { left: 1 },
            searching: false,
            drawCallback: function () {
                const info = dataTableInstance.page.info();
                const badge = document.getElementById('badge-total');
                if (badge) badge.textContent = info.recordsDisplay + ' linhas';

                // ── Proteção do select de page length ──
                guardLengthSelect();
            }
        });

        // Double-click para edição inline
        $(previewTable).on('dblclick', 'tbody td', function () {
            let cell = dataTableInstance.cell(this);
            if (!cell || !cell.index()) return;

            let colIdx = cell.index().column;
            if (colIdx === 0) return; // não editar o index

            let originalValue = cell.data();
            let $td = $(this);
            if ($td.find('input').length > 0) return;

            let rowData = dataTableInstance.row($td.closest('tr')).data();
            let rowId = rowData ? rowData[0] : null;

            let headerEl = $(dataTableInstance.column(colIdx).header());
            let headerName = headerEl.data('col-name') || headerEl.text();

            let input = $('<input type="text">').val(originalValue).css({
                'width': '100%',
                'padding': '0.4rem',
                'border': '1px solid var(--color-primary)',
                'background': 'rgba(0,0,0,0.5)',
                'color': '#fff',
                'border-radius': '4px',
                'outline': 'none'
            });

            $td.html(input);
            input.focus();

            input.on('blur keydown', function (e) {
                if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== 'Escape') return;

                let newValue = $(this).val();
                if (e.key === 'Escape') newValue = originalValue;

                $td.html(newValue);
                cell.data(newValue);

                if (newValue !== originalValue && rowId !== null) {
                    let formData = new FormData();
                    formData.append('row_id', rowId);
                    formData.append('col_name', headerName);
                    formData.append('new_value', newValue);

                    fetch('/editar_celula', { method: 'POST', body: formData })
                        .then(res => res.json())
                        .then(data => {
                            if (data.status === 'success') {
                                $td.css('background-color', 'rgba(16, 185, 129, 0.1)');
                                setTimeout(() => { $td.css('background-color', ''); }, 1500);
                            } else {
                                alert("Erro ao salvar: " + data.message);
                                $td.html(originalValue);
                                cell.data(originalValue);
                            }
                        })
                        .catch(err => console.error(err));
                }
            });
        });
    }

    // ─── Proteção do select de page length contra manipulação via DevTools ───
    const ALLOWED_LENGTHS = new Set([25, 50, 100, 250, 500]);
    let _lengthSelectObserver = null;

    function guardLengthSelect() {
        const sel = document.getElementById('previewTable_length')
            ?.querySelector('select');
        if (!sel) return;

        // Reverte qualquer option cujo value não esteja na lista permitida
        function sanitizeOptions() {
            let changed = false;
            sel.querySelectorAll('option').forEach(opt => {
                const v = parseInt(opt.value, 10);
                if (!ALLOWED_LENGTHS.has(v)) {
                    // Restaura para o valor original mais próximo permitido
                    const closest = [...ALLOWED_LENGTHS].reduce((a, b) =>
                        Math.abs(b - v) < Math.abs(a - v) ? b : a
                    );
                    opt.value = String(closest);
                    opt.textContent = String(closest);
                    changed = true;
                }
            });
            // Se o valor selecionado foi alterado, força retorno para 50
            if (!ALLOWED_LENGTHS.has(parseInt(sel.value, 10))) {
                sel.value = '50';
                if (dataTableInstance) dataTableInstance.page.len(50).draw();
            }
        }

        sanitizeOptions();

        // Intercepta change: bloqueia seleção de valor inválido
        sel.addEventListener('change', function (e) {
            const v = parseInt(this.value, 10);
            if (!ALLOWED_LENGTHS.has(v)) {
                e.stopImmediatePropagation();
                this.value = '50';
                if (dataTableInstance) dataTableInstance.page.len(50).draw();
            }
        }, true); // capture = true para interceptar antes do handler do DataTables

        // MutationObserver: detecta edição via DevTools em tempo real
        if (_lengthSelectObserver) _lengthSelectObserver.disconnect();
        _lengthSelectObserver = new MutationObserver(sanitizeOptions);
        _lengthSelectObserver.observe(sel, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['value']
        });
    }

    // ─── Filtros (AJAX para /filtrar, depois recarrega DataTable) ───
    function bindFilterForm(colunasAll) {
        const filterForm = document.getElementById('filterForm');
        if (!filterForm) return;

        let debounceTimer;

        const fetchFilters = () => {
            // Indicador discreto: apenas o spinner no badge, sem overlay bloqueante
            const badgeLoading = document.getElementById('badge-loading');
            if (badgeLoading) badgeLoading.style.display = 'inline';

            const formData = new FormData(filterForm);

            // Usa um parser seguro que corrige NaNs não citados vindo do Python
            fetch('/filtrar', {
                method: 'POST',
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                body: formData
            })
                .then(res => res.text()) // Lê como texto primeiro
                .then(text => {
                    // Corrige literais NaN, Infinity e -Infinity que quebram o JSON.parse
                    // (podem aparecer como valor de objeto OU dentro de arrays)
                    const cleaned = text.replace(/-Infinity\b/g, 'null')
                                        .replace(/\bInfinity\b/g, 'null')
                                        .replace(/\bNaN\b/g, 'null');
                    return JSON.parse(cleaned);
                })
                .then(resp => {
                    if (resp.status === 'ok') {
                        currentColunasEscolhidas = resp.colunas_escolhidas;

                        // Feedback de busca
                        const busca = filterForm.querySelector('input[name="busca"]')?.value?.trim();
                        const fb = document.getElementById('search-feedback');
                        if (fb) {
                            if (busca) {
                                const total = resp.total_filtrado ?? 0;
                                if (total === 0) {
                                    fb.style.display = 'block';
                                    fb.style.background = 'rgba(239,68,68,0.12)';
                                    fb.style.color = '#fca5a5';
                                    fb.textContent = `Nenhum resultado para "${busca}"`;
                                } else {
                                    fb.style.display = 'block';
                                    fb.style.background = 'rgba(16,185,129,0.12)';
                                    fb.style.color = '#6ee7b7';
                                    fb.textContent = `${total} resultado${total !== 1 ? 's' : ''} para "${busca}"`;
                                }
                            } else {
                                fb.style.display = 'none';
                            }
                        }

                        // Feedback de duplicados removidos
                        if (resp.duplicados_removidos > 0) {
                            showDedupToast(resp.duplicados_removidos);
                        }

                        // Atualiza sugestões
                        const datalist = document.getElementById('sugestoes');
                        if (datalist && resp.sugestoes) {
                            datalist.innerHTML = resp.sugestoes.map(s =>
                                `<option value="${escHtml(String(s))}">`
                            ).join('');
                        }

                        // Reinicia DataTable com novas colunas e recarrega dados
                        // (initDataTable já reconstrói o <table> internamente)
                        initDataTable(resp.colunas_escolhidas);
                    }
                })
                .catch(err => {
                    console.error('Erro na filtragem', err);
                })
                .finally(() => {
                    if (badgeLoading) badgeLoading.style.display = 'none';
                });
        };

        // Debounce para busca por digitação
        const searchInput = filterForm.querySelector('input[name="busca"]');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(fetchFilters, 500);
            });
        }

        bindCleanToggle(filterForm);

        // Checkboxes e selects disparam imediatamente
        const otherInputs = filterForm.querySelectorAll('input[type="checkbox"], select');
        otherInputs.forEach(input => input.addEventListener('change', fetchFilters));

        // Previne submit tradicional
        filterForm.addEventListener('submit', function (e) {
            e.preventDefault();
            fetchFilters();
        });
    }

    // ─── Ativa/desativa o select de coluna de limpeza ───
    function bindCleanToggle(form) {
        const chk = (form || document).querySelector('#checkRemoverCaracteres');
        const sel = (form || document).querySelector('#selectColunaLimpar');
        if (!chk || !sel) return;

        const updateState = () => {
            sel.disabled = !chk.checked;
            sel.style.opacity = chk.checked ? '1' : '0.45';
            sel.style.cursor = chk.checked ? 'pointer' : 'not-allowed';
        };

        chk.addEventListener('change', updateState);
        updateState();
    }

    // ─── Toast de duplicados removidos ───
    function showDedupToast(count) {
        // Remove toast anterior se existir
        const old = document.getElementById('dedup-toast');
        if (old) old.remove();

        const toast = document.createElement('div');
        toast.id = 'dedup-toast';
        toast.innerHTML = `<i class="fas fa-filter" style="margin-right:0.5rem;"></i>${count} linha${count !== 1 ? 's duplicadas removidas' : ' duplicada removida'}`;
        toast.style.cssText = [
            'position:fixed', 'bottom:1.5rem', 'right:1.5rem', 'z-index:99999',
            'background:linear-gradient(135deg,#7c3aed,#3b82f6)',
            'color:#fff', 'padding:0.75rem 1.25rem', 'border-radius:12px',
            'font-size:0.88rem', 'font-weight:500', 'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
            'display:flex', 'align-items:center',
            'opacity:0', 'transform:translateY(12px)',
            'transition:opacity 0.3s ease, transform 0.3s ease'
        ].join(';');
        document.body.appendChild(toast);

        // Anima entrada
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateY(0)';
            });
        });

        // Remove após 4s
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(12px)';
            setTimeout(() => toast.remove(), 350);
        }, 4000);
    }

    // ─── Formulários de download (injeta ordem de colunas) ───
    function bindDownloadForms() {
        document.addEventListener('submit', function (e) {
            if (!e.target) return;
            if (e.target.id === 'downloadForm' || e.target.id === 'splitForm') {
                if (dataTableInstance) {
                    let cols = [];
                    $(dataTableInstance.table().header()).find('th').each(function () {
                        let text = $(this).data('col-name') || $(this).text();
                        if (text && text !== '_Index_') cols.push(text.trim());
                    });
                    if (e.target.id === 'downloadForm') {
                        const inp = document.getElementById('colOrderInput');
                        if (inp) inp.value = JSON.stringify(cols);
                    } else {
                        const inp = document.getElementById('colOrderInputSplit');
                        if (inp) inp.value = JSON.stringify(cols);
                    }
                }
            }
        });
    }

    // ─── Botão "Trocar Arquivo" (dinâmico) ───
    function bindTrocarArquivo() {
        document.addEventListener('click', function (e) {
            if (e.target && (e.target.id === 'btnTrocarArquivo' || e.target.closest('#btnTrocarArquivo'))) {
                window.location.href = '/';
            }
        });
    }

    // ─────────────────────────────────────────────────────────────
    //  INIT: tela carregada via Jinja (com colunas já no HTML)
    // ─────────────────────────────────────────────────────────────
    const mainApp = document.getElementById('mainApp');
    if (mainApp) {
        initMainLogic(null);
    }

    function escHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
});

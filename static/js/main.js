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
            if (loadingOverlay) loadingOverlay.classList.add('active');
            if (progressWrap) progressWrap.classList.add('active');
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
                        if (progressWrap) progressWrap.classList.remove('active');
                    }
                }
            });

            xhr.addEventListener('load', function () {
                if (loadingOverlay) loadingOverlay.classList.remove('active');

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
                if (loadingOverlay) loadingOverlay.classList.remove('active');
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

        const colListHeader = `
          <div class="col-list-header">
            <span class="col-list-count" id="colCount">${colunas.length} colunas</span>
            <button type="button" class="col-list-toggle" id="btnToggleAll">Desmarcar todas</button>
          </div>
          <input type="text" id="colSearch" placeholder="Filtrar colunas..." class="col-search-input">
          <div class="col-checkbox-list" id="colCheckboxList">
            ${colunas.map(c => `
              <label class="col-checkbox-item">
                <input type="checkbox" name="colunas" value="${escHtml(c)}" checked>
                <span>${escHtml(c)}</span>
              </label>`).join('')}
          </div>`;

        const selectOptions = colunas.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');

        const mainHtml = `
        <main class="main-container" id="mainApp">
          <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
              <button type="button" class="btn btn-secondary" id="btnTrocarArquivo" style="width:100%;">
                <i class="fas fa-arrow-left"></i> Trocar Arquivo
              </button>
              <button type="button" class="btn-icon" id="btnCollapseSidebar"
                aria-label="Ocultar filtros" title="Ocultar filtros">
                <i class="fas fa-chevron-left"></i>
              </button>
            </div>
            <form id="filterForm">
              <div class="sidebar-section">
                <span class="sidebar-section-label">Pesquisa</span>
                <input type="text" name="busca" placeholder="Buscar em todas as colunas..." list="sugestoes">
                <div id="search-feedback" class="search-feedback"></div>
                <datalist id="sugestoes"></datalist>
              </div>
              <div class="sidebar-section">
                ${colListHeader}
              </div>
              <div class="sidebar-section">
                <hr>
                <span class="sidebar-section-label">Limpeza</span>
                <label><input type="checkbox" name="remover_caracteres" value="1" id="checkRemoverCaracteres"> Limpar pontuação e espaços</label>
                <select name="coluna_limpar" id="selectColunaLimpar" disabled>
                  <option value="">Escolha a coluna...</option>
                  <option value="TODAS">Todas as colunas</option>
                  ${selectOptions}
                </select>
              </div>
              <div class="sidebar-section">
                <span class="sidebar-section-label">Deduplicação</span>
                <label><input type="checkbox" name="remover_duplicados" value="1" id="checkRemoverDuplicados"> Remover linhas duplicadas</label>
              </div>
            </form>
          </aside>
          <section class="content">
            <div class="content-header">
              <h2>Prévia dos Dados
                <span id="badge-total" class="badge-count">${totalLinhas} linhas</span>
                <span id="badge-loading" class="badge-loading"><i class="fas fa-circle-notch fa-spin"></i></span>
              </h2>
            </div>
            <div class="table-container">
              <table id="previewTable" class="display" style="width:100%">
                <thead><tr>${thIndex}${thCols}</tr></thead>
                <tbody></tbody>
              </table>
            </div>
            <div class="action-bar">
              <form id="downloadForm" action="/baixar" method="POST" class="action-bar-group">
                <input type="hidden" name="col_order" id="colOrderInput">
                <button type="submit" class="btn"><i class="fas fa-download"></i> Baixar Excel</button>
              </form>
              <div class="action-bar-divider"></div>
              <form id="splitForm" action="/dividir_baixar" method="POST" class="action-bar-group">
                <input type="hidden" name="col_order" id="colOrderInputSplit">
                <span class="action-bar-label">Dividir em</span>
                <input type="number" name="num_parts" id="num_parts" min="2" max="100" value="3" required class="num-parts-input">
                <span class="action-bar-label">partes</span>
                <button type="submit" class="btn btn-success"><i class="fas fa-file-archive"></i> Baixar ZIP</button>
              </form>
            </div>
          </section>
          <button class="sidebar-open-btn" id="btnOpenSidebar"
            aria-label="Mostrar filtros" title="Mostrar filtros">
            <i class="fas fa-sliders-h"></i>
          </button>
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
    let userPageLength = 50;  // persiste o pageLength escolhido pelo usuário

    function initMainLogic(colunasParam) {
        // Suporte à tela carregada via Jinja (GET com colunas) OU via buildMainApp
        const mainApp = document.getElementById('mainApp');
        if (!mainApp) return;

        const colunasAll = colunasParam || JSON.parse(mainApp.dataset.colunas || '[]');
        currentColunasEscolhidas = colunasParam || JSON.parse(mainApp.dataset.colunasEscolhidas || '[]');

        initDataTable(currentColunasEscolhidas);
        bindFilterForm(colunasAll);
        initColSearch();
        bindDownloadForms();
        bindTrocarArquivo();
        bindSidebarToggle();
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

            // Preserva o pageLength escolhido pelo usuário
            userPageLength = $(existingTable).DataTable().page.len();

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
            pageLength: userPageLength,
            lengthMenu: [[25, 50, 100, 250, 500, 1000, -1], [25, 50, 100, 250, 500, 1000, "Tudo"]],
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

                // ── Atualiza indicadores de scroll ──
                updateScrollIndicators();
            }
        });

        // Roda uma única vez após a inicialização (não a cada draw)
        setTimeout(() => {
            initTableScroll();
        }, 150);

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

            let input = $('<input type="text">').val(originalValue).addClass('edit-cell-input');

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


    // ─── Scroll horizontal refinado da tabela ───
    function initTableScroll() {
        const scrollBody = document.querySelector('.dataTables_scrollBody');
        const scrollHead = document.querySelector('.dataTables_scrollHead');
        if (!scrollBody) return;

        // Garante que o wrapper existe e está aplicado ao contêiner certo
        const dtScroll = scrollBody.closest('.dataTables_scroll');
        if (!dtScroll) return;

        // Remove versão anterior do wrapper se já existir
        const oldWrapper = dtScroll.parentNode.querySelector('.table-scroll-wrapper');
        if (oldWrapper && oldWrapper.contains(dtScroll)) {
            // Já envolvido — apenas atualiza os indicadores
            updateScrollIndicators();
            return;
        }

        // Envolve o bloco DataTables num wrapper relativo
        const wrapper = document.createElement('div');
        wrapper.className = 'table-scroll-wrapper';
        dtScroll.parentNode.insertBefore(wrapper, dtScroll);
        wrapper.appendChild(dtScroll);

        // Sombras laterais
        const hintL = document.createElement('div');
        hintL.className = 'table-scroll-hint hint-left';
        const hintR = document.createElement('div');
        hintR.className = 'table-scroll-hint hint-right';

        // Setas de navegação
        const arrowL = document.createElement('button');
        arrowL.className = 'scroll-arrow scroll-arrow-left';
        arrowL.type = 'button';
        arrowL.title = 'Rolar para a esquerda';
        arrowL.innerHTML = '<i class="fas fa-chevron-left"></i>';

        const arrowR = document.createElement('button');
        arrowR.className = 'scroll-arrow scroll-arrow-right';
        arrowR.type = 'button';
        arrowR.title = 'Rolar para a direita';
        arrowR.innerHTML = '<i class="fas fa-chevron-right"></i>';

        wrapper.appendChild(hintL);
        wrapper.appendChild(hintR);
        wrapper.appendChild(arrowL);
        wrapper.appendChild(arrowR);

        // Scroll com passo suave
        const STEP = 240;
        arrowL.addEventListener('click', () => scrollBody.scrollBy({ left: -STEP, behavior: 'smooth' }));
        arrowR.addEventListener('click', () => scrollBody.scrollBy({ left:  STEP, behavior: 'smooth' }));

        // Sincroniza cabeçalho com o corpo ao rolar
        scrollBody.addEventListener('scroll', () => {
            if (scrollHead) scrollHead.scrollLeft = scrollBody.scrollLeft;
            updateScrollIndicators();
        });

        // Estado inicial
        updateScrollIndicators();
    }

    function updateScrollIndicators() {
        const scrollBody = document.querySelector('.dataTables_scrollBody');
        const wrapper    = document.querySelector('.table-scroll-wrapper');
        if (!scrollBody || !wrapper) return;

        const { scrollLeft, scrollWidth, clientWidth } = scrollBody;
        const hasScroll    = scrollWidth > clientWidth + 2;
        const canScrollL   = scrollLeft > 2;
        const canScrollR   = scrollLeft < scrollWidth - clientWidth - 2;

        wrapper.querySelector('.hint-left') ?.classList.toggle('visible', canScrollL);
        wrapper.querySelector('.hint-right')?.classList.toggle('visible', canScrollR && hasScroll);
        wrapper.querySelector('.scroll-arrow-left') ?.classList.toggle('visible', canScrollL);
        wrapper.querySelector('.scroll-arrow-right')?.classList.toggle('visible', canScrollR && hasScroll);
    }

    // ─── Filtros (AJAX para /filtrar, depois recarrega DataTable) ───
    function bindFilterForm(colunasAll) {
        const filterForm = document.getElementById('filterForm');
        if (!filterForm) return;

        let debounceTimer;

        const fetchFilters = () => {
            // Indicador discreto: apenas o spinner no badge, sem overlay bloqueante
            const badgeLoading = document.getElementById('badge-loading');
            if (badgeLoading) badgeLoading.classList.add('active');

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
                            fb.className = 'search-feedback';
                            if (busca) {
                                const total = resp.total_filtrado ?? 0;
                                if (total === 0) {
                                    fb.classList.add('search-feedback--error');
                                    fb.textContent = `Nenhum resultado para "${busca}"`;
                                } else {
                                    fb.classList.add('search-feedback--success');
                                    fb.textContent = `${total} resultado${total !== 1 ? 's' : ''} para "${busca}"`;
                                }
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
                    if (badgeLoading) badgeLoading.classList.remove('active');
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

    // ─── Pesquisa rápida e toggle de colunas ───
    function initColSearch() {
        const colSearch = document.getElementById('colSearch');
        const btnToggleAll = document.getElementById('btnToggleAll');
        const colCheckboxList = document.getElementById('colCheckboxList');
        if (!colCheckboxList) return;

        // Filtro de pesquisa
        if (colSearch) {
            colSearch.addEventListener('input', () => {
                const q = colSearch.value.trim().toLowerCase();
                const items = colCheckboxList.querySelectorAll('.col-checkbox-item');
                let visibleCount = 0;
                items.forEach(item => {
                    const label = item.querySelector('span')?.textContent.toLowerCase() || '';
                    const match = label.includes(q);
                    item.classList.toggle('hidden', !match);
                    if (match) visibleCount++;
                });
                const countEl = document.getElementById('colCount');
                if (countEl) countEl.textContent = q
                    ? `${visibleCount} encontrada${visibleCount !== 1 ? 's' : ''}`
                    : `${items.length} colunas`;
            });
        }

        // Toggle marcar/desmarcar todas
        if (btnToggleAll) {
            const updateToggleLabel = () => {
                const checkboxes = colCheckboxList.querySelectorAll('input[type="checkbox"]');
                const allChecked = Array.from(checkboxes).every(c => c.checked);
                btnToggleAll.textContent = allChecked ? 'Desmarcar todas' : 'Marcar todas';
            };

            btnToggleAll.addEventListener('click', () => {
                const checkboxes = colCheckboxList.querySelectorAll('input[type="checkbox"]');
                const allChecked = Array.from(checkboxes).every(c => c.checked);
                checkboxes.forEach(c => { c.checked = !allChecked; });
                updateToggleLabel();
                // Dispara o filtro automaticamente
                const filterForm = document.getElementById('filterForm');
                if (filterForm) filterForm.dispatchEvent(new Event('submit'));
            });

            // Atualiza o label ao marcar/desmarcar individualmente
            colCheckboxList.addEventListener('change', updateToggleLabel);
            updateToggleLabel();
        }
    }

    // ─── Sidebar colapsável ───
    function bindSidebarToggle() {
        const sidebar = document.getElementById('sidebar');
        const btnCollapse = document.getElementById('btnCollapseSidebar');
        const btnOpen = document.getElementById('btnOpenSidebar');
        if (!sidebar || !btnCollapse || !btnOpen) return;

        const KEY = 'pvd_sidebar_collapsed';

        function collapse() {
            sidebar.classList.add('collapsed');
            btnOpen.style.display = 'flex';
            localStorage.setItem(KEY, '1');
        }
        function expand() {
            sidebar.classList.remove('collapsed');
            btnOpen.style.display = 'none';
            localStorage.setItem(KEY, '0');
        }

        btnCollapse.addEventListener('click', collapse);
        btnOpen.addEventListener('click', expand);

        if (localStorage.getItem(KEY) === '1') collapse();
    }

    // ─── Ativa/desativa o select de coluna de limpeza ───
    function bindCleanToggle(form) {
        const chk = (form || document).querySelector('#checkRemoverCaracteres');
        const sel = (form || document).querySelector('#selectColunaLimpar');
        if (!chk || !sel) return;

        const updateState = () => {
            sel.disabled = !chk.checked;
        };

        chk.addEventListener('change', updateState);
        updateState();
    }

    // ─── Toast de duplicados removidos ───
    function showDedupToast(count) {
        const old = document.getElementById('dedup-toast');
        if (old) old.remove();

        const toast = document.createElement('div');
        toast.id = 'dedup-toast';
        toast.className = 'dedup-toast';
        toast.innerHTML = `<i class="fas fa-filter"></i>${count} linha${count !== 1 ? 's duplicadas removidas' : ' duplicada removida'}`;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => { toast.classList.add('visible'); });
        });

        setTimeout(() => {
            toast.classList.remove('visible');
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

document.addEventListener('DOMContentLoaded', function () {

    // File input name update
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

    // Função para inicializar o DataTable
    let dataTableInstance = null;
    function initDataTable() {
        const previewTable = document.getElementById('previewTable');
        if (previewTable) {
            if (dataTableInstance) {
                dataTableInstance.destroy();
                $(previewTable).off('dblclick', 'tbody td'); // Remove events antigos
            }
            dataTableInstance = $(previewTable).DataTable({
                "language": {
                    "url": "//cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json"
                },
                "pageLength": 10,
                "ordering": true,
                "info": true,
                "lengthChange": true,
                "responsive": false,
                "scrollX": true,
                "colReorder": true,
                "fixedColumns": {
                    "left": 1
                },
                "columnDefs": [
                    { "visible": false, "targets": 0 } // Esconde a coluna do Index do Pandas
                ]
            });

            // Double click para Inline Editing
            $(previewTable).on('dblclick', 'tbody td', function () {
                let cell = dataTableInstance.cell(this);
                // Previne de tentar editar caso seja clique fora de valor válido
                if (!cell || !cell.index()) return;

                let colIdx = cell.index().column;
                if (colIdx === 0) return; // Não deixar editar a chave secreta (Index)

                let originalValue = cell.data();
                let $td = $(this);

                // Se já existir input ali dentro, ignora
                if ($td.find('input').length > 0) return;

                let rowId = $td.closest('tr').data('row-id');
                let headerEl = $(dataTableInstance.column(colIdx).header());
                let headerName = headerEl.data('col-name') || headerEl.text();

                // Cria o input moderno
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
                    // Espera enter ou esc ou blur
                    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== 'Escape') return;

                    let newValue = $(this).val();
                    if (e.key === 'Escape') newValue = originalValue;

                    // Despinta UI e salva local
                    $td.html(newValue);
                    cell.data(newValue); // Atualiza cache do DataTable

                    if (newValue !== originalValue) {
                        let formData = new FormData();
                        formData.append('row_id', rowId);
                        formData.append('col_name', headerName);
                        formData.append('new_value', newValue);

                        fetch('/editar_celula', {
                            method: 'POST',
                            body: formData
                        })
                            .then(res => res.json())
                            .then(data => {
                                if (data.status === 'success') {
                                    // Brilha em verde para sucesso
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
    }
    initDataTable();

    // Interceptar Download Excel e Injetar Ordem de Colunas
    document.addEventListener('submit', function (e) {
        if (e.target && e.target.id === 'downloadForm') {
            if (dataTableInstance) {
                let cols = [];
                // Vasculha o Header DOM pra respeitar a ordem do arrasto do ColReorder
                $(dataTableInstance.table().header()).find('th').each(function () {
                    let text = $(this).data('col-name') || $(this).text();
                    if (text && text !== '_Index_') cols.push(text.trim());
                });
                document.getElementById('colOrderInput').value = JSON.stringify(cols);
            }
        }
    });

    // Lógica para envio de formulário dinâmico SEM recarregar a página
    const filterForm = document.getElementById('filterForm');
    const contentSection = document.querySelector('.content');

    if (filterForm && contentSection) {
        let debounceTimer;

        // Função que intercepta e envia via AJAX
        const fetchFilters = () => {
            // Adiciona efeito visual na tabela indicando carregamento
            contentSection.style.opacity = '0.5';
            contentSection.style.pointerEvents = 'none';

            const formData = new FormData(filterForm);

            fetch('/filtrar', {
                method: 'POST',
                body: formData
            })
                .then(response => response.text())
                .then(html => {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const newContent = doc.querySelector('.content');

                    if (newContent) {
                        contentSection.innerHTML = newContent.innerHTML;
                        initDataTable(); // Re-inicializa o DataTables
                    }
                })
                .catch(err => {
                    console.error("Erro na filtragem", err);
                    alert("Ocorreu um erro ao filtrar os dados na conexão.");
                })
                .finally(() => {
                    contentSection.style.opacity = '1';
                    contentSection.style.pointerEvents = 'auto';
                });
        };

        // Debounce para a barra de digitação não pesquisar a cada caractere
        const searchInput = filterForm.querySelector('input[name="busca"]');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(fetchFilters, 500); // aguarda meio segundo
            });
        }

        // Action automática para checkboxes e dropsdowns (sem debounce)
        const otherInputs = filterForm.querySelectorAll('input[type="checkbox"], select');
        otherInputs.forEach(input => {
            input.addEventListener('change', fetchFilters);
        });

        // Previne submit tradicional
        filterForm.addEventListener('submit', function (e) {
            e.preventDefault();
            fetchFilters();
        });
    }

    // Loading estado apenas para o formulário de Upload original
    const uploadForm = document.querySelector('.upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function (e) {
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.classList.add('btn-loading');
                submitBtn.disabled = true;
                setTimeout(() => {
                    submitBtn.classList.remove('btn-loading');
                    submitBtn.disabled = false;
                }, 30000);
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    
    // File input name update
    const fileInput = document.getElementById('fileInput');
    const fileNameDisplay = document.getElementById('fileName');

    if(fileInput && fileNameDisplay) {
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

    // Initialize DataTables se a tabela existir
    const previewTable = document.getElementById('previewTable');
    if (previewTable) {
        $(previewTable).DataTable({
            "language": {
                "url": "//cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json"
            },
            "pageLength": 10,
            "ordering": true,
            "info": true,
            "lengthChange": true,
            "responsive": true
        });
    }

    // Loading states for generic forms that have loading-form class
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const submitBtn = this.querySelector('button[type="submit"]');
            if(submitBtn) {
                // Previne múltiplos cliques e adiciona loader
                submitBtn.classList.add('btn-loading');
                submitBtn.disabled = true;
                
                // Se o form demorar demais por erro, reativa depois de 30s
                setTimeout(() => {
                    submitBtn.classList.remove('btn-loading');
                    submitBtn.disabled = false;
                }, 30000); 
            }
        });
    });
});

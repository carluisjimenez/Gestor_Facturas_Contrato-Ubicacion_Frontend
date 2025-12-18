const API_URL = 'http://localhost:5000/api';

document.addEventListener('DOMContentLoaded', () => {
    // Elementos - Sección Excel
    const excelDropzone = document.getElementById('excel-dropzone');
    const excelInput = document.getElementById('excel-input');
    const excelFileInfo = document.getElementById('excel-file-info');
    const excelFilename = document.getElementById('excel-filename');
    const removeExcelBtn = document.getElementById('remove-excel');

    // Elementos - Sección PDF
    const pdfSection = document.getElementById('pdf-section');
    const pdfDropzone = document.getElementById('pdf-dropzone');
    const pdfInput = document.getElementById('pdf-input');

    // Elementos - Sección Resultados
    const resultsSection = document.getElementById('results-section');
    const filesTableBody = document.getElementById('files-list');
    const emptyState = document.getElementById('empty-state');
    const fileCountBadge = document.getElementById('file-count');
    const downloadAllBtn = document.getElementById('download-all');
    const deleteAllBtn = document.getElementById('delete-all');

    // Elementos - Feedback de UI
    const loadingOverlay = document.getElementById('loading-overlay');
    const toastContainer = document.getElementById('toast-container');

    // Elementos - Modal de Vista Previa
    const previewModal = document.getElementById('preview-modal');
    const previewIframe = document.getElementById('preview-iframe');
    const previewTitle = document.getElementById('preview-title');
    const closeModalBtn = document.getElementById('close-modal');

    // Estado
    let processedFiles = [];

    // --- Listeners de Eventos ---

    // Dropzone de Excel
    excelDropzone.addEventListener('click', () => excelInput.click());
    excelInput.addEventListener('change', (e) => handleExcelUpload(e.target.files[0]));

    setupDragAndDrop(excelDropzone, (files) => {
        if (files.length > 0 && (files[0].name.endsWith('.xlsx') || files[0].name.endsWith('.xls'))) {
            handleExcelUpload(files[0]);
        } else {
            alert('Por favor, sube un archivo Excel válido (.xlsx, .xls)');
        }
    });

    // Quitar Excel
    removeExcelBtn.addEventListener('click', () => {
        excelFileInfo.classList.add('hidden');
        excelDropzone.classList.remove('hidden');
        excelDropzone.style.display = 'flex';
        excelInput.value = '';
        pdfSection.classList.add('hidden-section');
        pdfSection.classList.remove('active');
        pdfSection.style.display = 'none';
        resultsSection.classList.add('hidden-section');
        resultsSection.classList.remove('active');
        resultsSection.style.display = 'none';
    });

    // Dropzone de PDF
    pdfDropzone.addEventListener('click', () => pdfInput.click());
    pdfInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files).filter(f =>
            f.name.toLowerCase().endsWith('.pdf') || f.name.toLowerCase().endsWith('.zip')
        );
        if (files.length > 0) handlePdfUpload(files);
    });

    setupDragAndDrop(pdfDropzone, async (files, e) => {
        const filesToUpload = [];

        if (e.dataTransfer.items) {
            const entries = Array.from(e.dataTransfer.items)
                .map(item => item.webkitGetAsEntry())
                .filter(entry => entry !== null);

            for (const entry of entries) {
                const results = await getAllFileEntries(entry);
                filesToUpload.push(...results.filter(f =>
                    f.name.toLowerCase().endsWith('.pdf') || f.name.toLowerCase().endsWith('.zip')
                ));
            }
        } else {
            filesToUpload.push(...Array.from(files).filter(f =>
                f.name.toLowerCase().endsWith('.pdf') || f.name.toLowerCase().endsWith('.zip')
            ));
        }

        if (filesToUpload.length > 0) {
            handlePdfUpload(filesToUpload);
        }
    });

    // Acciones de Resultados
    downloadAllBtn.addEventListener('click', () => {
        window.location.href = `${API_URL}/download_all`;
    });

    deleteAllBtn.addEventListener('click', async () => {
        if (!confirm('¿Estás seguro de que deseas eliminar todos los archivos?')) return;
        try {
            const response = await fetch(`${API_URL}/delete_all`, { method: 'DELETE' });
            if (response.ok) {
                processedFiles = [];
                renderResultsTable();
                showToast('Todos los archivos eliminados');

                // Resetear UI
                pdfSection.classList.add('hidden-section');
                pdfSection.classList.remove('active');
                pdfSection.style.display = 'none';
                excelFileInfo.classList.add('hidden');
                excelDropzone.classList.remove('hidden');
                excelDropzone.style.display = 'flex';
            }
        } catch (e) {
            console.error(e);
        }
    });

    // Eventos del Modal de Vista Previa
    closeModalBtn.addEventListener('click', () => {
        previewModal.classList.add('hidden');
        previewIframe.src = '';
    });

    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) {
            closeModalBtn.click();
        }
    });

    // --- Funciones ---

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${message}`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    async function getAllFileEntries(entry) {
        let files = [];
        if (entry.isFile) {
            const file = await new Promise(resolve => entry.file(resolve));
            files.push(file);
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            const entries = await new Promise(resolve => {
                reader.readEntries(resolve);
            });
            for (const childEntry of entries) {
                const childFiles = await getAllFileEntries(childEntry);
                files.push(...childFiles);
            }
        }
        return files;
    }

    function setupDragAndDrop(element, onDropCallback) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            element.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            element.addEventListener(eventName, () => element.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            element.addEventListener(eventName, () => element.classList.remove('dragover'), false);
        });

        element.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            onDropCallback(files, e);
        }, false);
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    async function handleExcelUpload(file) {
        if (!file) return;

        excelFilename.textContent = "Subiendo...";

        const formData = new FormData();
        formData.append('excel', file);

        try {
            const response = await fetch(`${API_URL}/upload_excel`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (response.ok) {
                excelFilename.textContent = file.name;
                excelDropzone.style.display = 'none';
                excelFileInfo.classList.remove('hidden');
                pdfSection.classList.remove('hidden-section');
                pdfSection.style.display = 'flex';
                setTimeout(() => {
                    pdfSection.classList.add('active');
                }, 100);
            } else {
                alert('Error al subir Excel: ' + data.error);
                excelFilename.textContent = "Error de carga";
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error de conexión con el servidor.');
        }
    }

    async function handlePdfUpload(files) {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('pdfs', file);
        });

        // Mostrar indicador de carga
        loadingOverlay.classList.remove('hidden');

        try {
            const response = await fetch(`${API_URL}/process_pdfs`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (response.ok) {
                resultsSection.classList.remove('hidden-section');
                resultsSection.style.display = 'block';
                setTimeout(() => {
                    resultsSection.classList.add('active');
                }, 100);
                fetchFilesList();
            } else {
                alert('Error al procesar PDFs: ' + data.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al procesar archivos.');
        } finally {
            // Ocultar indicador de carga
            loadingOverlay.classList.add('hidden');
        }
    }

    async function fetchFilesList() {
        try {
            const response = await fetch(`${API_URL}/files`);
            if (response.ok) {
                processedFiles = await response.json();
                renderResultsTable();
            }
        } catch (error) {
            console.error("Error al obtener lista de archivos:", error);
        }
    }

    function renderResultsTable() {
        fileCountBadge.textContent = `${processedFiles.length} archivos`;
        filesTableBody.innerHTML = '';

        if (processedFiles.length === 0) {
            emptyState.style.display = 'block';
            return;
        }
        emptyState.style.display = 'none';

        processedFiles.forEach((file) => {
            const tr = document.createElement('tr');
            // Sanitizar ID para evitar problemas con caracteres especiales
            const safeId = file.name.replace(/[^a-zA-Z0-9]/g, '-');
            tr.id = `row-${safeId}`;

            tr.innerHTML = `
                <td>
                    <div class="file-display" style="display: flex; align-items: center; gap: 10px; cursor: pointer;" onclick="showPreview('${file.name}')">
                        <i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i>
                        <span class="filename-text" style="color: #3b82f6; text-decoration: underline;">${file.name}</span>
                    </div>
                </td>
                <td class="text-right">
                    <div class="file-actions">
                        <button class="action-btn edit" title="Renombrar" onclick="startRename('${file.name}')">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="action-btn download" title="Descargar" onclick="downloadFile('${file.name}')">
                            <i class="fa-solid fa-download"></i>
                        </button>
                        <button class="action-btn delete" title="Eliminar" onclick="removeFile('${file.name}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            filesTableBody.appendChild(tr);
        });
    }

    window.showPreview = (filename) => {
        previewTitle.textContent = filename;
        previewIframe.src = `${API_URL}/download/${encodeURIComponent(filename)}?preview=true`;
        previewModal.classList.remove('hidden');
    };

    window.downloadFile = (filename) => {
        const link = document.createElement('a');
        link.href = `${API_URL}/download/${encodeURIComponent(filename)}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    window.startRename = (oldName) => {
        const safeId = oldName.replace(/[^a-zA-Z0-9]/g, '-');
        const row = document.getElementById(`row-${safeId}`);
        const nameCell = row.querySelector('td:first-child');
        const actionsCell = row.querySelector('td:last-child');

        const originalContent = nameCell.innerHTML;
        const originalActions = actionsCell.innerHTML;

        const nameWithoutExt = oldName.replace('.pdf', '');

        nameCell.innerHTML = `
            <div class="rename-container">
                <i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i>
                <input type="text" class="rename-input" value="${nameWithoutExt}">
                <span>.pdf</span>
            </div>
        `;

        actionsCell.innerHTML = `
            <div class="rename-actions">
                <button class="btn-icon-sm check" title="Aceptar"><i class="fa-solid fa-check"></i></button>
                <button class="btn-icon-sm cancel" title="Cancelar"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;

        const input = nameCell.querySelector('.rename-input');
        input.focus();

        const saveRename = async () => {
            let newName = input.value.trim();
            if (!newName) return;
            if (!newName.toLowerCase().endsWith('.pdf')) newName += '.pdf';

            if (newName === oldName) {
                cancelRename();
                return;
            }

            try {
                const response = await fetch(`${API_URL}/rename`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ old_name: oldName, new_name: newName })
                });

                if (response.ok) {
                    fetchFilesList();
                } else {
                    const err = await response.json();
                    alert("Error al renombrar: " + err.error);
                    cancelRename();
                }
            } catch (e) {
                console.error(e);
                cancelRename();
            }
        };

        const cancelRename = () => {
            nameCell.innerHTML = originalContent;
            actionsCell.innerHTML = originalActions;
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveRename();
            }
            if (e.key === 'Escape') cancelRename();
        });

        actionsCell.querySelector('.check').addEventListener('click', saveRename);
        actionsCell.querySelector('.cancel').addEventListener('click', cancelRename);
    };

    window.removeFile = async (filename) => {
        if (!confirm(`¿Estás seguro de eliminar "${filename}"?`)) return;
        try {
            const response = await fetch(`${API_URL}/delete/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            if (response.ok) {
                fetchFilesList();
                showToast('Archivo eliminado exitosamente');
            }
        } catch (e) {
            console.error(e);
        }
    };
});

const API_URL = 'https://gestorfacturascontrato-ubicacionbe.onrender.com/api';

let serviceWakeInterval = null;

async function pingBackend(timeoutMs = 2000) {
    try {
        const res = await fetch(`${API_URL}/status`, {
            method: 'GET',
            signal: AbortSignal.timeout(timeoutMs)
        });
        return res.ok;
    } catch (_) {
        return false;
    }
}

function showServiceOverlay() {
    const overlay = document.getElementById('service-overlay');
    if (overlay) overlay.classList.remove('hidden');
}

function hideServiceOverlay() {
    const overlay = document.getElementById('service-overlay');
    if (overlay) overlay.classList.add('hidden');
}

async function wakeBackendOnLoad() {
    const ok = await pingBackend(2000);
    if (ok) {
        hideServiceOverlay();
        return;
    }
    showServiceOverlay();
    if (serviceWakeInterval) clearInterval(serviceWakeInterval);
    serviceWakeInterval = setInterval(async () => {
        const ready = await pingBackend(2000);
        if (ready) {
            clearInterval(serviceWakeInterval);
            hideServiceOverlay();
        }
    }, 5000);
}

window.wakeBackendOnLoad = wakeBackendOnLoad;

// ========================================
// MAIN APPLICATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    wakeBackendOnLoad();
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
        try {
            const response = await fetch(`${API_URL}/delete_all`, { method: 'DELETE' });
            if (response.ok) {
                processedFiles = [];
                renderResultsTable();
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

    /**
     * Muestra una notificación profesional
     */
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

        toastContainer.appendChild(toast);

        // Remover después de que termine la animación de salida
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 500);
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

        // Validación del nombre del archivo: Reporte Coopeguanacaste [Mes] [Año]
        // Se permite cualquier cosa después de "Reporte Coopeguanacaste "
        const filenameRegex = /^Reporte Coopeguanacaste .+\.(xlsx|xls)$/i;
        if (!filenameRegex.test(file.name)) {
            showToast('El archivo debe llamarse "Reporte Coopeguanacaste [Mes] [Año]"', 'error');
            return;
        }

        const excelLoadingOverlay = document.getElementById('excel-loading-overlay');

        // Mostrar loading
        excelLoadingOverlay.classList.remove('hidden');

        const formData = new FormData();
        formData.append('excel', file);

        try {
            const response = await fetch(`${API_URL}/upload_excel`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            // Ocultar loading
            excelLoadingOverlay.classList.add('hidden');

            if (response.ok) {
                excelFilename.textContent = file.name;
                excelDropzone.style.display = 'none';
                excelFileInfo.classList.remove('hidden');

                // Reset inactivity timer
                if (typeof resetInactivityTimer === 'function') resetInactivityTimer();

                // Transición suave
                pdfSection.style.display = 'flex';
                setTimeout(() => {
                    pdfSection.classList.remove('hidden-section');
                    pdfSection.classList.add('active');
                }, 50);
            } else {
                showToast(data.error || 'Error al subir Excel', 'error');
            }
        } catch (error) {
            // Ocultar loading en caso de error
            excelLoadingOverlay.classList.add('hidden');
            console.error('Error:', error);
            showToast('Error de conexión con el servidor', 'error');
        }
    }

    async function handlePdfUpload(files) {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('pdfs', file);
        });

        loadingOverlay.classList.remove('hidden');

        try {
            const response = await fetch(`${API_URL}/process_pdfs`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (response.ok) {
                // Reset inactivity timer
                if (typeof resetInactivityTimer === 'function') resetInactivityTimer();

                resultsSection.style.display = 'block';
                setTimeout(() => {
                    resultsSection.classList.remove('hidden-section');
                    resultsSection.classList.add('active');
                }, 50);
                fetchFilesList();
            } else {
                showToast(data.error || 'Error al procesar archivos', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Error crítico al procesar archivos', 'error');
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }

    async function fetchFilesList() {
        try {
            const response = await fetch(`${API_URL}/files`);
            if (response.ok) {
                // Reset inactivity timer
                if (typeof resetInactivityTimer === 'function') resetInactivityTimer();

                processedFiles = await response.json();
                renderResultsTable();
            }
        } catch (error) {
            console.error("Error fetching files:", error);
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
            const safeId = file.name.replace(/[^a-zA-Z0-9]/g, '-');
            tr.id = `row-${safeId}`;

            tr.innerHTML = `
                <td>
                    <div class="file-display" style="display: flex; align-items: center; gap: 12px; cursor: pointer;" onclick="showPreview('${file.name}')">
                        <i class="fa-solid fa-file-pdf" style="color: #ef4444; font-size: 1.1rem;"></i>
                        <span class="filename-text">${file.name}</span>
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
                            <i class="fa-solid fa-trash-can"></i>
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
            <div class="rename-container" style="display: flex; align-items: center; gap: 8px; width: 100%;">
                <i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i>
                <input type="text" class="rename-input" value="${nameWithoutExt}" style="flex: 1;">
                <span style="font-weight: 600; color: var(--text-muted);">.pdf</span>
            </div>
        `;

        actionsCell.innerHTML = `
            <div class="rename-actions" style="display: flex; gap: 8px; justify-content: flex-start;">
                <button class="btn-icon-sm check" title="Confirmar" style="color: var(--success); padding: 6px 10px; font-size: 0.9rem;"><i class="fa-solid fa-check"></i> Aceptar</button>
                <button class="btn-icon-sm cancel" title="Cancelar" style="color: var(--danger); padding: 6px 10px; font-size: 0.9rem;"><i class="fa-solid fa-xmark"></i> Cancelar</button>
            </div>
        `;

        const input = nameCell.querySelector('.rename-input');
        input.focus();
        input.setSelectionRange(0, 0); // Cursor al inicio sin seleccionar

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
                    showToast('Archivo renombrado');
                } else {
                    const err = await response.json();
                    showToast(err.error || 'Error al renombrar', 'error');
                    cancelRename();
                }
            } catch (e) {
                console.error(e);
                showToast('Error de red', 'error');
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
        try {
            const response = await fetch(`${API_URL}/delete/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            if (response.ok) {
                fetchFilesList();
                showToast('Archivo eliminado');
            }
        } catch (e) {
            console.error(e);
            showToast('Error al eliminar', 'error');
        }
    };
});

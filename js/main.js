const API_URL = 'https://gestorfacturascontrato-ubicacionbe.onrender.com/api';

// Estado de activación del backend
const backendActivation = {
    timerInterval: null,
    inactivityTimeout: null,
    isActivated: false
};

/**
 * Verifica si el backend está despierto usando el endpoint de estado
 */
async function checkBackendStatus() {
    const btn = document.getElementById('activateBtn');
    if (!btn) return;

    try {
        // Verificar con el endpoint de estado del backend
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout para dar tiempo al backend

        const response = await fetch(`${API_URL}/status`, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            
            // El backend responde y nos dice si está activo
            if (data.active) {
                // Backend está activo (dentro de los 15 minutos de inactividad)
                setBackendActivatedState();
            } else {
                // Backend responde pero indica que está inactivo (más de 15 minutos sin actividad)
                resetBackendActivationState();
            }
        } else {
            // Backend respondió pero con error
            console.log('Backend respondió con error');
            resetBackendActivationState();
        }
    } catch (err) {
        // Backend no responde (timeout, network error, servidor apagado)
        console.log('Backend no está disponible:', err.message);
        resetBackendActivationState();
    }
}

function activateBackend() {
    const btn = document.getElementById('activateBtn');
    const timerSpan = document.getElementById('activationTimer');

    if (!btn) return;

    // 1. Cambiar UI a "Activando"
    btn.textContent = 'Activando';
    btn.className = 'btn-activating';
    btn.disabled = true;

    // 2. Mostrar Timer y empezar cuenta regresiva
    if (timerSpan) {
        timerSpan.style.display = 'inline';
        let secondsLeft = 60;
        timerSpan.textContent = `${secondsLeft}s`;

        if (backendActivation.timerInterval) clearInterval(backendActivation.timerInterval);

        backendActivation.timerInterval = setInterval(() => {
            secondsLeft--;
            timerSpan.textContent = `${secondsLeft}s`;

            // Cada 3 segundos, verificar si el backend ya está activo
            if (secondsLeft % 3 === 0 && secondsLeft > 0) {
                fetch(`${API_URL}/status`, { 
                    method: 'GET',
                    signal: AbortSignal.timeout(3000) // 3s timeout
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.active) {
                            // Backend está activo, cambiar a "Activado" inmediatamente
                            clearInterval(backendActivation.timerInterval);
                            setBackendActivatedState();
                            console.log('Backend activado en', 60 - secondsLeft, 'segundos');
                        }
                    })
                    .catch(() => { /* Sigue despertando */ });
            }

            if (secondsLeft <= 0) {
                clearInterval(backendActivation.timerInterval);
                setBackendActivatedState();
            }
        }, 1000);
    } else {
        // Fallback si no hay span de timer
        setTimeout(setBackendActivatedState, 60000);
    }

    // 3. Mandar el ping inicial de wake-up
    fetch(`${API_URL.replace('/api', '')}/`, { method: 'GET' })
        .then(() => console.log('Ping de activación enviado'))
        .catch(err => console.log('Backend despertando...'));
}

function setBackendActivatedState() {
    const btn = document.getElementById('activateBtn');
    const timerSpan = document.getElementById('activationTimer');

    if (!btn) return;

    // Cambiar a "Activado"
    btn.textContent = 'Activado';
    btn.className = 'btn-activated';
    btn.disabled = true;

    // Ocultar timer si estaba visible
    if (timerSpan) timerSpan.style.display = 'none';
    if (backendActivation.timerInterval) clearInterval(backendActivation.timerInterval);

    backendActivation.isActivated = true;

    // Guardar en localStorage para persistencia total
    localStorage.setItem('backendActivated', 'true');
    localStorage.setItem('lastActivationTime', Date.now().toString());

    // Iniciar temporizador de inactividad
    resetInactivityTimer();
}

function resetBackendActivationState() {
    const btn = document.getElementById('activateBtn');
    if (!btn) return;

    btn.textContent = 'Activar';
    btn.className = 'btn-activate';
    btn.disabled = false;

    backendActivation.isActivated = false;
    backendActivation.inactivityTimeout = null;

    // Limpiar storage permanente
    localStorage.removeItem('backendActivated');
    localStorage.removeItem('lastActivationTime');
}

function resetInactivityTimer() {
    // Actualizar el timestamp en localStorage cada vez que hay actividad
    // Esto evita que al refrescar la página se pierda el estado si han pasado > 15 min 
    // desde el click original pero el usuario ha estado activo
    localStorage.setItem('lastActivationTime', Date.now().toString());

    if (!backendActivation.isActivated) {
        setBackendActivatedState();
        return;
    }

    if (backendActivation.inactivityTimeout) {
        clearTimeout(backendActivation.inactivityTimeout);
    }

    // 15 minutos de inactividad antes de volver a "Activar"
    backendActivation.inactivityTimeout = setTimeout(() => {
        resetBackendActivationState();
    }, 15 * 60 * 1000);
}

// Exponer funciones globalmente
window.activateBackend = activateBackend;
window.checkBackendStatus = checkBackendStatus;
window.resetInactivityTimer = resetInactivityTimer;

// ========================================
// MAIN APPLICATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Verificar estado del backend al cargar
    checkBackendStatus();
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

        // Mostrar loading inmediatamente al soltar
        loadingOverlay.classList.remove('hidden');

        try {
            if (e.dataTransfer && e.dataTransfer.items) {
                const entries = Array.from(e.dataTransfer.items)
                    .map(item => item.webkitGetAsEntry())
                    .filter(entry => entry !== null);

                for (const entry of entries) {
                    if (entry.isDirectory) {
                        const results = await getAllFileEntries(entry);
                        filesToUpload.push(...results.filter(f =>
                            f.name.toLowerCase().endsWith('.pdf') || f.name.toLowerCase().endsWith('.zip')
                        ));
                    } else if (entry.isFile) {
                         // Procesar archivo suelto directamente si es posible para mantener su File object original si no es necesario recorrer
                         // Sin embargo, getFile de la entry es seguro
                         const file = await new Promise(resolve => entry.file(resolve));
                         if (file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.zip')) {
                             filesToUpload.push(file);
                         }
                    }
                }
            } else {
                filesToUpload.push(...Array.from(files).filter(f =>
                    f.name.toLowerCase().endsWith('.pdf') || f.name.toLowerCase().endsWith('.zip')
                ));
            }

            if (filesToUpload.length > 0) {
                // Procesar por lotes si son demasiados archivos para evitar timeout del navegador o servidor
                // Aunque para ZIPs grandes es mejor mandar uno solo.
                // Si hay un ZIP muy grande, mejor mandarlo solo o en su propio lote.
                await handlePdfUpload(filesToUpload);
            } else {
                loadingOverlay.classList.add('hidden');
            }
        } catch (err) {
            console.error("Error preparando archivos:", err);
            showToast("Error al leer los archivos arrastrados", "error");
            loadingOverlay.classList.add('hidden');
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

    async function extractZipPdfs(zipFile) {
        const zip = await JSZip.loadAsync(zipFile);
        const outputs = [];
        const names = Object.keys(zip.files);
        for (const name of names) {
            const entry = zip.files[name];
            if (!entry.dir && name.toLowerCase().endsWith('.pdf')) {
                const blob = await entry.async('blob');
                const filename = name.split('/').pop();
                outputs.push(new File([blob], filename, { type: 'application/pdf' }));
            }
        }
        return outputs;
    }

    async function handlePdfUpload(files) {
        loadingOverlay.classList.remove('hidden');

        const zipFiles = files.filter(f => f.name.toLowerCase().endsWith('.zip'));
        let pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));

        let errors = [];
        let successCount = 0;

        try {
            for (const zipFile of zipFiles) {
                const extracted = await extractZipPdfs(zipFile);
                pdfFiles = pdfFiles.concat(extracted);
            }

            const BATCH_SIZE = 5;
            for (let i = 0; i < pdfFiles.length; i += BATCH_SIZE) {
                const batch = pdfFiles.slice(i, i + BATCH_SIZE);
                const formData = new FormData();
                batch.forEach(file => formData.append('pdfs', file));

                try {
                    const response = await fetch(`${API_URL}/process_pdfs`, {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        const text = await response.text();
                         throw new Error(`Lote ${i/BATCH_SIZE + 1}: ${text}`);
                    }
                    successCount++;
                } catch (err) {
                     console.error(err);
                     errors.push(err.message);
                }
                
                // Pequeña pausa entre lotes para dar respiro al servidor
                if (i + BATCH_SIZE < pdfFiles.length) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            // Resultado final
            if (successCount > 0) {
                 // Reset inactivity timer
                 if (typeof resetInactivityTimer === 'function') resetInactivityTimer();

                 resultsSection.style.display = 'block';
                 setTimeout(() => {
                     resultsSection.classList.remove('hidden-section');
                     resultsSection.classList.add('active');
                     resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                 }, 50);
                 
                 setTimeout(() => fetchFilesList(), 500);

                 if (errors.length > 0) {
                     showToast(`Procesado parcialmente. Errores: ${errors.length}`, 'warning');
                 } else {
                     showToast('Todos los archivos procesados correctamente', 'success');
                 }
            } else if (errors.length > 0) {
                // Ninguno funcionó
                 showToast(`Fallo total. ${errors[0]}`, 'error');
            }

        } catch (error) {
            console.error('Error general:', error);
            showToast(`Error inesperado: ${error.message}`, 'error');
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

            // Extract location and invoice number from the file name
            let displayName = file.name;
            let location = '';
            let invoiceNumber = '';
            
            // Try to extract location and invoice number from the file name
            const match = file.name.match(/^(.+?)\s*-\s*(\d+)\.pdf$/i);
            if (match) {
                location = match[1].trim();
                invoiceNumber = match[2].trim();
                displayName = `${location} - ${invoiceNumber}`;
            }

            tr.innerHTML = `
                <td>
                    <div class="file-display" style="display: flex; align-items: center; gap: 12px; cursor: pointer;" onclick="showPreview('${file.name}')">
                        <i class="fa-solid fa-file-pdf" style="color: #ef4444; font-size: 1.1rem;"></i>
                        <div style="display: flex; flex-direction: column;">
                            <span class="filename-text" title="${file.name}">${displayName}</span>
                            <small style="color: #6b7280; font-size: 0.8rem;">${file.ubicacion || ''}</small>
                        </div>
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
        // Extract short name for display in the modal title
        let displayName = filename;
        const shortNameMatch = filename.match(/^([^-]+-\s*\d+\.pdf)/i);
        if (shortNameMatch && shortNameMatch[1]) {
            displayName = shortNameMatch[1].trim();
        }
        previewTitle.textContent = displayName;
        previewTitle.setAttribute('title', filename); // Full name in tooltip
        previewIframe.src = `${API_URL}/download/${encodeURIComponent(filename)}?preview=true`;
        previewModal.classList.remove('hidden');
    };

    window.downloadFile = (filename) => {
        const link = document.createElement('a');
        // Extract short name for the downloaded file
        let downloadName = filename;
        const shortNameMatch = filename.match(/^([^-]+-\s*\d+\.pdf)/i);
        if (shortNameMatch && shortNameMatch[1]) {
            downloadName = shortNameMatch[1].trim();
        }
        link.href = `${API_URL}/download/${encodeURIComponent(filename)}`;
        link.download = downloadName;
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

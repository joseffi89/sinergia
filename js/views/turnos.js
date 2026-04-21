window.ViewTurnos = {
    currentTab: 'tab-calendario',
    actividadesData: null,
    horariosData: null,

    async render() {
        const container = document.getElementById('turnos-container');
        container.innerHTML = '<p style="color: var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Cargando...</p>';

        try {
            // Obtener datos
            this.actividadesData = await GristData.getTable('Actividades');
            this.horariosData = await GristData.getTable('Horarios_Base');
            
            if (!this.actividadesData || !this.horariosData) {
                container.innerHTML = '<p style="color: var(--danger);">Error al conectar con Grist o tablas no encontradas.</p>';
                return;
            }

            this.renderTabContent();
        } catch (e) {
            console.error(e);
            container.innerHTML = '<p style="color: var(--danger);">Ocurrió un error renderizando turnos.</p>';
        }
    },

    switchTab(tabId) {
        this.currentTab = tabId;
        // Update active class on buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
                btn.style.color = 'var(--primary)';
            } else {
                btn.classList.remove('active');
                btn.style.color = 'var(--text-muted)';
            }
        });
        this.renderTabContent();
    },

    renderTabContent() {
        const container = document.getElementById('turnos-container');
        if (this.currentTab === 'tab-calendario') {
            document.getElementById('btn-nueva-clase').style.display = 'inline-flex';
            container.innerHTML = this.getCalendarioHtml();
        } else {
            document.getElementById('btn-nueva-clase').style.display = 'none';
            container.innerHTML = this.getActividadesHtml();
        }
    },

    getCalendarioHtml() {
        const actividades = this.actividadesData;
        const horarios = this.horariosData;
        
        let optionsHtml = '<option value="">Todas las Actividades</option>';
        if (actividades && actividades.id) {
            actividades.id.forEach((id, index) => {
                optionsHtml += `<option value="${id}">${actividades.nombre_actividad[index]}</option>`;
            });
        }

        return `
            <div class="calendar-header" style="display:flex; justify-content:space-between; margin-bottom: 20px;">
                <div class="filters">
                    <select class="form-control" style="background: var(--bg-card); color: white; border: 1px solid var(--border); padding: 8px; border-radius: var(--radius);">
                        ${optionsHtml}
                    </select>
                </div>
            </div>
            <div class="calendar-grid" style="display:grid; grid-template-columns: repeat(6, 1fr); gap: 15px;">
                ${['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'].map(dia => `
                    <div class="calendar-col">
                        <h3 style="text-align:center; padding: 10px; background: var(--bg-card); border-radius: var(--radius); font-size: 14px; border-bottom: 2px solid var(--primary); margin-bottom: 10px;">${dia}</h3>
                        <div class="dia-cards">
                            ${this.renderClasesDia(dia, horarios, actividades)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderClasesDia(dia, horarios, actividades) {
        if(!horarios || !horarios.dia_semana) return '';
        
        let clasesHtml = '';
        for(let i=0; i < horarios.id.length; i++) {
            if (horarios.dia_semana[i] === dia) {
                const actId = horarios.actividad_id[i];
                let actName = "Desc.";
                let color = "var(--primary)";
                
                if (actividades && actividades.id) {
                    const actIndex = actividades.id.indexOf(actId);
                    if (actIndex !== -1) {
                        actName = actividades.nombre_actividad[actIndex];
                        color = actividades.color_ui[actIndex] || color;
                    }
                }

                clasesHtml += `
                    <div class="turno-card" style="background: var(--bg-card); border: 1px solid var(--border); padding: 12px; border-radius: var(--radius); margin-bottom: 10px; border-left: 4px solid ${color}; cursor: pointer; transition: transform 0.2s;">
                        <div style="font-size: 12px; color: var(--text-muted); font-weight: 600; margin-bottom: 4px;"><i class="ph ph-clock"></i> ${horarios.hora_inicio[i]} - ${horarios.hora_fin[i]}</div>
                        <div style="font-weight: 500; font-size: 14px; margin-bottom: 8px;">${actName}</div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size: 11px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">Cupos: N/A</span>
                            <i class="ph ph-users" style="color: var(--text-muted);"></i>
                        </div>
                    </div>
                `;
            }
        }
        return clasesHtml || '<div style="font-size:12px; text-align:center; color: var(--text-muted); padding: 10px;">Sin clases</div>';
    },

    getActividadesHtml() {
        const actividades = this.actividadesData;
        let rows = '';
        if (actividades && actividades.id && actividades.id.length > 0) {
            for(let i=0; i < actividades.id.length; i++) {
                const nombre = actividades.nombre_actividad ? actividades.nombre_actividad[i] : 'Sin nombre';
                const cupo = actividades.cupo_maximo ? actividades.cupo_maximo[i] : 0;
                const color = actividades.color_ui ? actividades.color_ui[i] : '#000';
                
                rows += `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 12px; font-weight: 500;">
                            <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${color}; margin-right:8px; vertical-align:middle;"></span>
                            ${nombre}
                        </td>
                        <td style="padding: 12px;">${cupo}</td>
                        <td style="padding: 12px; text-align: right;">
                            <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 13px;" onclick="window.ViewTurnos.openActividadModal(${i})"><i class="ph ph-pencil-simple"></i> Editar</button>
                        </td>
                    </tr>
                `;
            }
        } else {
            rows = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: var(--text-muted);">No hay actividades</td></tr>';
        }

        return `
            <div style="display:flex; justify-content:space-between; margin-bottom: 20px;">
                <h3 style="font-size:18px;">Lista de Actividades</h3>
                <button class="btn btn-primary" onclick="window.ViewTurnos.openNewActividadModal()"><i class="ph ph-plus"></i> Nueva Actividad</button>
            </div>
            <div class="card" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-size: 13px; text-transform: uppercase;">
                            <th style="padding: 12px;">Actividad</th>
                            <th style="padding: 12px;">Cupo Máximo</th>
                            <th style="padding: 12px; text-align:right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    },

    openNewActividadModal() {
        this.buildActividadModal('Nueva Actividad', null);
    },

    openActividadModal(index) {
        if(!this.actividadesData || !this.actividadesData.id) return;
        const id = this.actividadesData.id[index];
        const data = {
            nombre_actividad: this.actividadesData.nombre_actividad ? this.actividadesData.nombre_actividad[index] : '',
            cupo_maximo: this.actividadesData.cupo_maximo ? this.actividadesData.cupo_maximo[index] : 0,
            color_ui: this.actividadesData.color_ui ? this.actividadesData.color_ui[index] : '#f39c12'
        };
        this.buildActividadModal('Editar Actividad', id, data);
    },

    buildActividadModal(title, id, existingData = {}) {
        const nombre = existingData.nombre_actividad || '';
        const cupo = existingData.cupo_maximo || '';
        const color = existingData.color_ui || '#f39c12';

        const formHtml = `
            <div class="form-group">
                <label>Nombre de la Actividad</label>
                <input type="text" id="act-nombre" class="form-control" value="${nombre}">
            </div>
            <div class="form-group">
                <label>Cupo Máximo</label>
                <input type="number" id="act-cupo" class="form-control" value="${cupo}">
            </div>
            <div class="form-group">
                <label>Color (Hexadecimal, ej: #f39c12)</label>
                <input type="color" id="act-color" class="form-control" value="${color}" style="height:40px; padding:2px; border:1px solid var(--border); cursor:pointer;">
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-act">Guardar</button>
        `;

        window.Modal.show(title, formHtml, footerHtml);

        document.getElementById('btn-save-act').addEventListener('click', async () => {
            const data = {
                nombre_actividad: document.getElementById('act-nombre').value,
                cupo_maximo: parseInt(document.getElementById('act-cupo').value) || 0,
                color_ui: document.getElementById('act-color').value
            };
            const btn = document.getElementById('btn-save-act');
            try {
                btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
                btn.disabled = true;
                if (id) {
                    await GristData.updateRecord('Actividades', id, data);
                } else {
                    await GristData.addRecord('Actividades', data);
                }
                window.Modal.close();
                this.render();
            } catch (e) {
                alert('Error al guardar la actividad');
                btn.innerHTML = 'Guardar';
                btn.disabled = false;
            }
        });
    },

    openNewHorarioModal() {
        let options = '<option value="">Seleccionar...</option>';
        if (this.actividadesData && this.actividadesData.id) {
            this.actividadesData.id.forEach((aid, i) => {
                options += `<option value="${aid}">${this.actividadesData.nombre_actividad[i]}</option>`;
            });
        }
        
        const formHtml = `
            <div class="form-group">
                <label>Actividad</label>
                <select id="horario-act" class="form-control">${options}</select>
            </div>
            <div class="form-group">
                <label>Día de la Semana</label>
                <select id="horario-dia" class="form-control">
                    <option value="Lunes">Lunes</option>
                    <option value="Martes">Martes</option>
                    <option value="Miercoles">Miercoles</option>
                    <option value="Jueves">Jueves</option>
                    <option value="Viernes">Viernes</option>
                    <option value="Sabado">Sabado</option>
                </select>
            </div>
            <div style="display:flex; gap:10px;">
                <div class="form-group" style="flex:1;">
                    <label>Hora Inicio</label>
                    <input type="time" id="horario-inicio" class="form-control">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Hora Fin</label>
                    <input type="time" id="horario-fin" class="form-control">
                </div>
            </div>
        `;
        
        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-horario">Guardar Clase</button>
        `;
        
        window.Modal.show('Nueva Clase (Grilla Semanal)', formHtml, footerHtml);
        
        document.getElementById('btn-save-horario').addEventListener('click', async () => {
            const data = {
                actividad_id: parseInt(document.getElementById('horario-act').value) || null,
                dia_semana: document.getElementById('horario-dia').value,
                hora_inicio: document.getElementById('horario-inicio').value,
                hora_fin: document.getElementById('horario-fin').value
            };
            try {
                await GristData.addRecord('Horarios_Base', data);
                window.Modal.close();
                this.render();
            } catch (e) {
                alert('Error al guardar la clase');
            }
        });
    }
};

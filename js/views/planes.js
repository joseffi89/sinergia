window.ViewPlanes = {
    currentData: null,
    async render() {
        const container = document.getElementById('planes-container');
        container.innerHTML = '<p style="color: var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Cargando planes...</p>';

        try {
            const planes = await GristData.getTable('Planes');
            this.currentData = planes;
            
            if (!planes || !planes.id) {
                container.innerHTML = '<p style="color: var(--danger);">Error al cargar planes.</p>';
                return;
            }

            let cardsHtml = '';
            for(let i=0; i < planes.id.length; i++) {
                cardsHtml += `
                    <div class="card" style="border-top: 4px solid var(--primary); transition: transform 0.2s;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 15px;">
                            <h3 style="font-size: 18px; font-weight: 600;">${planes.nombre_plan[i]}</h3>
                            <span style="font-weight: 700; font-size: 18px; color: var(--primary);">$${planes.importe[i]}</span>
                        </div>
                        <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 10px;">
                            <i class="ph ph-clock"></i> ${planes.frecuencia_semanal[i]} veces por semana
                        </p>
                        <div style="margin-top: 15px; border-top: 1px solid var(--border); padding-top: 15px; text-align: right;">
                            <button class="btn btn-secondary" style="font-size: 13px;" onclick="window.ViewPlanes.openEditModal(${i})"><i class="ph ph-pencil-simple"></i> Editar</button>
                        </div>
                    </div>
                `;
            }

            container.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
                    ${cardsHtml || '<p style="color: var(--text-muted);">No hay planes creados</p>'}
                </div>
            `;
        } catch (error) {
            console.error(error);
            container.innerHTML = '<p style="color: var(--danger);">Ocurrió un error renderizando planes.</p>';
        }
    },

    async openNewModal() {
        this.buildModal('Nuevo Plan', null);
    },

    async openEditModal(index) {
        if (!this.currentData || !this.currentData.id) return;
        const id = this.currentData.id[index];
        const data = {
            tipo_plan: this.currentData.tipo_plan ? this.currentData.tipo_plan[index] : '',
            frecuencia_semanal: this.currentData.frecuencia_semanal ? this.currentData.frecuencia_semanal[index] : '',
            importe: this.currentData.importe ? this.currentData.importe[index] : ''
        };
        this.buildModal('Editar Plan', id, data);
    },

    async buildModal(title, id, existingData = {}) {
        const tipo_plan = existingData.tipo_plan || '';
        const frecuencia_semanal = existingData.frecuencia_semanal || '';
        const importe = existingData.importe || '';

        const formHtml = `
            <div class="form-group">
                <label>Tipo de Plan (Ej. Funcional, Crossfit)</label>
                <input type="text" id="plan-tipo" class="form-control" value="${tipo_plan}">
            </div>
            <div class="form-group">
                <label>Veces por semana</label>
                <input type="number" id="plan-frecuencia" class="form-control" value="${frecuencia_semanal}">
            </div>
            <div class="form-group">
                <label>Importe ($)</label>
                <input type="number" id="plan-importe" class="form-control" value="${importe}">
            </div>
            <p style="font-size:12px; color:var(--text-muted); margin-top:10px;">
                * El "Nombre del Plan" se genera automáticamente. La asignación de actividades permitidas se gestiona desde Grist para simplificar.
            </p>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-plan">Guardar</button>
        `;

        window.Modal.show(title, formHtml, footerHtml);

        document.getElementById('btn-save-plan').addEventListener('click', async () => {
            const data = {
                tipo_plan: document.getElementById('plan-tipo').value,
                frecuencia_semanal: parseInt(document.getElementById('plan-frecuencia').value) || 0,
                importe: parseFloat(document.getElementById('plan-importe').value) || 0
            };
            const btn = document.getElementById('btn-save-plan');
            try {
                btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
                btn.disabled = true;
                if (id) {
                    await GristData.updateRecord('Planes', id, data);
                } else {
                    await GristData.addRecord('Planes', data);
                }
                window.Modal.close();
                this.render();
            } catch (e) {
                alert('Error al guardar el plan');
                btn.innerHTML = 'Guardar';
                btn.disabled = false;
            }
        });
    }
};

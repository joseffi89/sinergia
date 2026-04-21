const GristData = {
    isReady: false,
    userRole: 'admin',
    _cache: {}, // Caché centralizado compartido por todas las vistas

    async init() {
        return new Promise((resolve) => {
            grist.ready({ requiredAccess: 'full' });

            grist.onRecords(() => {
                if (!this.isReady) {
                    this.isReady = true;
                    console.log("Grist API conectada");
                    resolve();
                }
            });

            // Fallback por si onRecords no dispara
            setTimeout(() => {
                if (!this.isReady) {
                    this.isReady = true;
                    console.warn("Grist timeout: forzando arranque");
                    resolve();
                }
            }, 2000);
        });
    },

    // Precarga todas las tablas en paralelo al arranque
    async prefetchAll() {
        const tablas = ['Actividades', 'Horarios_Base', 'Turnos_Alumnos', 'Alumnos', 'Planes', 'Pagos'];
        console.log("Prefetching all tables...");
        await Promise.all(tablas.map(t => this.getTable(t)));
        console.log("Prefetch complete.");
    },

    async getTable(tableName) {
        if (!this.isReady) return { id: [] };
        try {
            const data = await grist.docApi.fetchTable(tableName);
            if (!data.id) data.id = [];
            this._cache[tableName] = data; // Actualizar caché central
            return data;
        } catch (error) {
            console.error(`Error al obtener tabla ${tableName}:`, error);
            return this._cache[tableName] || { id: [] }; // Devolver caché si falla
        }
    },

    // Devuelve el caché sin hacer fetch — útil para render inmediato
    getCached(tableName) {
        return this._cache[tableName] || null;
    },

    async addRecord(tableName, data) {
        try {
            const result = await grist.docApi.applyUserActions([
                ['AddRecord', tableName, null, data]
            ]);
            // Invalidar caché para forzar recarga fresca
            delete this._cache[tableName];
            return result;
        } catch (error) {
            console.error(`Error al agregar registro en ${tableName}:`, error);
            throw error;
        }
    },

    async addRecords(tableName, dataArray) {
        try {
            const actions = dataArray.map(data => ['AddRecord', tableName, null, data]);
            const result = await grist.docApi.applyUserActions(actions);
            delete this._cache[tableName];
            return result;
        } catch (error) {
            console.error(`Error al agregar registros en ${tableName}:`, error);
            throw error;
        }
    },

    async updateRecord(tableName, id, data) {
        try {
            const result = await grist.docApi.applyUserActions([
                ['UpdateRecord', tableName, id, data]
            ]);
            delete this._cache[tableName];
            return result;
        } catch (error) {
            console.error(`Error al actualizar registro ${id} en ${tableName}:`, error);
            throw error;
        }
    },

    async deleteRecord(tableName, id) {
        try {
            const result = await grist.docApi.applyUserActions([
                ['RemoveRecord', tableName, id]
            ]);
            delete this._cache[tableName];
            return result;
        } catch (error) {
            console.error(`Error al eliminar registro ${id} en ${tableName}:`, error);
            throw error;
        }
    },

    async deleteRecords(tableName, idsArray) {
        try {
            const actions = idsArray.map(id => ['RemoveRecord', tableName, id]);
            const result = await grist.docApi.applyUserActions(actions);
            delete this._cache[tableName];
            return result;
        } catch (error) {
            console.error(`Error al eliminar múltiples registros en ${tableName}:`, error);
            throw error;
        }
    }
};

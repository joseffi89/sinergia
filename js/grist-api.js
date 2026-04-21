const GristData = {
    isReady: false,
    userRole: 'admin', // Default o mock

    async init() {
        // Inicializa la conexión con Grist
        grist.ready({
            requiredAccess: 'full' // Necesitamos acceso full para ABM
        });

        this.isReady = true;
        console.log("Grist API conectada correctamente");
        
        // Intentar obtener info del usuario si Grist expone algo (opcional)
        // Por ahora lo mockeamos según el requerimiento de tener rol Admin/Gestión
    },

    async getTable(tableName) {
        if (!this.isReady) await this.init();
        try {
            return await grist.docApi.fetchTable(tableName);
        } catch (error) {
            console.error(`Error al obtener tabla ${tableName}:`, error);
            return null;
        }
    },

    async addRecord(tableName, data) {
        try {
            return await grist.docApi.applyUserActions([
                ['AddRecord', tableName, null, data]
            ]);
        } catch (error) {
            console.error(`Error al agregar registro en ${tableName}:`, error);
            throw error;
        }
    },

    async updateRecord(tableName, id, data) {
        try {
            return await grist.docApi.applyUserActions([
                ['UpdateRecord', tableName, id, data]
            ]);
        } catch (error) {
            console.error(`Error al actualizar registro ${id} en ${tableName}:`, error);
            throw error;
        }
    },

    async deleteRecord(tableName, id) {
        try {
            return await grist.docApi.applyUserActions([
                ['RemoveRecord', tableName, id]
            ]);
        } catch (error) {
            console.error(`Error al eliminar registro ${id} en ${tableName}:`, error);
            throw error;
        }
    }
};

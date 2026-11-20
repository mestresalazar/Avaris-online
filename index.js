try {
    require('dotenv').config();
} catch (_) {}

const { ServerManager } = require('./lib/game/server/manager');
const { ServerPlugin } = require('./theme/plugins/server-plugin');
const { MongoDataServer } = require('./lib/game/server/mongo-data-server');
const { getMongoDb } = require('./lib/game/server/mongo-connection');

const mongoDataServer = new MongoDataServer({});

let appServer = new ServerManager({
    projectRoot: __dirname,
    projectThemeName: 'default',
    user: process.env.RELDENS_DB_USER || 'mongo_user',
    database: process.env.RELDENS_DB_NAME || 'avaris_relms',
    jsSourceMaps: '1' === process.env.RELDENS_JS_SOURCEMAPS,
    cssSourceMaps: '1' === process.env.RELDENS_CSS_SOURCEMAPS,
    customPlugin: ServerPlugin
}, null, mongoDataServer);

appServer.mongoDb = null;

appServer.events.on('reldens.serverConfigFeaturesReady', (props) => {
    console.log('Evento reldens.serverConfigFeaturesReady disparado com sucesso.');
    try {
        const renderUrl = 'https://avaris-online.onrender.com';
        const cfg = appServer?.configManager;
        if (cfg && typeof cfg.getWithoutLogs === 'function') {
            const currentPublicUrl = cfg.getWithoutLogs('server/publicUrl', '');
            const currentCorsOrigin = cfg.getWithoutLogs('server/appServerConfig/corsOrigin', '');
            if (!currentPublicUrl || currentPublicUrl.includes('localhost') || currentPublicUrl.includes('127.0.0.1') || currentPublicUrl.includes('0.0.0.0')) {
                if (typeof cfg.set === 'function') {
                    cfg.set('server/publicUrl', renderUrl);
                } else if (cfg.config?.server) {
                    cfg.config.server.publicUrl = renderUrl;
                }
            }
            if (!currentCorsOrigin || currentCorsOrigin === '*' || currentCorsOrigin.includes('localhost') || currentCorsOrigin.includes('127.0.0.1') || currentCorsOrigin.includes('0.0.0.0')) {
                if (typeof cfg.set === 'function') {
                    cfg.set('server/appServerConfig/corsOrigin', renderUrl);
                } else if (cfg.config?.server?.appServerConfig) {
                    cfg.config.server.appServerConfig.corsOrigin = renderUrl;
                }
            }
        }
        if (appServer?.app && typeof appServer.app.set === 'function') {
            appServer.app.set('trust proxy', 1);
        }
    } catch (e) {
        console.warn('Aviso ao ajustar URL/CORS no reldens.serverConfigFeaturesReady:', e?.message || e);
    }
});

if ('1' === process.env.RELDENS_BLOCKED_ADMIN) {
    appServer.events.on('reldens.afterCreateAdminManager', (event) => {
        console.log('CRUD Administration Panel bloqueado via RELDENS_BLOCKED_ADMIN.');
        let blackList = [];
        for (let driverResource of event.serverManager.serverAdmin.resources) {
            let entityRoute = '/' + driverResource.entityPath;
            blackList.push(entityRoute + event.serverManager.serverAdmin.savePath);
            blackList.push(entityRoute + event.serverManager.serverAdmin.deletePath);
        }
        event.serverManager.serverAdmin.blackList['1'] = blackList;
        event.serverManager.serverAdmin.blackList['2'] = blackList;
        event.serverManager.serverAdmin.blackList['99'] = blackList;
    });

    appServer.events.on('reldens.roomLoginOnAuth', (props) => {
        if (4 === props.loginResult.user.role_id) {
            props.result.confirm = false;
        }
    });
}

async function startGameServer() {
    try {
        await appServer.createServers();
        console.log('Instância do servidor criada.');

        await appServer.start();
        appServer.mongoDb = getMongoDb();
        console.log('SERVIDOR ONLINE E RODANDO (MongoDB ativo: ' + appServer.mongoDb.databaseName + ')!');
    } catch (err) {
        console.error('Erro ao iniciar servidor/MongoDB:', err);
        process.exit(1);
    }
}

startGameServer();

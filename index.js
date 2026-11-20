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

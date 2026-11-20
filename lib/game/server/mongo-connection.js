const { MongoClient } = require('mongodb');
const dns = require('dns').promises;

let client = null;
let db = null;

function getMongoUri() {
    const uri = process.env.MONGO_URI || process.env.RELDENS_DB_URL || '';
    if (!uri) {
        throw new Error('MONGO_URI (ou RELDENS_DB_URL) não encontrada no ambiente (.env).');
    }
    return uri;
}

function getDbNameFromUri(uri) {
    if (process.env.MONGO_DB_NAME) {
        return process.env.MONGO_DB_NAME;
    }
    try {
        const parsed = new URL(uri);
        const pathName = (parsed.pathname || '').replace(/^\/+/, '').split('/')[0];
        return pathName || 'avaris_relms';
    } catch (_) {
        return 'avaris_relms';
    }
}

async function resolveSrvToDirectUri(srvUri) {
    const parsed = new URL(srvUri);
    const srvHost = `_mongodb._tcp.${parsed.hostname}`;
    const resolver = new dns.Resolver();
    resolver.setServers(['8.8.8.8', '1.1.1.1']);

    let srvRecords;
    try {
        srvRecords = await dns.resolveSrv(srvHost);
    } catch (_) {
        srvRecords = await resolver.resolveSrv(srvHost);
    }

    if (!srvRecords || srvRecords.length === 0) {
        throw new Error(`Nenhum registro SRV encontrado para ${srvHost}`);
    }

    const hosts = srvRecords.map((r) => `${r.name}:${r.port}`).join(',');
    const auth = parsed.username
        ? `${encodeURIComponent(decodeURIComponent(parsed.username))}:${encodeURIComponent(decodeURIComponent(parsed.password))}@`
        : '';
    const dbName = getDbNameFromUri(srvUri);

    let txtParams = '';
    try {
        const txtRecords = await resolver.resolveTxt(parsed.hostname);
        const flatTxt = txtRecords.flat().join('&');
        if (flatTxt) {
            txtParams = flatTxt;
        }
    } catch (_) {}

    const existingParams = parsed.searchParams.toString();
    const mergedParams = new URLSearchParams();
    if (txtParams) {
        for (const [k, v] of new URLSearchParams(txtParams)) {
            mergedParams.set(k, v);
        }
    }
    if (existingParams) {
        for (const [k, v] of new URLSearchParams(existingParams)) {
            mergedParams.set(k, v);
        }
    }
    if (!mergedParams.has('tls')) {
        mergedParams.set('tls', 'true');
    }

    const queryString = mergedParams.toString();
    return `mongodb://${auth}${hosts}/${dbName}${queryString ? `?${queryString}` : ''}`;
}

async function connectMongo() {
    if (db) {
        return db;
    }
    const rawUri = getMongoUri();
    const dbName = getDbNameFromUri(rawUri);

    try {
        client = new MongoClient(rawUri);
        await client.connect();
    } catch (err) {
        if (rawUri.startsWith('mongodb+srv://') && (err.code === 'ECONNREFUSED' || err.syscall === 'querySrv')) {
            console.warn('[MongoDB] Falha no SRV interno do Node, resolvendo hosts via DNS...');
            const directUri = await resolveSrvToDirectUri(rawUri);
            client = new MongoClient(directUri);
            await client.connect();
        } else {
            throw err;
        }
    }

    db = client.db(dbName);
    await db.command({ ping: 1 });
    console.log(`[MongoDB] Conectado com sucesso ao banco "${dbName}".`);
    return db;
}

function getMongoDb() {
    if (!db) {
        throw new Error('[MongoDB] Conexão ainda não inicializada. Chame connectMongo() primeiro.');
    }
    return db;
}

function getMongoClient() {
    return client;
}

module.exports = {
    connectMongo,
    getMongoDb,
    getMongoClient
};

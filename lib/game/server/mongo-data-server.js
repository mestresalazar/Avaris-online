const { BaseDataServer } = require('@reldens/storage');
const { connectMongo, getMongoDb, getMongoClient } = require('./mongo-connection');

class MongoCollectionRepository
{
    constructor(collection, entityName, dataServer = null)
    {
        this.collection = collection;
        this.entityName = entityName;
        this.dataServer = dataServer;
    }

    _normalizeFilter(filter = {})
    {
        if (!filter || 'object' !== typeof filter) {
            return {};
        }
        const query = {};
        for (const [key, value] of Object.entries(filter)) {
            if (value !== undefined) {
                query[key] = value;
            }
        }
        return query;
    }

    async loadAll(filter = {}, select = null)
    {
        const cursor = this.collection.find(this._normalizeFilter(filter));
        if (Array.isArray(select) && select.length > 0) {
            const projection = {};
            for (const field of select) {
                projection[field] = 1;
            }
            cursor.project(projection);
        }
        return await cursor.toArray();
    }

    async load(filter = {}, select = null)
    {
        return await this.loadAll(filter, select);
    }

    async loadAllWithRelations(relations = [], filter = {}, select = null)
    {
        const docs = await this.loadAll(filter, select);
        if (!Array.isArray(relations) || relations.length === 0 || !this.dataServer) {
            return docs;
        }
        for (const doc of docs) {
            for (const rel of relations) {
                if (doc[rel] === undefined) {
                    doc[rel] = [];
                }
            }
        }
        return docs;
    }

    async loadWithRelations(relations = [], filter = {}, select = null)
    {
        return await this.loadAllWithRelations(relations, filter, select);
    }

    async loadBy(field, value, select = null)
    {
        if (field && 'object' === typeof field) {
            return await this.loadAll(field, value);
        }
        const query = field ? { [field]: value } : {};
        return await this.loadAll(query, select);
    }

    async loadByWithRelations(relations = [], field = null, value = undefined, select = null)
    {
        if (field && 'object' === typeof field) {
            return await this.loadAllWithRelations(relations, field, value);
        }
        const query = field ? { [field]: value } : {};
        return await this.loadAllWithRelations(relations, query, select);
    }

    async loadOneBy(field, value)
    {
        if (field && 'object' === typeof field) {
            return await this.loadOne(field);
        }
        const query = field ? { [field]: value } : {};
        return await this.loadOne(query);
    }

    async loadOne(filter = {})
    {
        return await this.collection.findOne(this._normalizeFilter(filter));
    }

    async loadOneWithRelations(relations = [], filter = {})
    {
        const doc = await this.loadOne(filter);
        if (doc && Array.isArray(relations)) {
            for (const rel of relations) {
                if (doc[rel] === undefined) {
                    doc[rel] = [];
                }
            }
        }
        return doc;
    }

    async loadById(id)
    {
        return await this.collection.findOne({ $or: [{ _id: id }, { id: id }] });
    }

    async create(data = {})
    {
        const doc = { ...data };
        if (doc.id === undefined) {
            const lastDoc = await this.collection.find({}).sort({ id: -1 }).limit(1).toArray();
            const nextId = (lastDoc[0] && typeof lastDoc[0].id === 'number') ? lastDoc[0].id + 1 : Date.now();
            doc.id = nextId;
        }
        const result = await this.collection.insertOne(doc);
        return { ...doc, _id: result.insertedId };
    }

    async insert(data = {})
    {
        return await this.create(data);
    }

    async update(filter = {}, data = {})
    {
        const query = this._normalizeFilter(filter);
        await this.collection.updateMany(query, { $set: data });
        return await this.loadAll(query);
    }

    async patch(id, data = {})
    {
        return await this.updateById(id, data);
    }

    async updateById(id, data = {})
    {
        const query = { $or: [{ _id: id }, { id: id }] };
        await this.collection.updateOne(query, { $set: data });
        return await this.loadById(id);
    }

    async delete(filter = {})
    {
        const query = this._normalizeFilter(filter);
        const res = await this.collection.deleteMany(query);
        return res.deletedCount > 0;
    }

    async remove(filter = {})
    {
        return await this.delete(filter);
    }

    async deleteById(id)
    {
        const query = { $or: [{ _id: id }, { id: id }] };
        const res = await this.collection.deleteOne(query);
        return res.deletedCount > 0;
    }

    async count(filter = {})
    {
        return await this.collection.countDocuments(this._normalizeFilter(filter));
    }
}

class MongoDataServer extends BaseDataServer
{
    constructor(config = {})
    {
        super(config);
        this.config = config;
        this.db = null;
        this.client = null;
        this.entities = {};
        this.repositories = {};
        this.initialized = false;
    }

    async connect()
    {
        this.db = await connectMongo();
        this.client = getMongoClient();
        this.initialized = true;
        return true;
    }

    async disconnect()
    {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
            this.initialized = false;
        }
        return true;
    }

    async generateEntities()
    {
        if (!this.db) {
            this.db = getMongoDb();
        }
        const loadedEntities = (this.config && this.config.loadedEntities) || {};
        for (const entityName of Object.keys(loadedEntities)) {
            this.getEntity(entityName);
        }
        for (const defaultEntity of ['users', 'ipLists', 'rooms', 'config', 'features']) {
            this.getEntity(defaultEntity);
        }
        return this.entities;
    }

    getEntity(entityName)
    {
        if (!this.db) {
            this.db = getMongoDb();
        }
        if (!this.repositories[entityName]) {
            const collectionName = entityName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
            const collection = this.db.collection(collectionName);
            const repo = new MongoCollectionRepository(collection, entityName, this);
            this.repositories[entityName] = repo;
            this.entities[entityName] = repo;
        }
        return this.repositories[entityName];
    }

    async fetchEntitiesFromDatabase()
    {
        if (!this.db) {
            this.db = getMongoDb();
        }
        const cols = await this.db.listCollections().toArray();
        return cols.map((c) => c.name);
    }
}

module.exports = {
    MongoDataServer,
    MongoCollectionRepository
};

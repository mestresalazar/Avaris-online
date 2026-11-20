/**
 *
 * Reldens - InitialGameDataEnricher
 *
 * Enriches the initial game data with user locale information.
 *
 */

/**
 * @typedef {import('@colyseus/core').Client} Client
 */
class InitialGameDataEnricher
{

    /**
     * @param {Object} superInitialGameData
     * @param {Object} roomGame
     * @param {Client} client
     * @param {Object} userModel
     * @returns {Promise<boolean|void>}
     */
    static async withLocale(superInitialGameData, roomGame, client, userModel)
    {
        let eventData = {superInitialGameData, roomGame, client, userModel};
        let startEvent = Object.assign({continueProcess: true}, eventData);
        roomGame.events.emit('reldens.beforeEnrichUserWithLocale', startEvent);
        if(!startEvent.continueProcess){
            return false;
        }
        const usersLocaleEntity = roomGame.dataServer.getEntity('usersLocale');
        let userLocale = null;
        if (usersLocaleEntity) {
            if (typeof usersLocaleEntity.loadOneByWithRelations === 'function') {
                userLocale = await usersLocaleEntity.loadOneByWithRelations(
                    'user_id',
                    userModel.id,
                    ['related_locale']
                );
            } else if (typeof usersLocaleEntity.loadOneWithRelations === 'function') {
                userLocale = await usersLocaleEntity.loadOneWithRelations(['related_locale'], { user_id: userModel.id });
            } else if (typeof usersLocaleEntity.loadOneBy === 'function') {
                userLocale = await usersLocaleEntity.loadOneBy('user_id', userModel.id);
            }
        }
        if(!userLocale?.related_locale){
            return true;
        }
        superInitialGameData.userLocale = userLocale.related_locale;
        roomGame.events.emit('reldens.afterEnrichPlayerWithLocale', eventData);
    }

}

module.exports.InitialGameDataEnricher = InitialGameDataEnricher;

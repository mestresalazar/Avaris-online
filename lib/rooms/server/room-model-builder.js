/**
 *
 * Reldens - RoomModelBuilder
 *
 * Builds the runtime room data model from a rooms entity row and its change/return point relations.
 *
 */

const { RoomsConst } = require('../constants');
const { Logger, sc } = require('@reldens/utils');

class RoomModelBuilder
{

    /**
     * @param {Object} room
     * @returns {Object|boolean}
     */
    build(room)
    {
        if(!sc.isObject(room) || 0 === Object.keys(room).length){
            Logger.critical('Room not available.', room);
            return false;
        }
        let roomCustomData = sc.toJson(room.customData, {});
        let roomDataModel = {
            roomId: room.id,
            roomName: room.name,
            roomTitle: room.title,
            serverUrl: room.server_url,
            roomMap: (room?.map_filename || '').toString().replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, ''),
            sceneImages: room.scene_images.split(','),
            changePoints: [],
            returnPoints: [],
            roomClassPath: room.room_class_key,
            returnPointDefault: false,
            enabled: false !== sc.get(roomCustomData, 'enabled', true),
            customData: roomCustomData
        };
        this.appendChangePoints(roomDataModel, room);
        this.appendReturnPoints(roomDataModel, room);
        if(0 === roomDataModel.returnPoints.length){
            Logger.warning('None return points for room: '+roomDataModel.roomName+' (ID: '+roomDataModel.roomId+').');
        }
        if(!roomDataModel.returnPointDefault){
            roomDataModel.returnPointDefault = roomDataModel.returnPoints[0];
        }
        return roomDataModel;
    }

    /**
     * @param {Object} roomDataModel
     * @param {Object} room
     */
    appendChangePoints(roomDataModel, room)
    {
        if(!sc.isArray(room.related_rooms_change_points_room)){
            Logger.warning('Invalid change points data for room: '+roomDataModel.roomName+'.', roomDataModel);
        }
        let rawChangePoints = ('function' === typeof sc.get) ? sc.get(room, 'related_rooms_change_points_room', []) : (room && room.related_rooms_change_points_room);
        let changePointsList = Array.isArray(rawChangePoints) ? rawChangePoints : [];
        for(let changePoint of changePointsList){
            if(!changePoint){
                continue;
            }
            let changePointData = {};
            changePointData[RoomsConst.TILE_INDEX] = changePoint.tile_index;
            changePointData[RoomsConst.NEXT_SCENE] = (changePoint.related_rooms_next_room && changePoint.related_rooms_next_room.name) || '';
            roomDataModel.changePoints.push(changePointData);
        }
    }

    /**
     * @param {Object} roomDataModel
     * @param {Object} room
     */
    appendReturnPoints(roomDataModel, room)
    {
        if(!sc.isArray(room.related_rooms_return_points_room)){
            Logger.warning('Invalid return points data for room: '+roomDataModel.roomName+'.', roomDataModel);
        }
        let rawReturnPoints = ('function' === typeof sc.get) ? sc.get(room, 'related_rooms_return_points_room', []) : (room && room.related_rooms_return_points_room);
        let returnPointsList = Array.isArray(rawReturnPoints) ? rawReturnPoints : [];
        for(let returnPosition of returnPointsList){
            if(!returnPosition){
                continue;
            }
            let fromRoom = returnPosition.related_rooms_from_room
                ? returnPosition.related_rooms_from_room.name
                : false;
            let position = {
                [RoomsConst.RETURN_POINT_KEYS.DIRECTION]: returnPosition.direction,
                [RoomsConst.RETURN_POINT_KEYS.X]: returnPosition.x,
                [RoomsConst.RETURN_POINT_KEYS.Y]: returnPosition.y,
                [RoomsConst.RETURN_POINT_KEYS.PREVIOUS]: fromRoom
            };
            let hasDefault = ('function' === typeof sc.hasOwn)
                ? sc.hasOwn(returnPosition, 'is_default')
                : Object.prototype.hasOwnProperty.call(returnPosition, 'is_default');
            if(hasDefault && returnPosition.is_default){
                position[RoomsConst.RETURN_POINT_KEYS.DEFAULT] = returnPosition.is_default;
                roomDataModel.returnPointDefault = position;
            }
            roomDataModel.returnPoints.push(position);
        }
    }

}

module.exports.RoomModelBuilder = RoomModelBuilder;

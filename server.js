const path = require('path');

module.exports.init = async (extension) => {
  const app = extension._app.expressApp;
  const Config = extension._app.config;
  const obj = extension._app.objectManagers;

  const AuthenticationMWs = require('/app/src/backend/middlewares/user/AuthenticationMWs').AuthenticationMWs;
  const UserRoles = require('/app/src/common/entities/UserDTO').UserRoles;
  const SortByTypes = require('/app/src/common/entities/SortingMethods').SortByTypes;
  const Message = require('/app/src/common/entities/Message').Message;
  const {ErrorDTO, ErrorCodes} = require('/app/src/common/entities/Error');

  

  // Register route to return only media info for a random media item matching the search query
  app.get(
    Config.Server.apiPath + '/gallery/random/:searchQueryDTO/info',
    AuthenticationMWs.authenticate,
    AuthenticationMWs.authorise(UserRoles.LimitedGuest),
    async (req, res, next) => {
      try {
        let query = null;
        if (req.params['searchQueryDTO']) {
          try {
            query = JSON.parse(req.params['searchQueryDTO']);
          } catch (e) {
            return next(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'Invalid search query JSON', e));
          }
        }

        // Support count and exclude parameters (mirror GalleryMWs.getRandomMediaInfo)
        const count = Math.min(
          Math.max(1, parseInt(req.query['count'] || 1, 10) || 1),
          100
        );

        const excludeIdsStr = req.query['exclude'];
        const excludeIds = new Set();
        if (excludeIdsStr) {
          excludeIdsStr.split(',').forEach(id => {
            const numId = parseInt(id.trim(), 10);
            if (!isNaN(numId)) {
              excludeIds.add(numId);
            }
          });
        }

        const fetchCount = excludeIds.size > 0
          ? Math.min(count * 3 + excludeIds.size, 200)
          : count;

        // Read extension config at request-time so runtime changes take effect
        const extCfgReq = extension.config.getConfig() || {};
        const allowVideosReq = !!extCfgReq.allowVideos;
        const photoOnly = !allowVideosReq;

        let media = await obj.SearchManager.getNMedia(
          req.session.context,
          query,
          [{method: SortByTypes.Random, ascending: null}],
          fetchCount,
          photoOnly
        );

        

        if (excludeIds.size > 0) {
          media = media.filter(m => !excludeIds.has(m.id));
        }

        media = media.slice(0, count);

        if (!media || media.length === 0) {
          return res.json(new Message(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'No media found'), null));
        }

        // If single, return object; else return array
        if (count === 1) {
          const item = media[0];
          const mediaPath = path.join(item.directory.path, item.directory.name, item.name);
          const mediaEntry = await obj.GalleryManager.getMedia(req.session.context, mediaPath);
          const result = {
            id: mediaEntry.id,
            name: mediaEntry.name,
            metadata: mediaEntry.metadata,
            directory: {
              id: mediaEntry.directory.id,
              name: mediaEntry.directory.name,
              path: mediaEntry.directory.path
            }
          };
          return res.json(new Message(null, result));
        }

        // map to full media entries for multi-result
        const fullEntries = [];
        for (const item of media) {
          const mediaPath = path.join(item.directory.path, item.directory.name, item.name);
          const mediaEntry = await obj.GalleryManager.getMedia(req.session.context, mediaPath);
          const entry = {
            id: mediaEntry.id,
            name: mediaEntry.name,
            metadata: mediaEntry.metadata,
            directory: {
              id: mediaEntry.directory.id,
              name: mediaEntry.directory.name,
              path: mediaEntry.directory.path
            }
          };
          fullEntries.push(entry);
        }
        return res.json(new Message(null, fullEntries));
      } catch (e) {
        return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, "Can't get random photo: " + e.toString(), e));
      }
    }
  );
};

module.exports.cleanUp = async (extension) => {
  // no cleanup necessary for this simple extension
};

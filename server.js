const path = require('path');
const fs = require('fs');

module.exports.init = async (extension) => {
  const app = extension._app.expressApp;
  const Config = extension._app.config;
  const obj = extension._app.objectManagers;

  const AuthenticationMWs = require('/app/src/backend/middlewares/user/AuthenticationMWs').AuthenticationMWs;
  const UserRoles = require('/app/src/common/entities/UserDTO').UserRoles;
  const SortByTypes = require('/app/src/common/entities/SortingMethods').SortByTypes;
  const Message = require('/app/src/common/entities/Message').Message;
  const { ErrorDTO, ErrorCodes } = require('/app/src/common/entities/Error');

  // Path to presets file and UI HTML
  const presetsPath = path.resolve('/app/data/config/shuffle_presets.json');
  const uiHtmlPath = path.resolve(__dirname, 'index.html');

  function loadPresets() {
    try {
      if (fs.existsSync(presetsPath)) {
        const raw = fs.readFileSync(presetsPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('[random-info] Failed to load shuffle_presets.json:', e);
    }
    return [];
  }

  function savePresets(presets) {
    try {
      fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('[random-info] Failed to save shuffle_presets.json:', e);
      return false;
    }
  }

  // Helper to execute media search and entry retrieval
  async function fetchRandomMedia(context, query, count, excludeIdsStr, allowVideosReq) {
    const safeCount = Math.min(Math.max(1, parseInt(count || 1, 10) || 1), 100);

    const excludeIds = new Set();
    if (excludeIdsStr) {
      excludeIdsStr.split(',').forEach((id) => {
        const numId = parseInt(id.trim(), 10);
        if (!isNaN(numId)) {
          excludeIds.add(numId);
        }
      });
    }

    const fetchCount = excludeIds.size > 0
      ? Math.min(safeCount * 3 + excludeIds.size, 200)
      : safeCount;
    const photoOnly = !allowVideosReq;

    let media = await obj.SearchManager.getNMedia(
      context,
      query,
      [{ method: SortByTypes.Random, ascending: null }],
      fetchCount,
      photoOnly
    );

    if (excludeIds.size > 0) {
      media = media.filter((m) => !excludeIds.has(m.id));
    }

    media = media.slice(0, safeCount);
    if (!media || media.length === 0) {
      return safeCount === 1 ? null : [];
    }

    if (safeCount === 1) {
      const item = media[0];
      const mediaPath = path.join(item.directory.path, item.directory.name, item.name);
      const mediaEntry = await obj.GalleryManager.getMedia(context, mediaPath);
      return {
        id: mediaEntry.id,
        name: mediaEntry.name,
        metadata: mediaEntry.metadata,
        directory: {
          id: mediaEntry.directory.id,
          name: mediaEntry.directory.name,
          path: mediaEntry.directory.path,
        },
      };
    }

    const fullEntries = [];
    for (const item of media) {
      const mediaPath = path.join(item.directory.path, item.directory.name, item.name);
      const mediaEntry = await obj.GalleryManager.getMedia(context, mediaPath);
      fullEntries.push({
        id: mediaEntry.id,
        name: mediaEntry.name,
        metadata: mediaEntry.metadata,
        directory: {
          id: mediaEntry.directory.id,
          name: mediaEntry.directory.name,
          path: mediaEntry.directory.path,
        },
      });
    }
    return fullEntries;
  }

  // 1. GET /gallery/random/presets/ui - Serve Management Web UI
  app.get(
    Config.Server.apiPath + '/gallery/random/presets/ui',
    (req, res) => {
      if (fs.existsSync(uiHtmlPath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.sendFile(uiHtmlPath);
      }
      return res.status(404).send('UI template not found');
    }
  );

  // 2. GET /gallery/random/shuffle/info - Pick a random active preset and return media info
  app.get(
    Config.Server.apiPath + '/gallery/random/shuffle/info',
    AuthenticationMWs.authenticate,
    AuthenticationMWs.authorise(UserRoles.LimitedGuest),
    async (req, res, next) => {
      try {
        const presets = loadPresets();
        const groupFilter = req.query['group'];
        let activePresets = presets.filter((p) => p.active !== false);

        if (groupFilter) {
          activePresets = activePresets.filter((p) => p.group === groupFilter);
        }

        if (activePresets.length === 0) {
          return res.json(new Message(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'No active presets available'), null));
        }

        // Pick one preset at random
        const selectedPreset = activePresets[Math.floor(Math.random() * activePresets.length)];
        const query = selectedPreset.searchQuery || { type: 100, text: '' };

        const extCfgReq = extension.config.getConfig() || {};
        const allowVideosReq = !!extCfgReq.allowVideos;

        const mediaResult = await fetchRandomMedia(
          req.session.context,
          query,
          req.query['count'],
          req.query['exclude'],
          allowVideosReq
        );

        if (!mediaResult || (Array.isArray(mediaResult) && mediaResult.length === 0)) {
          return res.json(new Message(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'No media found for preset: ' + selectedPreset.name), null));
        }

        if (Array.isArray(mediaResult)) {
          return res.json(new Message(null, {
            preset: { id: selectedPreset.id, name: selectedPreset.name, group: selectedPreset.group },
            media: mediaResult,
          }));
        }

        const responseData = Object.assign({}, mediaResult, {
          preset: { id: selectedPreset.id, name: selectedPreset.name, group: selectedPreset.group },
        });

        return res.json(new Message(null, responseData));
      } catch (e) {
        return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, "Can't get shuffle random photo info: " + e.toString(), e));
      }
    }
  );

  // 3. GET /gallery/random/shuffle - Redirect or serve random photo directly from active presets
  app.get(
    Config.Server.apiPath + '/gallery/random/shuffle',
    AuthenticationMWs.authenticate,
    AuthenticationMWs.authorise(UserRoles.LimitedGuest),
    async (req, res, next) => {
      try {
        const presets = loadPresets();
        const groupFilter = req.query['group'];
        let activePresets = presets.filter((p) => p.active !== false);

        if (groupFilter) {
          activePresets = activePresets.filter((p) => p.group === groupFilter);
        }

        if (activePresets.length === 0) {
          return res.json(new Message(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'No active presets available'), null));
        }

        const selectedPreset = activePresets[Math.floor(Math.random() * activePresets.length)];
        const queryStr = encodeURIComponent(JSON.stringify(selectedPreset.searchQuery || { type: 100, text: '' }));
        const randomParam = Math.random().toString(32).substring(2);

        return res.redirect(`${Config.Server.apiPath}/gallery/random/${queryStr}?${randomParam}`);
      } catch (e) {
        return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, "Can't redirect shuffle random photo: " + e.toString(), e));
      }
    }
  );

  // 4. GET /gallery/random/presets - List all presets
  app.get(
    Config.Server.apiPath + '/gallery/random/presets',
    AuthenticationMWs.authenticate,
    AuthenticationMWs.authorise(UserRoles.LimitedGuest),
    async (req, res) => {
      const presets = loadPresets();
      return res.json(new Message(null, presets));
    }
  );

  // 5. POST /gallery/random/presets - Create new preset
  app.post(
    Config.Server.apiPath + '/gallery/random/presets',
    AuthenticationMWs.authenticate,
    AuthenticationMWs.authorise(UserRoles.User),
    async (req, res, next) => {
      try {
        const { name, group, searchQuery, active } = req.body || {};
        if (!name) {
          return res.json(new Message(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'Missing preset name'), null));
        }

        const presets = loadPresets();
        const maxId = presets.reduce((max, p) => (p.id > max ? p.id : max), 0);
        const newPreset = {
          id: maxId + 1,
          name: String(name).trim(),
          group: group ? String(group).trim() : '',
          active: active !== undefined ? !!active : true,
          searchQuery: searchQuery || { type: 100, text: '' },
        };

        presets.push(newPreset);
        savePresets(presets);

        return res.json(new Message(null, newPreset));
      } catch (e) {
        return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Failed to create preset: ' + e.toString(), e));
      }
    }
  );

  // 6. PUT /gallery/random/presets/:id - Update existing preset
  app.put(
    Config.Server.apiPath + '/gallery/random/presets/:id',
    AuthenticationMWs.authenticate,
    AuthenticationMWs.authorise(UserRoles.User),
    async (req, res, next) => {
      try {
        const id = parseInt(req.params.id, 10);
        const { name, group, searchQuery, active } = req.body || {};

        const presets = loadPresets();
        const target = presets.find((p) => p.id === id);
        if (!target) {
          return res.json(new Message(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'Preset not found'), null));
        }

        if (name !== undefined) target.name = String(name).trim();
        if (group !== undefined) target.group = String(group).trim();
        if (searchQuery !== undefined) target.searchQuery = searchQuery;
        if (active !== undefined) target.active = !!active;

        savePresets(presets);
        return res.json(new Message(null, target));
      } catch (e) {
        return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Failed to update preset: ' + e.toString(), e));
      }
    }
  );

  // 7. DELETE /gallery/random/presets/:id - Delete preset
  app.delete(
    Config.Server.apiPath + '/gallery/random/presets/:id',
    AuthenticationMWs.authenticate,
    AuthenticationMWs.authorise(UserRoles.User),
    async (req, res, next) => {
      try {
        const id = parseInt(req.params.id, 10);
        let presets = loadPresets();
        const initialLen = presets.length;
        presets = presets.filter((p) => p.id !== id);

        if (presets.length === initialLen) {
          return res.json(new Message(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'Preset not found'), null));
        }

        savePresets(presets);
        return res.json(new Message(null, { id, deleted: true }));
      } catch (e) {
        return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Failed to delete preset: ' + e.toString(), e));
      }
    }
  );

  // 8. POST /gallery/random/presets/toggle - Toggle preset active status
  app.post(
    Config.Server.apiPath + '/gallery/random/presets/toggle',
    AuthenticationMWs.authenticate,
    AuthenticationMWs.authorise(UserRoles.User),
    async (req, res, next) => {
      try {
        const { id, active } = req.body || {};
        if (id === undefined) {
          return res.json(new Message(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'Missing preset id'), null));
        }

        const presets = loadPresets();
        const target = presets.find((p) => p.id === id);
        if (!target) {
          return res.json(new Message(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'Preset not found'), null));
        }

        target.active = active !== undefined ? !!active : !target.active;
        savePresets(presets);

        return res.json(new Message(null, { id: target.id, name: target.name, active: target.active }));
      } catch (e) {
        return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Failed to toggle preset: ' + e.toString(), e));
      }
    }
  );

  // 9. Existing: GET /gallery/random/:searchQueryDTO/info
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

        const extCfgReq = extension.config.getConfig() || {};
        const allowVideosReq = !!extCfgReq.allowVideos;

        const result = await fetchRandomMedia(
          req.session.context,
          query,
          req.query['count'],
          req.query['exclude'],
          allowVideosReq
        );

        if (!result || (Array.isArray(result) && result.length === 0)) {
          return res.json(new Message(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'No media found'), null));
        }

        return res.json(new Message(null, result));
      } catch (e) {
        return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, "Can't get random photo: " + e.toString(), e));
      }
    }
  );
};

module.exports.cleanUp = async (extension) => {
  // no cleanup necessary
};

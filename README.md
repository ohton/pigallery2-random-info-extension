# pigallery2-random-info-extension

Adds `/info` and `/shuffle` endpoints to PiGallery2's RANDOM API for metadata-based random media retrieval, supporting preset-based shuffle pools and query-based filtering.

## Features
- **Shuffle Pool (`GET /pgapi/gallery/random/shuffle/info`)**:
  - Automatically selects a random active preset from `/app/data/config/shuffle_presets.json`.
  - Supports optional group filtering via `?group=<group_name>`.
  - Returns media metadata along with the selected preset information.
- **Direct Shuffle Redirect (`GET /pgapi/gallery/random/shuffle`)**:
  - Redirects directly to a random photo from the active presets.
- **Query Info (`GET /pgapi/gallery/random/:searchQueryDTO/info`)**:
  - Returns metadata for media items matching a specific query DTO.
- **Web UI Query & Preset Manager (`GET /pgapi/gallery/random/presets/ui`)**:
  - Web interface to manage shuffle presets with thumbnail previews.
  - Group filtering and one-click bulk enable/disable.
  - "Active only" filter toggle.
  - Preview modal to test query hits and cycle sample images.
  - Direct links to PiGallery2 gallery search results in a new tab.
- **Preset Management API (CRUD)**:
  - `GET /pgapi/gallery/random/presets`: List all presets.
  - `POST /pgapi/gallery/random/presets`: Create a new preset.
  - `PUT /pgapi/gallery/random/presets/:id`: Update an existing preset.
  - `DELETE /pgapi/gallery/random/presets/:id`: Delete a preset.
  - `POST /pgapi/gallery/random/presets/toggle`: Toggle active status of a preset (`{ "id": 1, "active": true/false }`).
  - `GET /pgapi/gallery/random/presets/ui`: Serve the management Web UI.
- **Common Query Parameters**:
  - `count`: Number of items to retrieve (default: 1, max: 100). When `count=1`, `result` is a single object; when `count>1`, `result` is an array.
  - `exclude`: Comma-separated media IDs to skip (e.g. `?exclude=123,456`).
- **Configurable**:
  - `allowVideos` (true → include videos, false → photos only).

## Installation
- Drop this folder into your configured extensions folder (default `/app/data/config/extensions`).
- Place `shuffle_presets.json` in `/app/data/config/shuffle_presets.json`.

## Configuration
Configure the extension via the web UI: open Settings → Extensions → `random-info`, toggle `allowVideos` and save.

## Presets Format (`shuffle_presets.json`)
```json
[
  {
    "id": 1,
    "name": "Cat Photos",
    "group": "animals",
    "active": true,
    "searchQuery": {
      "type": 104,
      "value": "cat"
    }
  }
]
```

## API examples

### 1. Shuffle Random Info (Preset Pool)
```bash
curl 'http://<host>/pgapi/gallery/random/shuffle/info?count=1'
```

With group filter:
```bash
curl 'http://<host>/pgapi/gallery/random/shuffle/info?group=animals&count=20&exclude=10,20'
```

Example response:
```json
{
  "error": null,
  "result": {
    "id": 2,
    "name": "example.jpg",
    "metadata": { "creationDate": 1620000000000, "fileSize": 12345, "size": { "width": 800, "height": 600 } },
    "directory": { "id": 1, "name": ".", "path": "./" },
    "preset": { "id": 1, "name": "Cat Photos", "group": "animals" }
  }
}
```

### 2. Query Random Info (Specific Query)
```bash
curl 'http://<host>/pgapi/gallery/random/%7B%22type%22%3A100%2C%22value%22%3A%22%22%7D/info?count=1'
```

### 3. List Presets
```bash
curl 'http://<host>/pgapi/gallery/random/presets'
```

### 4. Toggle Preset Status
```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"id": 1, "active": false}' \
  http://<host>/pgapi/gallery/random/presets/toggle
```

### 5. Create Preset
```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"name": "Dog Photos", "group": "animals", "active": true, "searchQuery": {"type": 104, "value": "dog"}}' \
  http://<host>/pgapi/gallery/random/presets
```

### 6. Update Preset
```bash
curl -X PUT -H 'Content-Type: application/json' \
  -d '{"name": "Cute Dog Photos", "group": "animals", "active": true, "searchQuery": {"type": 104, "value": "dog"}}' \
  http://<host>/pgapi/gallery/random/presets/1
```

### 7. Delete Preset
```bash
curl -X DELETE http://<host>/pgapi/gallery/random/presets/1
```

### 8. Web UI (Presets Manager)
Open in your browser:
```
http://<host>/pgapi/gallery/random/presets/ui
```
(Or `http://<host>/presets` if reverse-proxied via Nginx)

## License
MIT

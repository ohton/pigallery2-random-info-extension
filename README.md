# pigallery2-random-info-extension

Adds an `/info` endpoint to the existing RANDOM API that returns only media metadata for matching random media items.

## Features
- Adds GET /pgapi/gallery/random/:searchQueryDTO/info
- Supports `count` (number of items) and `exclude` (CSV of media ids to skip)
- Configurable via extension config: `allowVideos` (true → include videos, false → photos only)
- Behavior: `count=1` → `result` is a single object; `count>1` → `result` is an array

## Installation
- Drop this folder into your configured extensions folder (default `/app/data/config/extensions`).
- Ensure the extension folder name is `random-info-extension` (the Settings UI displays the folder name).

## Configuration
Configure the extension via the web UI: open Settings → Extensions → `random-info-extension`, toggle `allowVideos` and save.

## API examples
Sample searchQueryDTO

```json
{"type":100,"value":""}
```

```URL-encoded
%7B%22type%22%3A100%2C%22value%22%3A%22%22%7D
```

0. Before calling the API you need to obtain a session cookie (cookiejar) by logging in once:

```bash
curl -s -c cookiejar -H 'Content-Type: application/json' \
  -d '{"loginCredential":{"username":"admin","password":"admin"}}' \
  http://<host>/pgapi/user/login -i
```

1. Single item (object result):

```bash
curl -b cookiejar 'http://<host>/pgapi/gallery/random/%7B%22type%22%3A100%2C%22value%22%3A%22%22%7D/info?count=1'
```

Example response (single):

```json
{
  "error": null,
  "result": {
    "id": 2,
    "name": "example.jpg",
    "metadata": { "creationDate": 1620000000000, "fileSize": 12345, "size": { "width": 800, "height": 600 } },
    "directory": { "id": 1, "name": ".", "path": "./" }
  }
}
```

2. Multiple items (array result) with exclusion:

```bash
curl -b cookiejar 'http://<host>/pgapi/gallery/random/%7B%22type%22%3A100%2C%22value%22%3A%22%22%7D/info?count=3&exclude=5,7'
```

Example response (multiple):

```json
{
  "error": null,
  "result": [
    {
      "id": 2,
      "name": "example1.jpg",
      "metadata": { "creationDate": 1620000000000, "fileSize": 12345, "size": { "width": 800, "height": 600 } },
      "directory": { "id": 1, "name": ".", "path": "./" }
    },
    {
      "id": 3,
      "name": "example2.jpg",
      "metadata": { "creationDate": 1620001000000, "fileSize": 23456, "size": { "width": 1024, "height": 768 } },
      "directory": { "id": 1, "name": ".", "path": "./" }
    }
  ]
}
```

## License
MIT

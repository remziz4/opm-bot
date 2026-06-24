curl -X PUT 'http://localhost:3000/api/sessions/default' \
  -H 'Content-Type: application/json' \
  -H 'X-Api-Key: YOUR_WAHA_API_KEY' \
  -H 'Accept: application/json' \
  --data-binary @- <<'JSON'
{
  "name": "default",
  "config": {
    "webhooks": [
      {
        "url": "http://app:4000/message",
        "events": [
          "message.any"
        ],
        "retries": {
          "delaySeconds": 2,
          "attempts": 5,
          "policy": "linear"
        }
      }
    ]
  }
}
JSON

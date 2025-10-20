# Smart Shopper Recommendation Service

FastAPI microservice that powers item and brand suggestions for the mobile app.

## Running Locally

```bash
cd services/recommendations
python -m venv .venv
. .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs are available at `http://localhost:8000/docs`.

## Docker

```bash
docker build -t smartshopper-reco .
docker run --rm -p 8000:8000 smartshopper-reco
```

## Endpoints

| Method | Path      | Description                                  |
| ------ | --------- | -------------------------------------------- |
| GET    | `/health` | Service readiness check                      |
| POST   | `/suggest`| Returns item recommendations for a given query |

The `/suggest` endpoint accepts:

```json
{
  "query": "bread",
  "locale": "en-US",
  "context_items": [
    { "label": "sandwich", "quantity": 2 }
  ]
}
```

And responds with scored suggestions plus metadata.

## Next Steps

- Swap seed catalog for Supabase-powered collaborative filtering.
- Add brand embeddings (SentenceTransformers) once a vector store is provisioned.
- Instrument tracing when deploying to production infrastructure.

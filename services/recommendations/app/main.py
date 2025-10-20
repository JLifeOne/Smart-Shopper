from __future__ import annotations

import time
from typing import List, Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field


class ContextItem(BaseModel):
    label: str
    quantity: Optional[float] = None
    unit: Optional[str] = None


class SuggestRequest(BaseModel):
    query: str = Field(..., min_length=1)
    locale: Optional[str] = None
    context_items: List[ContextItem] = Field(default_factory=list)


class Suggestion(BaseModel):
    label: str
    type: str = Field(default="product")
    confidence: float = Field(default=0.5, ge=0, le=1)
    metadata: dict = Field(default_factory=dict)


class SuggestResponse(BaseModel):
    suggestions: List[Suggestion]
    latency_ms: int
    model_version: str = "baseline-v0"


app = FastAPI(title="Smart Shopper Recommendations", version="0.1.0")


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}


@app.post("/suggest", response_model=SuggestResponse, tags=["recommendations"])
def suggest(request: SuggestRequest) -> SuggestResponse:
    start = time.perf_counter()
    normalized_query = request.query.lower().strip()

    seed_catalog = [
        "whole wheat bread",
        "white bread",
        "multigrain bread",
        "almond milk",
        "oat milk",
        "cheddar cheese",
        "gouda cheese",
        "organic eggs",
        "brown eggs",
        "plantain chips"
    ]

    matches: List[Suggestion] = []
    for item in seed_catalog:
        score = 0.4
        if normalized_query in item:
            score += 0.4
        if any(ctx.label.lower() in item for ctx in request.context_items):
            score += 0.15
        matches.append(
            Suggestion(
              label=item.title(),
              type="product",
              confidence=min(score, 0.99),
              metadata={
                "locale": request.locale or "global",
                "source": "seed"
              }
            )
        )

    matches.sort(key=lambda suggestion: suggestion.confidence, reverse=True)
    top_matches = matches[:8]

    duration_ms = int((time.perf_counter() - start) * 1000)
    return SuggestResponse(suggestions=top_matches, latency_ms=duration_ms)

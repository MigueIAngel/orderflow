import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis

from app.api import router
from app.config import Settings, get_settings
from app.db import Base, create_engine, create_session_factory
from app.handlers import build_handlers
from app.messaging.consumer import StreamConsumer
from app.messaging.outbox import run_relay

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = create_engine(settings.database_url)
        app.state.session_factory = create_session_factory(engine)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        tasks: list[asyncio.Task] = []
        if settings.enable_messaging:
            app.state.redis = Redis.from_url(settings.redis_url, decode_responses=True)
            consumer = StreamConsumer(
                app.state.redis,
                app.state.session_factory,
                stream=settings.events_stream,
                group=settings.consumer_group,
                consumer=settings.consumer_name,
                handlers=build_handlers(settings.card_limit),
                processing_delay=settings.processing_delay_ms / 1000,
            )
            tasks = [
                asyncio.create_task(consumer.run(), name="consumer"),
                asyncio.create_task(
                    run_relay(app.state.session_factory, app.state.redis, settings.events_stream),
                    name="outbox-relay",
                ),
            ]
        yield
        for task in tasks:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        if settings.enable_messaging:
            await app.state.redis.aclose()
        await engine.dispose()

    app = FastAPI(
        title="OrderFlow · Payments service",
        version="1.0.0",
        description="Payment intents and simulated card charges for the order saga.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    return app


app = create_app()

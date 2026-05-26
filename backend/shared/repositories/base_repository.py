"""Generic repository primitives shared across backend features."""

from __future__ import annotations

from typing import Any, Generic, TypeVar

from django.db import models
from django.db.models import QuerySet

ModelT = TypeVar("ModelT", bound=models.Model)


class BaseRepository(Generic[ModelT]):
    """Small generic repository with common CRUD helpers."""

    model: type[ModelT]

    def __init__(self, model: type[ModelT]):
        self.model = model

    def all(self) -> QuerySet[ModelT]:
        return self.model.objects.all()

    def get_queryset(self) -> QuerySet[ModelT]:
        return self.all()

    def get_by_id(self, obj_id: Any) -> ModelT | None:
        return self.model.objects.filter(pk=obj_id).first()

    def filter(self, **kwargs: Any) -> QuerySet[ModelT]:
        return self.model.objects.filter(**kwargs)

    def create(self, **kwargs: Any) -> ModelT:
        return self.model.objects.create(**kwargs)

    def update(self, obj: ModelT, **kwargs: Any) -> ModelT:
        for key, value in kwargs.items():
            setattr(obj, key, value)
        if kwargs:
            update_fields = list(kwargs.keys())
            if hasattr(obj, "updated_at") and "updated_at" not in update_fields:
                update_fields.append("updated_at")
            obj.save(update_fields=update_fields)
        return obj

    def delete(self, obj: ModelT) -> None:
        obj.delete()

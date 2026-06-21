"""Shared service-layer primitives."""

from __future__ import annotations

from typing import Generic, TypeVar

from shared.repositories.base_repository import BaseRepository, ModelT

RepoT = TypeVar("RepoT", bound=BaseRepository)


class BaseService(Generic[ModelT, RepoT]):
    """Thin base service wrapping a repository for CRUD operations."""

    repository: RepoT

    def __init__(self, repository: RepoT):
        self.repository = repository

    def list(self):
        return self.repository.all()

    def get(self, obj_id):
        return self.repository.get_by_id(obj_id)

    def create(self, **kwargs):
        return self.repository.create(**kwargs)

    def update(self, obj: ModelT, **kwargs):
        return self.repository.update(obj, **kwargs)

    def delete(self, obj: ModelT):
        return self.repository.delete(obj)

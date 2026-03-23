from django.urls import path
from .views import receive_frame

urlpatterns = [
    path('frame/', receive_frame),
]

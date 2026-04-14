from django.shortcuts import render

# Create your views here.
import base64
import numpy as np
import cv2

from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(['POST'])
def receive_frame(request):
    try:
        image_data = request.data.get('image')

        if not image_data:
            return Response({"error": "No image provided"}, status=400)

        header, encoded = image_data.split(";base64,")
        decoded = base64.b64decode(encoded)

        np_arr = np.frombuffer(decoded, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            return Response({"error": "Invalid image"}, status=400)

        return Response({
            "status": "ok",
            "shape": frame.shape,
            "message": "Frame received"
        })

    except Exception as e:
        return Response({
            "error": str(e)
        }, status=500)

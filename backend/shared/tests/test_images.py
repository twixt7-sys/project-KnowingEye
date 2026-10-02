from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from PIL import Image

from shared.utils.images import compress_image


def _upload(name: str, fmt: str, size=(2400, 1800), content_type="image/png"):
    buffer = BytesIO()
    # Noise-free gradient keeps the source large enough to be worth compressing.
    img = Image.effect_noise(size, 80).convert("RGB")
    img.save(buffer, format=fmt)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=content_type)


class CompressImageTests(SimpleTestCase):
    def test_large_image_is_downscaled_and_converted_to_webp(self):
        source = _upload("photo.png", "PNG")
        result = compress_image(source, max_dimension=512)

        self.assertEqual(result.name, "photo.webp")
        self.assertEqual(result.content_type, "image/webp")
        self.assertLess(result.size, source.size)
        result.seek(0)
        with Image.open(result) as out:
            self.assertEqual(out.format, "WEBP")
            self.assertLessEqual(max(out.size), 512)

    def test_undecodable_input_is_returned_untouched(self):
        source = SimpleUploadedFile("chart.png", b"\x89PNG\r\n\x1a\n", content_type="image/png")
        self.assertIs(compress_image(source, max_dimension=512), source)

    def test_animated_gif_is_left_alone(self):
        frames = [Image.new("RGB", (64, 64), c) for c in ("red", "blue")]
        buffer = BytesIO()
        frames[0].save(buffer, format="GIF", save_all=True, append_images=frames[1:])
        source = SimpleUploadedFile("anim.gif", buffer.getvalue(), content_type="image/gif")
        self.assertIs(compress_image(source, max_dimension=512), source)

    def test_tiny_image_is_not_recompressed(self):
        buffer = BytesIO()
        Image.new("RGB", (1, 1), "red").save(buffer, format="JPEG")
        source = SimpleUploadedFile("dot.jpg", buffer.getvalue(), content_type="image/jpeg")
        self.assertIs(compress_image(source, max_dimension=512), source)
